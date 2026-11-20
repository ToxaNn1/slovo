import { dateAfter } from '@slovo/content-rules';
import type { Word } from '@slovo/contracts';
import { PATCH_FORMAT, type ApiClient } from '@slovo/contracts/api';
import { ukrainianFolder, ukrainianSnapshot } from '@slovo/language-pack/test-support';
import { createAdminAccess, systemClock } from '@slovo/server-core';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { createDatabase } from '../database/database';
import { contentCuratedCollections, contentIds } from '../database/schema';
import { systemRandom } from '../random';
import {
  adminCommandDeps,
  countingProxy,
  createTestDatabase,
  importedDatabases,
  silentLogger,
  testApp,
  passTime,
  signedInAdmin,
  testDatabaseUrl,
} from '../test-support';

const importedDatabase = importedDatabases();

/**
 * The backend on a database of the test's own, with a Власник, the UA
 * Edition imported unless told otherwise, and an Агент's client.
 */
async function contentBackend({ imported = true }: { imported?: boolean } = {}) {
  const own = imported ? await importedDatabase() : await createTestDatabase(testDatabaseUrl());
  onTestFinished(() => own.drop());
  // The backend reads through a proxy that counts what the database sends it.
  const proxy = await countingProxy(own.url);
  onTestFinished(() => {
    proxy.close();
  });
  const database = createDatabase(proxy.url, silentLogger);
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
  const agent = backend.clientOf(token);
  const { batchId } = imported
    ? await agent.admin.content.openBatch({ editionId: 'uk' })
    : { batchId: '00000000-0000-4000-8000-000000000000' };
  return { ...backend, database, admin, agent, batchId, read: proxy.read };
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

  it("reads the Edition's content once, not on every write and report: a write reads its own record", async () => {
    const { client, agent, batchId, database, read } = await contentBackend();
    const words = (await snapshotOf(client)).words.filter((word) => !word.retired);
    const [first, second] = words;
    if (first === undefined || second === undefined) throw new Error('too few Words');
    const [stored] = (
      await database.db.execute<{ bytes: number }>(
        sql`select sum(octet_length(fields::text))::int as bytes from content_words`,
      )
    ).rows;
    const contentBytes = stored?.bytes ?? 0;
    const edit = (word: Word) => () =>
      agent.admin.content.edit({
        editionId: 'uk',
        kind: 'word',
        id: word.id,
        batchId,
        recordVersion: 1,
        fields: { ...word, primaryDefinition: `Змінено: ${word.primaryDefinition}` },
      });

    // The first read of the content at a version reads it whole.
    expect(await read(edit(first))).toBeGreaterThan(contentBytes);
    const later = await read(edit(second));
    const report = await read(() => agent.admin.content.report({ editionId: 'uk' }));

    // The Words alone are hundreds of kilobytes; a write and a report after it read a few.
    expect(contentBytes).toBeGreaterThan(500_000);
    expect(later).toBeLessThan(50_000);
    expect(report).toBeLessThan(50_000);
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

  it('registers no id for a refused create', async () => {
    const { client, agent, batchId, database } = await contentBackend();
    const { id: _id, ...fields } = await wordOf(client, WORD_ID);
    const registered = async () => (await database.db.select().from(contentIds)).length;
    const before = await registered();

    await expect(
      agent.admin.content.create({
        editionId: 'uk',
        kind: 'word',
        batchId,
        fields: { ...fields, lemma: 'обручик', stress: [3], categoryId: 'no-such-category' },
      }),
    ).rejects.toMatchObject({ code: 'REFUSED' });
    expect(await registered()).toBe(before);
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

  it('keeps refusing a stale record version after an override import: the import raises it too', async () => {
    const { client, agent, batchId, importSnapshot } = await contentBackend();
    const word = await wordOf(client, WORD_ID);
    const edit = (recordVersion: number, primaryDefinition: string) =>
      agent.admin.content.edit({
        editionId: 'uk',
        kind: 'word',
        id: WORD_ID,
        batchId,
        recordVersion,
        fields: { ...word, primaryDefinition },
      });
    await edit(1, 'Перша правка.');
    const imported = await importSnapshot('uk', ukrainianFolder.dir, ukrainianSnapshot(), {
      override: true,
    });
    expect(imported).toMatchObject({ ok: true });

    await expect(edit(1, 'Правка з форми, відкритої до імпорту.')).rejects.toMatchObject({
      code: 'STALE',
      data: { currentVersion: 3 },
    });
  });

  it('retires a record, keeping it, and creates one under a new id of its kind', async () => {
    const { client, agent, batchId } = await contentBackend();
    const before = await snapshotOf(client);
    const word = await wordOf(client, WORD_ID);
    const retire = {
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion: 1,
    } as const;
    await expect(agent.admin.content.retire({ ...retire, reason: '  ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

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

  it('writes Crossword days by their date: a day ahead edits and retires, a published day never changes', async () => {
    const { client, agent, batchId } = await contentBackend();
    const days = (await snapshotOf(client)).crosswordDays;
    const [first, last] = [days[0], days.at(-1)];
    if (first === undefined || last === undefined) throw new Error('no Crossword days');
    const write = { editionId: 'uk' as const, kind: 'crosswordDay' as const, batchId };
    const clued = last.words.map((word, i) =>
      i === 0 ? { ...word, clue: 'Нова підказка.' } : word,
    );

    expect(
      await agent.admin.content.edit({
        ...write,
        id: last.date,
        recordVersion: 1,
        fields: { ...last, words: clued },
      }),
    ).toMatchObject({ id: last.date, recordVersion: 2 });
    expect(
      (await snapshotOf(client)).crosswordDays.find(({ date }) => date === last.date)?.words[0]
        ?.clue,
    ).toBe('Нова підказка.');

    const refused = (refusals: unknown) => ({ code: 'REFUSED', data: { refusals } });
    await expect(
      agent.admin.content.edit({ ...write, id: first.date, recordVersion: 1, fields: first }),
    ).rejects.toMatchObject(refused([{ rule: 'crossword-days-immutable', field: 'date' }]));
    // The day after the last, with the words of the last: they come back within 20 days.
    const next = { ...last, date: dateAfter(last.date, 1) };
    await expect(agent.admin.content.create({ ...write, fields: next })).rejects.toMatchObject(
      refused(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'crossword-days-repeat', field: 'words.0.entryId' }),
        ]),
      ),
    );
    await expect(agent.admin.content.create({ ...write, fields: last })).rejects.toMatchObject(
      refused([{ rule: 'duplicate-id', field: 'date' }]),
    );

    await agent.admin.content.retire({ ...write, id: last.date, recordVersion: 2 });
    expect(
      (await snapshotOf(client)).crosswordDays.find(({ date }) => date === last.date),
    ).toMatchObject({ retired: true });
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

describe("a Curated Collection's publish date", () => {
  /** A collection of the seed's first Entries, with its date when one is given. */
  async function collectionBackend() {
    const backend = await contentBackend();
    const { words } = await snapshotOf(backend.client);
    const entryIds = words
      .filter((word) => !word.retired)
      .slice(0, 3)
      .map(({ id }) => id);
    const save = (publishedOn?: string) =>
      backend.agent.admin.content.create({
        editionId: 'uk',
        kind: 'curatedCollection',
        batchId: backend.batchId,
        fields: {
          name: 'Слова зими',
          description: 'Рідкісні слова холодної пори.',
          entryIds,
          ...(publishedOn === undefined ? {} : { publishedOn }),
        },
      });
    const record = (id: string) =>
      backend.agent.admin.content.record({ editionId: 'uk', kind: 'curatedCollection', id });
    return { ...backend, save, record };
  }

  it('publishes a save without a date today in Kyiv, appearing at the save moment', async () => {
    const { save, record } = await collectionBackend();
    // Past midnight in Kyiv, still the day before in UTC.
    vi.setSystemTime(new Date('2026-11-18T22:30:00.000Z'));

    const { id } = await save();

    expect(await record(id)).toMatchObject({
      fields: { publishedOn: '2026-11-19' },
      appearedAt: '2026-11-18T22:30:00.000Z',
    });
  });

  it('appears from the start of a future date in Kyiv', async () => {
    const { save, record } = await collectionBackend();
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));

    const winter = await save('2026-12-01');
    const summer = await save('2027-06-01');

    expect(await record(winter.id)).toMatchObject({
      fields: { publishedOn: '2026-12-01' },
      appearedAt: '2026-11-30T22:00:00.000Z',
    });
    expect(await record(summer.id)).toMatchObject({ appearedAt: '2027-05-31T21:00:00.000Z' });
  });

  it('moves the date of a collection not appeared yet, and refuses it once it appeared', async () => {
    const { agent, batchId, save, record } = await collectionBackend();
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));
    const { id } = await save('2026-11-20');
    const edit = async (publishedOn: string) => {
      const { fields, recordVersion } = await record(id);
      return agent.admin.content.edit({
        editionId: 'uk',
        kind: 'curatedCollection',
        id,
        batchId,
        recordVersion,
        fields: { ...fields, publishedOn },
      });
    };

    await edit('2026-11-21');
    expect(await record(id)).toMatchObject({ appearedAt: '2026-11-20T22:00:00.000Z' });

    passTime(4 * 24 * 60 * 60 * 1000);
    await expect(edit('2026-11-25')).rejects.toMatchObject({
      code: 'REFUSED',
      data: {
        refusals: [
          expect.objectContaining({ rule: 'curated-collection-appeared', field: 'publishedOn' }),
        ],
      },
    });
    // The rest of an appeared collection is still edited, its date kept.
    const { fields, recordVersion } = await record(id);
    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'curatedCollection',
      id,
      batchId,
      recordVersion,
      fields: { ...fields, name: 'Слова зими і снігу' },
    });
    expect(await record(id)).toMatchObject({
      fields: { publishedOn: '2026-11-21', name: 'Слова зими і снігу' },
      appearedAt: '2026-11-20T22:00:00.000Z',
    });
  });
  it('rolls a moved date back with the appearance of the date it restores', async () => {
    const backend = await collectionBackend();
    const { agent, save, record } = backend;
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));
    const { id } = await save('2026-12-01');
    const later = await agent.admin.content.openBatch({ editionId: 'uk' });
    const { fields, recordVersion } = await record(id);
    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'curatedCollection',
      id,
      batchId: later.batchId,
      recordVersion,
      fields: { ...fields, publishedOn: '2026-11-20' },
    });
    const owner = (await signedInAdmin(backend, 'owner')).client;

    await owner.admin.contentQueue.rollback({ batchId: later.batchId, reason: 'Не та дата' });

    expect(await record(id)).toMatchObject({
      fields: { publishedOn: '2026-12-01' },
      appearedAt: '2026-11-30T22:00:00.000Z',
    });
  });

  it('retires an appeared collection and brings it back, keeping its appearance', async () => {
    const backend = await collectionBackend();
    const { agent, batchId, client, database, save, record } = backend;
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));
    const { id } = await save('2026-11-20');
    passTime(4 * 24 * 60 * 60 * 1000);
    const retiredColumn = async () =>
      (
        await database.db
          .select({ retired: contentCuratedCollections.retired })
          .from(contentCuratedCollections)
          .where(eq(contentCuratedCollections.id, id))
      ).map(({ retired }) => retired);
    const { contentVersion } = await snapshotOf(client);

    await agent.admin.content.retire({
      editionId: 'uk',
      kind: 'curatedCollection',
      id,
      batchId,
      recordVersion: (await record(id)).recordVersion,
    });

    expect(await record(id)).toMatchObject({
      fields: { retired: true, publishedOn: '2026-11-20' },
      appearedAt: '2026-11-19T22:00:00.000Z',
    });
    expect(await retiredColumn()).toEqual([true]);
    const snapshot = await snapshotOf(client);
    expect(snapshot.curatedCollections.find((found) => found.id === id)).toMatchObject({
      retired: true,
    });
    const patch = await client.content.patch({
      params: { editionId: 'uk' },
      query: { since: contentVersion, patchFormat: PATCH_FORMAT },
    });
    expect(patch.status === 200 && patch.body.status === 'patch' && patch.body.patch).toMatchObject(
      { curatedCollections: [expect.objectContaining({ id, retired: true })] },
    );

    const { fields, recordVersion } = await record(id);
    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'curatedCollection',
      id,
      batchId,
      recordVersion,
      fields: { ...fields, retired: false },
    });

    expect(await record(id)).toMatchObject({
      fields: { retired: false },
      appearedAt: '2026-11-19T22:00:00.000Z',
    });
    expect(await retiredColumn()).toEqual([false]);
  });

  it('rolls a retire back to the live collection, and a create back to a Retired one', async () => {
    const backend = await collectionBackend();
    const { agent, database, save, record } = backend;
    const { id } = await save();
    const retiredColumn = async (of: string) =>
      (
        await database.db
          .select({ retired: contentCuratedCollections.retired })
          .from(contentCuratedCollections)
          .where(eq(contentCuratedCollections.id, of))
      ).map(({ retired }) => retired);
    const later = await agent.admin.content.openBatch({ editionId: 'uk' });
    await agent.admin.content.retire({
      editionId: 'uk',
      kind: 'curatedCollection',
      id,
      batchId: later.batchId,
      recordVersion: (await record(id)).recordVersion,
    });
    const owner = (await signedInAdmin(backend, 'owner')).client;

    await owner.admin.contentQueue.rollback({ batchId: later.batchId, reason: 'Ще потрібна' });
    expect(await record(id)).toMatchObject({ fields: { retired: false } });
    expect(await retiredColumn(id)).toEqual([false]);

    // The first batch's collection changed since, so a create rolls back in a batch of its own.
    const added = await agent.admin.content.openBatch({ editionId: 'uk' });
    const { id: _id, ...fields } = (await record(id)).fields;
    const created = await agent.admin.content.create({
      editionId: 'uk',
      kind: 'curatedCollection',
      batchId: added.batchId,
      fields: { ...fields, name: 'Слова весни' },
    });
    await owner.admin.contentQueue.rollback({ batchId: added.batchId, reason: 'Зайва' });
    expect(await record(created.id)).toMatchObject({ fields: { retired: true } });
    expect(await retiredColumn(created.id)).toEqual([true]);
  });

  it('keeps the pictogram a save names, and refuses one that names no Category', async () => {
    const { agent, batchId, client, save, record } = await collectionBackend();
    const { id } = await save();
    const { categoryId } = await wordOf(client, WORD_ID);
    const edit = async (fields: Record<string, unknown>) => {
      const current = await record(id);
      return agent.admin.content.edit({
        editionId: 'uk',
        kind: 'curatedCollection',
        id,
        batchId,
        recordVersion: current.recordVersion,
        fields,
      });
    };

    const { fields } = await record(id);
    await edit({ ...fields, pictogram: categoryId });
    expect(await record(id)).toMatchObject({ fields: { pictogram: categoryId } });

    const { pictogram: _pictogram, ...withoutPictogram } = (await record(id)).fields;
    await edit(withoutPictogram);
    expect((await record(id)).fields).not.toHaveProperty('pictogram');

    await expect(
      edit({ ...withoutPictogram, pictogram: 'no-such-category' }),
    ).rejects.toMatchObject({
      code: 'REFUSED',
      data: {
        refusals: [
          expect.objectContaining({ rule: 'curated-collection-pictogram', field: 'pictogram' }),
        ],
      },
    });
  });
});
