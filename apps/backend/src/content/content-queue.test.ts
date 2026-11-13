import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ApiClient } from '@slovo/contracts/api';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { createAdminAccess, systemClock } from '@slovo/server-core';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, onTestFinished } from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { createDatabase } from '../database/database';
import { mistakeReports } from '../database/schema';
import { systemRandom } from '../random';
import {
  adminCommandDeps,
  importedDatabases,
  signedInAdmin,
  silentLogger,
  testApp,
} from '../test-support';

/** A copy of the UA Edition folder, removed after the file. */
const folder = (() => {
  const dir = join(mkdtempSync(join(tmpdir(), 'slovo-queue-')), 'uk');
  cpSync(join(EDITIONS_DIR, 'uk'), dir, { recursive: true });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
})();

const importedDatabase = importedDatabases('uk', folder);

/** The backend with the UA Edition imported, an Агент's client and a signed-in Власник and Адмін. */
async function queueBackend() {
  const own = await importedDatabase();
  onTestFinished(() => own.drop());
  const database = createDatabase(own.url, silentLogger);
  onTestFinished(() => database.close());
  const backend = testApp({ database });
  const admin = createAdminAccess({
    store: createAdminStore(database),
    clock: systemClock,
    random: systemRandom,
    hash: hashToken,
  });
  const out: string[] = [];
  const io = { out: (line: string) => out.push(line), err: () => undefined };
  await runAdminCommand(
    ['owner', 'add', 'first-owner@example.com'],
    adminCommandDeps(admin, database),
    io,
  );
  await runAdminCommand(['agent', 'add', 'claude-content'], adminCommandDeps(admin, database), io);
  const token = out.find((line) => line.startsWith('slovo_agent_'));
  if (token === undefined) throw new Error('no Агент token');
  const owner = (await signedInAdmin(backend, 'owner')).client;
  const adminUser = (await signedInAdmin(backend, 'admin')).client;
  return { ...backend, database, token, agent: backend.clientOf(token), owner, adminUser };
}

const snapshotOf = (client: ApiClient) => client.content.snapshot({ editionId: 'uk' });

async function wordOf(client: ApiClient, id: string) {
  const word = (await snapshotOf(client)).words.find((found) => found.id === id);
  if (word === undefined) throw new Error(`no Word ${id}`);
  return word;
}

/** An Агент batch that creates one Word and edits two. */
async function agentBatch(client: ApiClient, agent: ApiClient) {
  const words = (await snapshotOf(client)).words.filter((word) => !word.retired);
  const [first, second] = words;
  if (first === undefined || second === undefined) throw new Error('too few Words');
  const { batchId } = await agent.admin.content.openBatch({ editionId: 'uk' });
  const { id: _id, ...fields } = first;
  const created = await agent.admin.content.create({
    editionId: 'uk',
    kind: 'word',
    batchId,
    fields: { ...fields, lemma: 'обручик', stress: [3] },
  });
  for (const word of [first, second]) {
    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: word.id,
      batchId,
      recordVersion: 1,
      fields: { ...word, primaryDefinition: `Змінено: ${word.primaryDefinition}` },
    });
  }
  return { batchId, createdId: created.id, first, second };
}

const forbidden = { code: 'FORBIDDEN' };

describe('the Content queue', () => {
  it('rolls a batch back as one publish: retires the new, restores the edits, skips a record changed after it', async () => {
    const { client, agent, owner } = await queueBackend();
    const { batchId, createdId, first, second } = await agentBatch(client, agent);
    // A later batch changes the second Word again.
    const later = await agent.admin.content.openBatch({ editionId: 'uk' });
    const changed = await wordOf(client, second.id);
    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: second.id,
      batchId: later.batchId,
      recordVersion: 2,
      fields: { ...changed, primaryDefinition: 'Пізніша зміна.' },
    });
    const before = await snapshotOf(client);

    const answer = await owner.admin.contentQueue.rollback({ batchId, reason: 'Погана пачка' });

    expect(answer).toEqual({
      contentVersion: before.contentVersion + 1,
      retired: [createdId],
      restored: [first.id],
      skipped: [second.id],
    });
    const after = await snapshotOf(client);
    expect(after.contentVersion).toBe(before.contentVersion + 1);
    expect(after.words.find(({ id }) => id === createdId)).toMatchObject({ retired: true });
    expect(await wordOf(client, first.id)).toEqual(first);
    expect((await wordOf(client, second.id)).primaryDefinition).toBe('Пізніша зміна.');
    const { actions } = await owner.admin.actions({ editionId: 'uk' });
    const rollbacks = actions.filter(({ what }) => what === 'content.batch.rollback');
    expect(rollbacks).toHaveLength(1);
    expect(rollbacks[0]?.reason).toBe('Погана пачка');
    const { batches } = await owner.admin.contentQueue.batches({ editionId: 'uk' });
    expect(batches.map(({ id }) => id)).toEqual([later.batchId]);
  });

  it('lists an open batch with its counts and author, and a reviewed one leaves the queue', async () => {
    const { client, agent, adminUser } = await queueBackend();
    const { batchId } = await agentBatch(client, agent);

    expect((await adminUser.admin.contentQueue.batches({})).batches).toEqual([
      expect.objectContaining({
        id: batchId,
        editionId: 'uk',
        author: 'claude-content',
        added: 1,
        changed: 2,
      }),
    ]);
    await adminUser.admin.contentQueue.review({ batchId, reason: 'Переглянуто' });

    expect((await adminUser.admin.contentQueue.batches({})).batches).toEqual([]);
  });

  it('reviews a batch while a write holding the Edition lock reads the batch row, with no deadlock', async () => {
    const { client, agent, adminUser, database } = await queueBackend();
    const { batchId } = await agentBatch(client, agent);

    const { review } = await database.db.transaction(async (tx) => {
      // As a write does: the Edition lock first, then its row of the batch needs KEY SHARE.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('uk'))`);
      const started = adminUser.admin.contentQueue.review({ batchId, reason: 'Переглянуто' });
      for (;;) {
        const waiting = await database.db.execute(
          sql`select 1 from pg_locks where locktype = 'advisory' and not granted`,
        );
        if (waiting.rows.length > 0) break;
      }
      await tx.execute(sql`select id from content_batches where id = ${batchId} for key share`);
      // Not awaited here: the review waits for this transaction's Edition lock.
      return { review: started };
    });

    expect(await review).toEqual({ reviewed: true });
    expect((await adminUser.admin.contentQueue.batches({})).batches).toEqual([]);
  });

  it('keeps the reason of an accepted or rejected flag in the Action log, and the flag leaves the list', async () => {
    const { client, agent, owner } = await queueBackend();
    const { batchId, first, second } = await agentBatch(client, agent);
    for (const word of [first, second]) {
      await agent.admin.content.flag({
        editionId: 'uk',
        kind: 'word',
        id: word.id,
        batchId,
        reason: `Сумнів щодо ${word.lemma}`,
      });
    }
    const { flags } = await owner.admin.contentQueue.flags({ editionId: 'uk' });
    expect(flags).toEqual([
      expect.objectContaining({
        kind: 'word',
        recordId: first.id,
        author: 'claude-content',
        explanation: `Сумнів щодо ${first.lemma}`,
      }),
      expect.objectContaining({ recordId: second.id }),
    ]);
    const [accepted, rejected] = flags;
    if (accepted === undefined || rejected === undefined) throw new Error('no flags');

    await owner.admin.contentQueue.resolveFlag({
      id: accepted.id,
      decision: 'accept',
      reason: 'Слушно',
    });
    await owner.admin.contentQueue.resolveFlag({
      id: rejected.id,
      decision: 'reject',
      reason: 'Хибна тривога',
    });

    expect((await owner.admin.contentQueue.flags({})).flags).toEqual([]);
    const { actions } = await owner.admin.actions({ editionId: 'uk' });
    expect(
      actions
        .filter(({ what }) => what.startsWith('content.flag.'))
        .map(({ what, reason }) => [what, reason]),
    ).toEqual(
      expect.arrayContaining([
        ['content.flag.accept', 'Слушно'],
        ['content.flag.reject', 'Хибна тривога'],
      ]),
    );
  });

  it('resolves a flag once when two decisions on it race', async () => {
    const { client, agent, owner } = await queueBackend();
    const { batchId, first } = await agentBatch(client, agent);
    await agent.admin.content.flag({
      editionId: 'uk',
      kind: 'word',
      id: first.id,
      batchId,
      reason: 'Сумнів',
    });
    const [flag] = (await owner.admin.contentQueue.flags({})).flags;
    if (flag === undefined) throw new Error('no flag');

    const answers = await Promise.allSettled(
      (['accept', 'reject', 'accept', 'reject'] as const).map((decision) =>
        owner.admin.contentQueue.resolveFlag({ id: flag.id, decision, reason: 'Рішення' }),
      ),
    );

    expect(answers.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const { actions } = await owner.admin.actions({ editionId: 'uk' });
    expect(actions.filter(({ what }) => what.startsWith('content.flag.'))).toHaveLength(1);
  });

  it('deletes a Mistake Report marked «Вирішено», with its reason in the Action log', async () => {
    const { database, owner } = await queueBackend();
    await database.db.insert(mistakeReports).values({
      editionId: 'uk',
      entryId: 'w_009orq',
      type: 'stress',
      comment: 'Наголос не той.',
      appVersion: '1.2.0',
      contentVersion: 1,
      receivedAt: new Date(),
    });
    const { reports } = await owner.admin.contentQueue.reports({ editionId: 'uk' });
    expect(reports).toEqual([
      expect.objectContaining({ entryId: 'w_009orq', type: 'stress', appVersion: '1.2.0' }),
    ]);
    const [report] = reports;
    if (report === undefined) throw new Error('no report');

    await owner.admin.contentQueue.resolveReport({ id: report.id, reason: 'Виправлено' });

    expect((await owner.admin.contentQueue.reports({})).reports).toEqual([]);
    const { actions } = await owner.admin.actions({ editionId: 'uk' });
    expect(actions.find(({ what }) => what === 'report.resolve')?.reason).toBe('Виправлено');
  });

  it('lets an Адмін roll back, and refuses an Агент token, no session and no reason', async () => {
    const { client, agent, adminUser, clientWith } = await queueBackend();
    const { batchId } = await agentBatch(client, agent);
    const reason = 'Причина';

    await expect(agent.admin.contentQueue.batches({})).rejects.toMatchObject(forbidden);
    await expect(agent.admin.contentQueue.flags({})).rejects.toMatchObject(forbidden);
    await expect(agent.admin.contentQueue.reports({})).rejects.toMatchObject(forbidden);
    await expect(agent.admin.contentQueue.review({ batchId, reason })).rejects.toMatchObject(
      forbidden,
    );
    await expect(agent.admin.contentQueue.rollback({ batchId, reason })).rejects.toMatchObject(
      forbidden,
    );
    await expect(
      agent.admin.contentQueue.resolveFlag({ id: 1, decision: 'accept', reason }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      agent.admin.contentQueue.resolveReport({ id: batchId, reason }),
    ).rejects.toMatchObject(forbidden);
    await expect(clientWith({}).admin.contentQueue.batches({})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(
      adminUser.admin.contentQueue.rollback({ batchId, reason: ' ' }),
    ).rejects.toMatchObject({ status: 400 });

    const answer = await adminUser.admin.contentQueue.rollback({ batchId, reason });
    expect(answer.restored).toHaveLength(2);
    await expect(adminUser.admin.contentQueue.rollback({ batchId, reason })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
