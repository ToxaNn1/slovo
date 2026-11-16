import { ukrainianFolder, ukrainianSnapshot } from '@slovo/language-pack/test-support';
import { createAdminAccess, systemClock } from '@slovo/server-core';
import { describe, expect, it, onTestFinished } from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { createDatabase } from '../database/database';
import { systemRandom } from '../random';
import {
  adminCommandDeps,
  createTestDatabase,
  signedInAdmin,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';

/** The backend with a Власник, an Агент, an Адмін session and the UA Edition imported. */
async function reviewBackend() {
  const own = await createTestDatabase(testDatabaseUrl());
  onTestFinished(() => own.drop());
  const database = createDatabase(own.url, silentLogger);
  onTestFinished(() => database.close());
  const backend = testApp({ database });
  const access = createAdminAccess({
    store: createAdminStore(database),
    clock: systemClock,
    random: systemRandom,
    hash: hashToken,
  });
  const commandDeps = adminCommandDeps(access, database);
  const out: string[] = [];
  const io = { out: (line: string) => out.push(line), err: () => undefined };
  await runAdminCommand(['owner', 'add', 'owner@example.com'], commandDeps, io);
  await runAdminCommand(['agent', 'add', 'content-agent'], commandDeps, io);
  const token = out.find((line) => line.startsWith('slovo_agent_'));
  if (token === undefined) throw new Error('no Агент token');
  const imported = await backend.importSnapshot('uk', ukrainianFolder.dir, ukrainianSnapshot());
  if (!imported.ok) throw new Error('the UA Edition did not import');
  const { email, client } = await signedInAdmin(backend, 'admin');
  return {
    ...backend,
    email,
    admin: client.admin.content,
    agent: backend.clientOf(token).admin.content,
    store: createAdminStore(database),
  };
}

const next = (backend: Awaited<ReturnType<typeof reviewBackend>>) =>
  backend.admin.unchecked({ editionId: 'uk', kind: 'word' });

describe('«Перегляд»: the records not checked yet', () => {
  it('lists every imported record unchecked, and a check takes one out with an Action log row', async () => {
    const backend = await reviewBackend();
    const { total: words } = await backend.admin.records({ editionId: 'uk', kind: 'word' });
    const before = await next(backend);
    expect(before.total).toBe(words);
    const record = before.record ?? never();

    const checked = await backend.admin.check({
      editionId: 'uk',
      kind: 'word',
      id: record.id,
      recordVersion: record.recordVersion,
    });

    expect(checked).toEqual({ id: record.id, recordVersion: record.recordVersion });
    const after = await next(backend);
    expect(after.total).toBe(words - 1);
    expect(after.record?.id).not.toBe(record.id);
    const actions = (await backend.store.actions('uk')).filter(
      (row) => row.what === 'content.word.check',
    );
    expect(actions).toEqual([
      expect.objectContaining({
        who: { kind: 'admin-user', email: backend.email },
        after: { id: record.id, recordVersion: record.recordVersion },
        reason: null,
      }),
    ]);
  });

  it('puts the record of the newest batch first, and a write after a check leaves it unchecked again', async () => {
    const backend = await reviewBackend();
    const { records } = await backend.admin.records({ editionId: 'uk', kind: 'word', query: 'а' });
    const last = records.at(-1) ?? never();
    const { fields, recordVersion } = await backend.admin.record({
      editionId: 'uk',
      kind: 'word',
      id: last.id,
    });
    await backend.admin.check({ editionId: 'uk', kind: 'word', id: last.id, recordVersion });
    const { total } = await next(backend);

    const { batchId } = await backend.agent.openBatch({ editionId: 'uk' });
    await backend.agent.edit({
      editionId: 'uk',
      kind: 'word',
      id: last.id,
      batchId,
      recordVersion,
      fields: { ...fields, primaryDefinition: 'Нове тлумачення.' },
    });

    const after = await next(backend);
    expect(after.total).toBe(total + 1);
    expect(after.record).toMatchObject({ id: last.id, recordVersion: recordVersion + 1 });
  });

  it('skips the records passed by: `skip` gives the one after them, the count unchanged', async () => {
    const backend = await reviewBackend();
    const first = await next(backend);

    const second = await backend.admin.unchecked({ editionId: 'uk', kind: 'word', skip: 1 });

    expect(second.total).toBe(first.total);
    expect(second.record?.id).not.toBe(first.record?.id);
    const past = await backend.admin.unchecked({
      editionId: 'uk',
      kind: 'word',
      skip: first.total,
    });
    expect(past).toEqual({ total: first.total });
  });

  it('refuses a check at an old record version, and an Агент check', async () => {
    const backend = await reviewBackend();
    const record = (await next(backend)).record ?? never();
    const at = { editionId: 'uk' as const, kind: 'word' as const, id: record.id };

    await expect(
      backend.admin.check({ ...at, recordVersion: record.recordVersion + 1 }),
    ).rejects.toMatchObject({ code: 'STALE', data: { currentVersion: record.recordVersion } });
    await expect(
      backend.agent.check({ ...at, recordVersion: record.recordVersion }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await next(backend)).record?.id).toBe(record.id);
  });

  it('checks every unchecked record of a kind at its record version, each with an Action log row', async () => {
    const backend = await reviewBackend();
    const idioms = () => backend.admin.unchecked({ editionId: 'uk', kind: 'idiom' });
    const first = (await idioms()).record ?? never();
    await backend.admin.check({
      editionId: 'uk',
      kind: 'idiom',
      id: first.id,
      recordVersion: first.recordVersion,
    });
    const { total } = await idioms();
    const words = await next(backend);

    const done = await backend.admin.checkAll({
      editionId: 'uk',
      kind: 'idiom',
      total,
      reason: 'Схвалено все',
    });

    expect(done).toEqual({ checked: total });
    expect(await idioms()).toEqual({ total: 0 });
    expect(await next(backend)).toEqual(words);
    const actions = (await backend.store.actions('uk')).filter(
      (row) => row.what === 'content.idiom.check',
    );
    expect(actions).toHaveLength(total + 1);
    expect(new Set(actions.map((row) => JSON.stringify(row.after))).size).toBe(total + 1);
    const all = actions.filter((row) => row.reason === 'Схвалено все');
    expect(all).toHaveLength(total);
    expect(all.map((row) => row.who)).toEqual(
      all.map(() => ({ kind: 'admin-user', email: backend.email })),
    );
    expect(all.map((row) => row.after)).not.toContainEqual(
      expect.objectContaining({ id: first.id }),
    );
  });

  it('refuses checking all when the count changed since the confirmation, and an Агент', async () => {
    const backend = await reviewBackend();
    const { total } = await next(backend);

    await expect(
      backend.admin.checkAll({ editionId: 'uk', kind: 'word', total: total + 1, reason: 'Так' }),
    ).rejects.toMatchObject({ code: 'CHANGED', data: { total } });
    await expect(
      backend.agent.checkAll({ editionId: 'uk', kind: 'word', total, reason: 'Так' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await next(backend)).total).toBe(total);
    expect(
      (await backend.store.actions('uk')).filter((row) => row.what === 'content.word.check'),
    ).toEqual([]);
  });

  it('leaves a retired record out', async () => {
    const backend = await reviewBackend();
    const before = await next(backend);
    const record = before.record ?? never();
    const { batchId } = await backend.admin.openBatch({ editionId: 'uk' });

    await backend.admin.retire({
      editionId: 'uk',
      kind: 'word',
      id: record.id,
      batchId,
      recordVersion: record.recordVersion,
    });

    const after = await next(backend);
    expect(after.total).toBe(before.total - 1);
    expect(after.record?.id).not.toBe(record.id);
  });
});

function never(): never {
  throw new Error('no record to review');
}
