import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ApiClient } from '@slovo/contracts/api';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { createAdminAccess, systemClock } from '@slovo/server-core';
import { afterAll, describe, expect, it, onTestFinished } from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { createDatabase } from '../database/database';
import { systemRandom } from '../random';
import {
  adminCommandDeps,
  createTestDatabase,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';

/** A copy of the UA Edition folder, removed after the file. */
const folder = (() => {
  const dir = join(mkdtempSync(join(tmpdir(), 'slovo-writes-')), 'uk');
  cpSync(join(EDITIONS_DIR, 'uk'), dir, { recursive: true });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
})();

/**
 * The backend on a database of the test's own, with a Власник, the UA
 * Edition imported unless told otherwise, and an Агент's client.
 */
async function contentBackend({ imported = true }: { imported?: boolean } = {}) {
  const own = await createTestDatabase(testDatabaseUrl());
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
  const commandDeps = adminCommandDeps(admin, database);
  const out: string[] = [];
  const io = { out: (line: string) => out.push(line), err: () => undefined };
  await runAdminCommand(['owner', 'add', 'owner@example.com'], commandDeps, io);
  await runAdminCommand(['agent', 'add', 'claude-content'], commandDeps, io);
  const token = out.find((line) => line.startsWith('slovo_agent_'));
  if (token === undefined) throw new Error('no Агент token');
  if (imported) {
    const result = await backend.importContent('uk', folder);
    if (!result.ok) throw new Error('the UA Edition did not import');
  }
  const agent = backend.clientOf(token);
  const { batchId } = imported
    ? await agent.admin.content.openBatch({ editionId: 'uk' })
    : { batchId: '00000000-0000-4000-8000-000000000000' };
  return { ...backend, admin, agent, batchId };
}

const snapshotOf = (client: ApiClient) => client.content.snapshot({ editionId: 'uk' });

/** A live Word of the snapshot, by id. */
async function wordOf(client: ApiClient, id: string) {
  const word = (await snapshotOf(client)).words.find((found) => found.id === id);
  if (word === undefined) throw new Error(`no Word ${id}`);
  return word;
}

const WORD_ID = 'w_009orq';

describe('the content write API', () => {
  it('publishes a valid edit by an Агент: the content version and the record version rise by one', async () => {
    const { client, agent, batchId } = await contentBackend();
    const before = await snapshotOf(client);
    const word = await wordOf(client, WORD_ID);

    const written = await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion: 1,
      fields: { ...word, primaryDefinition: 'Кільце з металу чи дерева.' },
    });

    expect(written).toMatchObject({
      id: WORD_ID,
      recordVersion: 2,
      contentVersion: before.contentVersion + 1,
      batchId,
    });
    const after = await snapshotOf(client);
    expect(after.contentVersion).toBe(before.contentVersion + 1);
    expect(after.words.find(({ id }) => id === WORD_ID)?.primaryDefinition).toBe(
      'Кільце з металу чи дерева.',
    );
  });

  it('refuses a save that breaks a rule by the rule name, and the content version stays', async () => {
    const { client, agent, batchId } = await contentBackend();
    const before = await snapshotOf(client);
    const word = await wordOf(client, WORD_ID);
    const retired = before.words.find((found) => found.retired);
    const [collection] = before.curatedCollections;
    if (retired === undefined || collection === undefined) throw new Error('no fixture records');
    const edit = (
      kind: 'word' | 'curatedCollection',
      id: string,
      fields: Record<string, unknown>,
    ) => agent.admin.content.edit({ editionId: 'uk', kind, id, batchId, recordVersion: 1, fields });
    const refusedBy = (rule: string) => ({
      code: 'REFUSED',
      data: { refusals: expect.arrayContaining([expect.objectContaining({ rule })]) as unknown },
    });

    await expect(
      edit('word', WORD_ID, { ...word, categoryId: 'no-such-category' }),
    ).rejects.toMatchObject(refusedBy('word-category'));
    // The б of «обруч».
    await expect(edit('word', WORD_ID, { ...word, stress: [1] })).rejects.toMatchObject(
      refusedBy('stress'),
    );
    const { id: _id, ...copy } = word;
    await expect(
      agent.admin.content.create({ editionId: 'uk', kind: 'word', batchId, fields: copy }),
    ).rejects.toMatchObject(refusedBy('unique-lemma'));
    await expect(
      edit('curatedCollection', collection.id, {
        ...collection,
        entryIds: [...collection.entryIds, retired.id],
      }),
    ).rejects.toMatchObject(refusedBy('curated-collection-entry'));

    expect((await snapshotOf(client)).contentVersion).toBe(before.contentVersion);
  });

  it('refuses an edit made from a stale record version with the current one', async () => {
    const { client, agent, batchId } = await contentBackend();
    const word = await wordOf(client, WORD_ID);
    const edit = (primaryDefinition: string) =>
      agent.admin.content.edit({
        editionId: 'uk',
        kind: 'word',
        id: WORD_ID,
        batchId,
        recordVersion: 1,
        fields: { ...word, primaryDefinition },
      });
    await edit('Перша правка.');

    await expect(edit('Друга правка з тієї самої версії.')).rejects.toMatchObject({
      code: 'STALE',
      data: { currentVersion: 2 },
    });
  });

  it('retires a record, keeping it, and creates one under a new id of its kind', async () => {
    const { client, agent, batchId } = await contentBackend();
    const before = await snapshotOf(client);
    const word = await wordOf(client, WORD_ID);

    await agent.admin.content.retire({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion: 1,
    });
    const { id: _id, ...fields } = word;
    const created = await agent.admin.content.create({
      editionId: 'uk',
      kind: 'word',
      batchId,
      // «обру́чик».
      fields: { ...fields, lemma: 'обручик', stress: [3] },
    });

    const after = await snapshotOf(client);
    expect(after.words.find(({ id }) => id === WORD_ID)).toMatchObject({ retired: true });
    expect(created.id).toMatch(/^w_[a-z0-9]{6}$/);
    const earlier = [
      ...before.words,
      ...before.corrections,
      ...before.idioms,
      ...before.tips,
      ...before.synonymRows,
      ...before.curatedCollections,
    ].map(({ id }) => id);
    expect(earlier).not.toContain(created.id);
    expect(after.words.find(({ id }) => id === created.id)).toMatchObject({ lemma: 'обручик' });
  });

  it('refuses a write without a token, with the app Session, or before the Edition is imported', async () => {
    const backend = await contentBackend();
    const word = await wordOf(backend.client, WORD_ID);
    const edit = (client: ApiClient) =>
      client.admin.content.edit({
        editionId: 'uk',
        kind: 'word',
        id: WORD_ID,
        batchId: backend.batchId,
        recordVersion: 1,
        fields: { ...word, primaryDefinition: 'Без права.' },
      });
    const email = 'reader@example.com';
    await backend.client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await backend.client.account.verifyCode({
      email,
      code: backend.mailer.codeSentTo(email),
    });

    await expect(edit(backend.client)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(edit(backend.clientOf(token))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const notImported = await contentBackend({ imported: false });
    await expect(
      notImported.agent.admin.content.openBatch({ editionId: 'uk' }),
    ).rejects.toMatchObject({ code: 'NOT_IMPORTED' });
    await expect(edit(notImported.agent)).rejects.toMatchObject({ code: 'NOT_IMPORTED' });
  });

  it('sets «needs new recording» on a change of the Lemma or Stress, not of a definition', async () => {
    const { client, agent, batchId } = await contentBackend();
    const word = await wordOf(client, WORD_ID);
    const edit = (recordVersion: number, fields: Record<string, unknown>) =>
      agent.admin.content.edit({
        editionId: 'uk',
        kind: 'word',
        id: WORD_ID,
        batchId,
        recordVersion,
        fields: { ...word, ...fields },
      });

    expect(await edit(1, { primaryDefinition: 'Лише тлумачення.' })).toMatchObject({
      needsNewRecording: false,
    });
    // «о́бруч».
    expect(await edit(2, { stress: [0] })).toMatchObject({ needsNewRecording: true });
    // Still set by a definition edit afterwards: only the narrator-voice work clears it.
    expect(await edit(3, { primaryDefinition: 'Знову тлумачення.' })).toMatchObject({
      needsNewRecording: true,
    });
  });

  it('flags a record with a reason as an Action log row, changing no content', async () => {
    const { client, agent, batchId, admin } = await contentBackend();
    const before = await snapshotOf(client);

    await agent.admin.content.flag({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      reason: 'сумнівне джерело',
    });

    expect(await snapshotOf(client)).toEqual(before);
    expect((await admin.actions('uk')).filter(({ batchId: of }) => of === batchId)).toEqual([
      expect.objectContaining({
        who: { kind: 'agent', name: 'claude-content' },
        what: 'content.word.flag',
        reason: 'сумнівне джерело',
      }),
    ]);
    await expect(
      agent.admin.content.flag({
        editionId: 'uk',
        kind: 'word',
        id: 'w_none00',
        batchId,
        reason: 'x',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps one batch id over its writes, logs before and after, and reports against the targets', async () => {
    const { client, agent, batchId, admin } = await contentBackend();
    const word = await wordOf(client, WORD_ID);

    const edited = await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion: 1,
      fields: { ...word, primaryDefinition: 'Нове тлумачення.' },
      reason: 'точніше',
    });
    const retired = await agent.admin.content.retire({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion: 2,
    });

    expect([edited.batchId, retired.batchId]).toEqual([batchId, batchId]);
    // The Action log answers newest first.
    const log = (await admin.actions('uk')).filter(({ batchId: of }) => of === batchId).reverse();
    expect(log).toEqual([
      expect.objectContaining({
        who: { kind: 'agent', name: 'claude-content' },
        what: 'content.word.edit',
        before: expect.objectContaining({ recordVersion: 1, fields: word }) as unknown,
        after: expect.objectContaining({
          recordVersion: 2,
          fields: expect.objectContaining({ primaryDefinition: 'Нове тлумачення.' }) as unknown,
        }) as unknown,
        reason: 'точніше',
        editionId: 'uk',
      }),
      expect.objectContaining({
        what: 'content.word.retire',
        before: expect.objectContaining({ recordVersion: 2 }) as unknown,
        after: expect.objectContaining({
          recordVersion: 3,
          fields: expect.objectContaining({ retired: true }) as unknown,
        }) as unknown,
        reason: null,
      }),
    ]);

    const { report, missed } = await agent.admin.content.report({ editionId: 'uk' });
    const snapshot = await snapshotOf(client);
    const live = snapshot.words.filter((found) => !found.retired);
    expect(report.words).toBe(live.length);
    expect(
      report.wordsPerCategory.find(({ categoryId }) => categoryId === word.categoryId),
    ).toMatchObject({ words: live.filter((found) => found.categoryId === word.categoryId).length });
    // The UA Edition declares 500 Words at least.
    expect(missed.some(({ target }) => target === 'minWords')).toBe(live.length < 500);
  });
});
