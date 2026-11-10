import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IllustrationRow, RecordingRow, Word } from '@slovo/contracts';
import { PATCH_FORMAT, type Patch } from '@slovo/contracts/api';
import { createContentUpdate, openMistakeReports, systemRandom } from '@slovo/core';
import {
  createFakeBackend,
  seedUserState,
  createEntries,
  EVERYTHING_IN,
} from '@slovo/core/testing';
import {
  buildFromSnapshot,
  openLanguagePack,
  readEdition,
  type NodeLanguagePack,
} from '@slovo/language-pack';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { fakeClock, ukrainian, ukrainianFolder } from '../test-support';
import { openPackContentStore } from './pack-content-store';

// Patches the app fetches and applies to the UA Language Pack open on the device (ADR 0090).

const today = new Date('2026-11-08T09:00:00Z');
const read = readEdition(ukrainianFolder.dir, { registryRequired: true, today }).valid;
if (read === undefined) throw new Error('The Ukrainian Edition does not read');
const { content } = read;

let dir: string;
let builtFile: string;
const opened: NodeLanguagePack[] = [];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'slovo-patch-update-'));
  builtFile = join(dir, 'built.db');
  const built = buildFromSnapshot({
    editionDir: ukrainianFolder.dir,
    snapshot: {
      editionId: content.editionId,
      contentVersion: content.contentVersion,
      words: [...content.words],
      idioms: [...content.idioms],
      corrections: [...content.corrections],
      tips: [...content.tips],
      synonymRows: [...content.synonymRows],
      curatedCollections: [...(content.curatedCollections ?? [])],
      crosswordDays: [...(content.crosswordDays ?? [])],
      mediaBase: 'https://media.slovo.test',
      recordings: [],
      illustrations: [],
      // Read once the test runs: the Words are picked below.
      needsNewRecording: [second?.id ?? ''],
    },
    outFile: builtFile,
    today,
  });
  if (!built.ok) throw new Error('No UA pack');
});

afterEach(() => {
  for (const pack of opened.splice(0)) pack.close();
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const [first, second] = content.words.filter((word) => !word.retired);
if (first === undefined || second === undefined) throw new Error('The UA Edition has no Words');

function patchOf(records: Partial<Patch>): Patch {
  return {
    editionId: content.editionId,
    since: content.contentVersion,
    contentVersion: content.contentVersion + 1,
    patchFormat: PATCH_FORMAT,
    words: [],
    idioms: [],
    corrections: [],
    tips: [],
    synonymRows: [],
    curatedCollections: [],
    crosswordDays: [],
    mediaBase: 'https://media.slovo.test',
    recordings: [],
    illustrations: [],
    ...records,
  };
}

const changed = (word: Word): Word => ({
  ...word,
  primaryDefinition: 'Нове значення.',
  extraDefinitions: [],
});

/** The tries again wait for nothing. */
const now = (run: () => void) => {
  run();
  return () => undefined;
};

let copies = 0;
/** The app on a device with a fresh copy of the built pack open, and the backend. */
async function device({ readableFormats = [PATCH_FORMAT] } = {}) {
  copies += 1;
  const file = join(dir, `pack-${String(copies)}.db`);
  copyFileSync(builtFile, file);
  const pack = openLanguagePack(file, { writable: true });
  opened.push(pack);
  const api = createFakeBackend();
  const store = await openPackContentStore(pack.writer);
  const contentUpdate = createContentUpdate({
    backend: api.backend,
    edition: ukrainian,
    store,
    random: systemRandom,
    schedule: now,
    readableFormats,
  });
  // A Patch makes new Entries: the next read sees the patched records.
  const entries = () =>
    createEntries({ content: pack, edition: ukrainian, choices: EVERYTHING_IN });
  return { api, pack, contentUpdate, entries };
}

const hashOf = (digit: string) => digit.repeat(64);

const recording = (wordId: string, hash: string, retired = false): RecordingRow => ({
  wordId,
  narratorVoice: 'oksana',
  recordingKind: 'plain',
  hash,
  size: 20_480,
  durationMs: 900,
  retired,
});

const illustration = (wordId: string, hash: string, retired = false): IllustrationRow => ({
  wordId,
  hash,
  size: 51_200,
  retired,
});

describe('the media rows of a Patch', () => {
  it('answers the live Recording and Illustration rows of a Word by its id', async () => {
    const { api, contentUpdate } = await device();
    api.content.publishPatch(
      patchOf({
        recordings: [recording(first.id, hashOf('a')), recording(second.id, hashOf('b'))],
        illustrations: [illustration(first.id, hashOf('c'))],
      }),
    );

    await contentUpdate.checkForUpdate();

    expect(await contentUpdate.mediaOf(first.id)).toEqual({
      mediaBase: 'https://media.slovo.test',
      needsNewRecording: false,
      recordings: [
        {
          wordId: first.id,
          narratorVoice: 'oksana',
          recordingKind: 'plain',
          hash: hashOf('a'),
          size: 20_480,
          durationMs: 900,
        },
      ],
      illustrations: [{ wordId: first.id, hash: hashOf('c'), size: 51_200 }],
    });
    expect((await contentUpdate.mediaOf(second.id)).needsNewRecording).toBe(true);
  });

  it('takes a retired row out of the live set and keeps the one that replaced it', async () => {
    const { api, contentUpdate } = await device();
    api.content.publishPatch(patchOf({ recordings: [recording(first.id, hashOf('a'))] }));
    await contentUpdate.checkForUpdate();
    api.content.publishPatch(
      patchOf({
        since: content.contentVersion + 1,
        contentVersion: content.contentVersion + 2,
        recordings: [recording(first.id, hashOf('a'), true), recording(first.id, hashOf('d'))],
        illustrations: [],
      }),
    );

    await contentUpdate.checkForUpdate();

    const { recordings } = await contentUpdate.mediaOf(first.id);
    expect(recordings.map(({ hash }) => hash)).toEqual([hashOf('d')]);
  });

  it('answers none for a Word without media', async () => {
    const { contentUpdate } = await device();

    expect(await contentUpdate.mediaOf(first.id)).toMatchObject({
      recordings: [],
      illustrations: [],
    });
  });

  it('leaves the content as it was when the app reads only the old format', async () => {
    const { api, contentUpdate, entries } = await device({ readableFormats: [PATCH_FORMAT - 1] });
    api.content.publishPatch(
      patchOf({ words: [changed(first)], recordings: [recording(first.id, hashOf('a'))] }),
    );

    await contentUpdate.checkForUpdate();

    expect(await entries().get(first.id)).toMatchObject({
      primaryDefinition: first.primaryDefinition,
    });
    expect(await contentUpdate.mediaOf(first.id)).toMatchObject({
      recordings: [],
      illustrations: [],
    });
    expect(contentUpdate.contentVersion()).toBe(content.contentVersion);
  });
});

describe('a Patch applied to the open Language Pack', () => {
  it('changes a record at once, read by its id', async () => {
    const { api, contentUpdate, entries } = await device();
    api.content.publishPatch(patchOf({ words: [changed(first)] }));

    await contentUpdate.checkForUpdate();

    expect(await entries().get(first.id)).toMatchObject({ primaryDefinition: 'Нове значення.' });
    expect(contentUpdate.contentVersion()).toBe(content.contentVersion + 1);
  });

  it('takes a retired Word out of what the app shows', async () => {
    const { api, contentUpdate, entries } = await device();
    expect((await entries().eligibleWordsOfAnyRarity()).map(({ id }) => id)).toContain(first.id);
    api.content.publishPatch(patchOf({ words: [{ ...first, retired: true }] }));

    await contentUpdate.checkForUpdate();

    expect((await entries().eligibleWordsOfAnyRarity()).map(({ id }) => id)).not.toContain(
      first.id,
    );
  });

  it('changes nothing when a record fails half-way', async () => {
    const { api, pack, contentUpdate, entries } = await device();
    // Two stress marks on one position break the key of `word_stress`.
    const broken: Word = { ...second, stress: [0, 0] };
    api.content.publishPatch(patchOf({ words: [changed(first), broken] }));

    await contentUpdate.checkForUpdate();

    expect(await pack.getEntries([first.id])).toEqual([first]);
    expect(await entries().get(first.id)).toMatchObject({
      primaryDefinition: first.primaryDefinition,
    });
    expect(contentUpdate.contentVersion()).toBe(content.contentVersion);
  });

  it('gives a later Mistake Report the content version the Patch brought', async () => {
    const { api, contentUpdate } = await device();
    const mistakeReports = openMistakeReports({
      userState: await seedUserState(),
      backend: api.backend,
      edition: ukrainian,
      appVersion: '1.0.0',
      contentVersion: () => contentUpdate.contentVersion(),
      clock: fakeClock().clock,
      schedule: now,
      random: systemRandom,
    });
    api.content.publishPatch(patchOf({ words: [changed(first)] }));

    await contentUpdate.checkForUpdate();
    await mistakeReports.report({ entryId: first.id, type: 'typo', comment: 'Хиба' });

    expect(api.reports.received).toEqual([
      expect.objectContaining({ entryId: first.id, contentVersion: content.contentVersion + 1 }),
    ]);
  });
});
