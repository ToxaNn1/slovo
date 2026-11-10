import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PATCH_FORMAT, type ApiClient } from '@slovo/contracts/api';
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
  TEST_MEDIA_BASE,
} from '../test-support';

/** A copy of the UA Edition folder, removed after the file. */
const folder = (() => {
  const dir = join(mkdtempSync(join(tmpdir(), 'slovo-patch-')), 'uk');
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

/** «Changed since my version», asked as the app asks it. */
const patchOf = (client: ApiClient, since: number, ifNoneMatch?: string) =>
  client.content.patch({
    params: { editionId: 'uk' },
    query: { since, patchFormat: PATCH_FORMAT },
    ...(ifNoneMatch === undefined ? {} : { headers: { 'if-none-match': ifNoneMatch } }),
  });

/** The Patch of a 200 answer. */
function patchIn(answer: Awaited<ReturnType<typeof patchOf>>) {
  if (answer.status !== 200 || answer.body.status !== 'patch') {
    throw new Error(`no Patch: ${JSON.stringify(answer)}`);
  }
  return answer.body.patch;
}

const NO_RECORDS = {
  mediaBase: TEST_MEDIA_BASE,
  recordings: [],
  illustrations: [],
  words: [],
  idioms: [],
  corrections: [],
  tips: [],
  synonymRows: [],
  curatedCollections: [],
  crosswordDays: [],
};

const WORD_ID = 'w_009orq';

/** A SHA-256 in hex made of one repeated digit, as a media file's hash. */
const hashOf = (digit: string) => digit.repeat(64);

describe('the Patch read API', () => {
  it('answers the one record edited since the device version, and a Retired one with its flag', async () => {
    const { client, agent, batchId } = await contentBackend();
    const before = await snapshotOf(client);
    const word = before.words.find((found) => found.id === WORD_ID);
    if (word === undefined) throw new Error(`no Word ${WORD_ID}`);
    const edited = { ...word, primaryDefinition: 'Кільце з металу чи дерева.' };
    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion: 1,
      fields: edited,
    });

    const afterEdit = patchIn(await patchOf(client, before.contentVersion));
    expect(afterEdit).toEqual({
      editionId: 'uk',
      since: before.contentVersion,
      contentVersion: before.contentVersion + 1,
      patchFormat: PATCH_FORMAT,
      ...NO_RECORDS,
      words: [edited],
    });

    const idiom = before.idioms[0];
    if (idiom === undefined) throw new Error('no Idiom');
    await agent.admin.content.retire({
      editionId: 'uk',
      kind: 'idiom',
      id: idiom.id,
      batchId,
      recordVersion: 1,
    });
    const afterRetire = patchIn(await patchOf(client, afterEdit.contentVersion));
    expect(afterRetire.contentVersion).toBe(afterEdit.contentVersion + 1);
    expect(afterRetire.idioms).toEqual([{ ...idiom, retired: true }]);
    expect(afterRetire.words).toEqual([]);
  });

  it('answers 304 to the current version with the kept ETag, and the new record once one more edit lands', async () => {
    const { client, agent, batchId } = await contentBackend();
    const { contentVersion, words } = await snapshotOf(client);
    const first = await patchOf(client, contentVersion);
    expect(patchIn(first)).toEqual({
      editionId: 'uk',
      since: contentVersion,
      contentVersion,
      patchFormat: PATCH_FORMAT,
      ...NO_RECORDS,
    });
    const { etag } = first.headers;

    await expect(patchOf(client, contentVersion, etag)).resolves.toMatchObject({
      status: 304,
      headers: { etag },
    });

    const word = words.find((found) => found.id === WORD_ID);
    if (word === undefined) throw new Error(`no Word ${WORD_ID}`);
    const edited = { ...word, primaryDefinition: 'Кільце з металу чи дерева.' };
    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion: 1,
      fields: edited,
    });
    const next = await patchOf(client, contentVersion, etag);
    expect(next.status).toBe(200);
    expect(next.headers.etag).not.toBe(etag);
    expect(patchIn(next).words).toEqual([edited]);
  });

  it('gives a device at version 0 every record of every kind', async () => {
    const { client } = await contentBackend();
    const { editionId, contentVersion, ...rest } = await snapshotOf(client);
    const { needsNewRecording, ...kinds } = rest;
    expect(needsNewRecording).toEqual([]);
    for (const records of Object.values(kinds)) expect(records).not.toEqual([]);

    expect(patchIn(await patchOf(client, 0))).toEqual({
      editionId,
      since: 0,
      contentVersion,
      patchFormat: PATCH_FORMAT,
      ...kinds,
    });
  });

  it('keeps a device ahead of the backend at its own content version, with no record', async () => {
    const { client } = await contentBackend();
    const { contentVersion } = await snapshotOf(client);

    expect(patchIn(await patchOf(client, contentVersion + 5))).toEqual({
      editionId: 'uk',
      since: contentVersion + 5,
      contentVersion: contentVersion + 5,
      patchFormat: PATCH_FORMAT,
      ...NO_RECORDS,
    });
  });

  it('carries the media rows changed since the device version, a replaced one retired, and the media base', async () => {
    const { client, media } = await contentBackend();
    const before = await snapshotOf(client);
    expect(before).toMatchObject({ mediaBase: TEST_MEDIA_BASE, recordings: [], illustrations: [] });

    const recording = {
      wordId: WORD_ID,
      narratorVoice: 'oksana',
      recordingKind: 'plain' as const,
      hash: hashOf('a'),
      size: 7000,
      durationMs: 900,
    };
    await media.saveRecording('uk', recording);
    await media.saveIllustration('uk', { wordId: WORD_ID, hash: hashOf('b'), size: 40_000 });
    const added = patchIn(await patchOf(client, before.contentVersion));
    expect(added).toEqual({
      editionId: 'uk',
      since: before.contentVersion,
      contentVersion: before.contentVersion + 2,
      patchFormat: PATCH_FORMAT,
      ...NO_RECORDS,
      recordings: [{ ...recording, retired: false }],
      illustrations: [{ wordId: WORD_ID, hash: hashOf('b'), size: 40_000, retired: false }],
    });

    const replacement = { ...recording, hash: hashOf('c'), size: 7100, durationMs: 950 };
    await media.saveRecording('uk', replacement);
    const replaced = patchIn(await patchOf(client, added.contentVersion));
    expect(replaced).toEqual({
      editionId: 'uk',
      since: added.contentVersion,
      contentVersion: added.contentVersion + 1,
      patchFormat: PATCH_FORMAT,
      ...NO_RECORDS,
      recordings: [
        { ...recording, retired: true },
        { ...replacement, retired: false },
      ],
    });

    await expect(snapshotOf(client)).resolves.toMatchObject({
      contentVersion: replaced.contentVersion,
      recordings: [
        { ...recording, retired: true },
        { ...replacement, retired: false },
      ],
      illustrations: [{ wordId: WORD_ID, hash: hashOf('b'), size: 40_000, retired: false }],
    });
  });

  it('writes nothing for a media file the Word already has live', async () => {
    const { client, media } = await contentBackend();
    const illustration = { wordId: WORD_ID, hash: hashOf('b'), size: 40_000 };
    await media.saveIllustration('uk', illustration);
    const { contentVersion } = await snapshotOf(client);

    await media.saveIllustration('uk', illustration);
    expect(patchIn(await patchOf(client, contentVersion))).toMatchObject({
      contentVersion,
      illustrations: [],
    });
  });

  it('answers a Patch format it does not serve as unsupported', async () => {
    const { client } = await contentBackend();
    const answer = await client.content.patch({
      params: { editionId: 'uk' },
      query: { since: 0, patchFormat: PATCH_FORMAT + 1 },
    });
    expect(answer).toMatchObject({
      status: 200,
      body: { status: 'unsupported-format', patchFormat: PATCH_FORMAT },
    });
    // The format before media rows: an app of it keeps its content.
    expect(PATCH_FORMAT).toBe(2);
    await expect(
      client.content.patch({ params: { editionId: 'uk' }, query: { since: 0, patchFormat: 1 } }),
    ).resolves.toMatchObject({
      status: 200,
      body: { status: 'unsupported-format', patchFormat: 2 },
    });
  });

  it('answers NOT_FOUND while content updates are off, the content is not imported or the Edition is unknown', async () => {
    const off = await contentBackend();
    await off.kill('uk', 'contentUpdates');
    await expect(patchOf(off.client, 0)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const notImported = await contentBackend({ imported: false });
    await expect(patchOf(notImported.client, 0)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      off.client.content.patch({
        params: { editionId: 'xx' },
        query: { since: 0, patchFormat: PATCH_FORMAT },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
