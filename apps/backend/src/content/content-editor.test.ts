import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createHash } from 'node:crypto';

import { PATCH_FORMAT, type ApiClient } from '@slovo/contracts/api';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { ukrainianSeedFolder } from '@slovo/language-pack/test-support';
import { createAdminAccess, systemClock } from '@slovo/server-core';
import { afterAll, describe, expect, it, onTestFinished } from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { readEditions } from '../edition/edition-folders';
import { createDatabase } from '../database/database';
import { systemRandom } from '../random';
import {
  adminCommandDeps,
  createTestDatabase,
  png,
  signedInAdmin,
  silentLogger,
  TEST_MEDIA_BASE,
  testApp,
  testDatabaseUrl,
} from '../test-support';
import { createMediaRows } from './media-rows';

/** The UA Edition folder written from the seed snapshot, removed after the file. */
const folder = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-editor-'));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return ukrainianSeedFolder(dir);
})();

/** The backend with a Власник, an Агент and the UA Edition imported. */
async function editorBackend() {
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
  const imported = await backend.importContent('uk', folder);
  if (!imported.ok) throw new Error('the UA Edition did not import');
  return { ...backend, agent: backend.clientOf(token), store: createAdminStore(database) };
}

const WORD_ID = 'w_009orq';

async function wordOf(client: ApiClient) {
  const snapshot = await client.content.snapshot({ editionId: 'uk' });
  const word = snapshot.words.find((found) => found.id === WORD_ID);
  if (word === undefined) throw new Error(`no Word ${WORD_ID}`);
  return { word, contentVersion: snapshot.contentVersion };
}

describe('the content editor through an admin session', () => {
  it("publishes an Адмін's save with no reason and logs it with before and after", async () => {
    const backend = await editorBackend();
    const { email, client: adminClient } = await signedInAdmin(backend, 'admin');
    const { word, contentVersion } = await wordOf(backend.client);
    const { batchId } = await adminClient.admin.content.openBatch({ editionId: 'uk' });
    const { recordVersion } = await adminClient.admin.content.record({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
    });
    const primaryDefinition = 'Кільце з металу чи дерева.';

    const written = await adminClient.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion,
      fields: { ...word, primaryDefinition },
    });

    expect(written.contentVersion).toBe(contentVersion + 1);
    const after = await wordOf(backend.client);
    expect(after.word.primaryDefinition).toBe(primaryDefinition);
    expect(after.contentVersion).toBe(contentVersion + 1);
    const [action] = (await backend.store.actions('uk')).filter(
      (row) => row.what === 'content.word.edit',
    );
    expect(action).toMatchObject({
      who: { kind: 'admin-user', email },
      batchId,
      before: { fields: { primaryDefinition: word.primaryDefinition } },
      after: { fields: { primaryDefinition } },
    });
  });

  it('lists the records of a kind by a text query, and reads the Edition card', async () => {
    const backend = await editorBackend();
    const { client: adminClient } = await signedInAdmin(backend, 'owner');
    const { word } = await wordOf(backend.client);

    const { records } = await adminClient.admin.content.records({
      editionId: 'uk',
      kind: 'word',
      query: word.lemma,
    });
    expect(records).toContainEqual({
      id: WORD_ID,
      label: word.lemma,
      retired: false,
      recordVersion: 1,
    });
    const card = await adminClient.admin.editionCard({ editionId: 'uk' });
    expect(card.id).toBe('uk');
    expect(card.displayName.length).toBeGreaterThan(0);
  });

  it('lists the records a page of 50 at a time, with the count of every match', async () => {
    const backend = await editorBackend();
    const { client: adminClient } = await signedInAdmin(backend, 'owner');
    const list = (page?: number) =>
      adminClient.admin.content.records({
        editionId: 'uk',
        kind: 'word',
        ...(page === undefined ? {} : { page }),
      });

    const first = await list();
    expect(first.records).toHaveLength(50);
    expect(first.total).toBeGreaterThan(100);
    const second = await list(2);
    expect(second.records).toHaveLength(50);
    expect(second.total).toBe(first.total);
    const firstIds = new Set(first.records.map((each) => each.id));
    expect(second.records.some((each) => firstIds.has(each.id))).toBe(false);
    expect(
      second.records[0]?.label.localeCompare(first.records[49]?.label ?? ''),
    ).toBeGreaterThanOrEqual(0);
    const last = Math.ceil(first.total / 50);
    expect((await list(last)).records).toHaveLength(first.total - (last - 1) * 50);
    expect((await list(last + 1)).records).toEqual([]);
  });

  it('refuses a session write without the admin header, and an Агент still writes', async () => {
    const backend = await editorBackend();
    const { cookie } = await signedInAdmin(backend, 'admin');
    const response = await backend.request('/v1/admin/content/uk/batches', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: '{}',
    });
    expect(response.status).toBe(403);

    const { batchId } = await backend.agent.admin.content.openBatch({ editionId: 'uk' });
    expect(batchId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

const illustrationPatch = async (client: ApiClient, since: number) => {
  const answer = await client.content.patch({
    params: { editionId: 'uk' },
    query: { since, patchFormat: PATCH_FORMAT },
  });
  if (answer.status !== 200 || answer.body.status !== 'patch') throw new Error('no Patch');
  return answer.body.patch.illustrations;
};

describe("a Word's Illustration uploaded in the content editor", () => {
  it('refuses a file that breaks a rule with the name of the rule, and writes nothing', async () => {
    const backend = await editorBackend();
    const { client: owner } = await signedInAdmin(backend, 'owner');
    const { contentVersion } = await wordOf(backend.client);
    const upload = (bytes: Buffer) =>
      owner.admin.content.uploadIllustration({
        editionId: 'uk',
        id: WORD_ID,
        png: bytes.toString('base64'),
      });
    const refusedBy = (rule: string) => ({
      code: 'REFUSED',
      data: {
        refusals: [expect.objectContaining({ rule, field: 'illustration', entryId: WORD_ID })],
      },
    });

    await expect(upload(png(640, 480))).rejects.toMatchObject(refusedBy('illustration-square'));
    const tooLarge = png(512, 512, 151_000);
    await expect(upload(tooLarge)).rejects.toMatchObject(refusedBy('illustration-size'));
    await expect(upload(Buffer.from('GIF89a, not a PNG'))).rejects.toMatchObject(
      refusedBy('illustration-png'),
    );

    expect((await wordOf(backend.client)).contentVersion).toBe(contentVersion);
    expect(await illustrationPatch(backend.client, contentVersion - 1)).toEqual([]);
    expect(
      await backend.mediaStore.head(`illustrations/${WORD_ID}.${sha256(tooLarge)}.png`),
    ).toBeUndefined();
  });

  it('keeps a valid PNG in the Media Store, retires the one it replaces and publishes both in the Patch', async () => {
    const backend = await editorBackend();
    const { client: owner } = await signedInAdmin(backend, 'owner');
    const first = png(512, 512, 2_000, 1);
    const second = png(256, 256, 3_000, 2);
    const upload = (bytes: Buffer) =>
      owner.admin.content.uploadIllustration({
        editionId: 'uk',
        id: WORD_ID,
        png: bytes.toString('base64'),
      });
    const { contentVersion: before } = await wordOf(backend.client);

    const uploaded = await upload(first);
    expect(uploaded.contentVersion).toBe(before + 1);
    const replaced = await upload(second);

    expect(replaced).toEqual({
      contentVersion: before + 2,
      illustration: {
        hash: sha256(second),
        url: `${TEST_MEDIA_BASE}/illustrations/${WORD_ID}.${sha256(second)}.png`,
      },
    });
    expect(await backend.mediaStore.head(`illustrations/${WORD_ID}.${sha256(second)}.png`)).toEqual(
      { size: 3_000, contentType: 'image/png' },
    );
    expect(await illustrationPatch(backend.client, before + 1)).toEqual([
      { wordId: WORD_ID, hash: sha256(first), size: 2_000, retired: true },
      { wordId: WORD_ID, hash: sha256(second), size: 3_000, retired: false },
    ]);
    const record = await owner.admin.content.record({ editionId: 'uk', kind: 'word', id: WORD_ID });
    expect(record.illustration).toEqual(replaced.illustration);
  });

  it('refuses an Illustration for a Word the Edition lacks', async () => {
    const backend = await editorBackend();
    const { client: owner } = await signedInAdmin(backend, 'owner');
    await expect(
      owner.admin.content.uploadIllustration({
        editionId: 'uk',
        id: 'w_zzzzzz',
        png: png(512, 512).toString('base64'),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('the media gaps in the content report', () => {
  it('counts the live Words without a Recording per Narrator Voice and without an Illustration', async () => {
    const backend = await editorBackend();
    const { client: owner } = await signedInAdmin(backend, 'owner');
    const voices = readEditions(EDITIONS_DIR)
      .find(({ config }) => config.id === 'uk')
      ?.config.narratorVoices.voices.map(({ id }) => id);
    if (voices === undefined) throw new Error('no UA Edition');
    const [voice] = voices;
    if (voice === undefined) throw new Error('no Narrator Voice');
    const { report } = await owner.admin.content.report({ editionId: 'uk' });
    expect(report.media).toEqual({
      withoutRecording: voices.map((narratorVoice) => ({ narratorVoice, words: report.words })),
      withoutIllustration: report.words,
    });

    await createMediaRows({ database: backend.database, clock: systemClock }).saveRecording('uk', {
      wordId: WORD_ID,
      narratorVoice: voice,
      recordingKind: 'plain',
      hash: 'a'.repeat(64),
      size: 8_000,
      durationMs: 900,
    });
    await owner.admin.content.uploadIllustration({
      editionId: 'uk',
      id: WORD_ID,
      png: png(512, 512).toString('base64'),
    });

    const after = (await owner.admin.content.report({ editionId: 'uk' })).report;
    expect(after.media.withoutIllustration).toBe(report.words - 1);
    expect(after.media.withoutRecording).toContainEqual({
      narratorVoice: voice,
      words: report.words - 1,
    });
  });
});
