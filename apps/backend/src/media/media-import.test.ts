import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PATCH_FORMAT, type ApiClient } from '@slovo/contracts/api';
import type { Word } from '@slovo/contracts';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { ukrainianSeedFolder } from '@slovo/language-pack/test-support';
import { systemClock } from '@slovo/server-core';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';

import { createDatabase } from '../database/database';
import { readEditions } from '../edition/edition-folders';
import { RECORDING_TEXTS } from '../recordings/recording-text';
import { importedDatabases, png, silentLogger, testApp } from '../test-support';
import { createMediaImport } from './media-import';
import { memoryMediaStore, type MediaStore } from './media-store';
import { mp3Of } from './test-mp3';

const edition = (() => {
  const found = readEditions(EDITIONS_DIR).find(({ config }) => config.id === 'uk');
  if (found === undefined) throw new Error('no UA Edition');
  return found;
})();

/** The UA Edition folder written from the seed snapshot, removed after the file. */
const seedDir = mkdtempSync(join(tmpdir(), 'slovo-media-import-'));
afterAll(() => {
  rmSync(seedDir, { recursive: true, force: true });
});
const importedDatabase = importedDatabases('uk', ukrainianSeedFolder(seedDir));

/** A Media Store that keeps what it was given. */
function keptStore(): MediaStore & { readonly files: Map<string, string> } {
  const inner = memoryMediaStore();
  const files = new Map<string, string>();
  return {
    files,
    async put(key, bytes, type) {
      files.set(key, type);
      await inner.put(key, bytes, type);
    },
    delete: (key) => inner.delete(key),
    head: (key) => inner.head(key),
  };
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** A small Edition media folder, removed after the test: its recordings and illustrations. */
function mediaFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-media-import-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const texts = new Map<string, Record<string, string>>();
  const write = (path: string, bytes: Uint8Array | string) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), bytes);
  };
  return {
    dir,
    /** Puts a Recording of the Word in the voice, which read the text (the Word's own by default). */
    recording(voice: string, word: Word, bytes: Uint8Array, text = RECORDING_TEXTS.plain(word)) {
      write(`assets/recordings/${voice}/${word.id}.mp3`, bytes);
      const voiceTexts = texts.get(voice) ?? {};
      texts.set(voice, { ...voiceTexts, [word.id]: text });
      write(`assets/recordings/${voice}/texts.json`, JSON.stringify(texts.get(voice)));
    },
    illustration(name: string, bytes: Uint8Array) {
      write(`assets/illustrations/${name}`, bytes);
    },
    /** Puts any file at the path in the folder. */
    file(path: string, text: string) {
      write(path, text);
    },
  };
}

async function patchSince(client: ApiClient, since: number) {
  const answer = await client.content.patch({
    params: { editionId: 'uk' },
    query: { since, patchFormat: PATCH_FORMAT },
  });
  if (answer.status !== 200 || answer.body.status !== 'patch') {
    throw new Error(`no Patch: ${JSON.stringify(answer)}`);
  }
  return answer.body.patch;
}

/** The backend on a database of its own with the UA content imported, and the import over a Media Store. */
async function importBackend() {
  const own = await importedDatabase();
  onTestFinished(() => own.drop());
  const database = createDatabase(own.url, silentLogger);
  onTestFinished(() => database.close());
  const { client } = testApp({ database });
  const store = keptStore();
  const snapshot = await client.content.snapshot({ editionId: 'uk' });
  const illustrated = snapshot.words.find((word) => word.illustration !== undefined);
  const [first, second] = snapshot.words.filter((word) => word !== illustrated);
  if (illustrated?.illustration === undefined || first === undefined || second === undefined) {
    throw new Error('the UA Edition has too few Words');
  }
  const run = (dir: string, force = false) =>
    createMediaImport({ database, clock: systemClock, store }).run(edition, dir, { force });
  return {
    client,
    store,
    run,
    contentVersion: snapshot.contentVersion,
    words: {
      first,
      second,
      illustrated: { ...illustrated, illustration: illustrated.illustration },
    },
  };
}

describe('the media import', () => {
  // The template database imports the Edition once, before the first test.
  beforeAll(async () => {
    await (await importedDatabase()).drop();
  }, 180_000);

  it('writes one row per file with its voice, Word id, hash, size and length at one content version', async () => {
    const { client, store, run, contentVersion, words } = await importBackend();
    const folder = mediaFolder();
    const oksana = mp3Of(24, 'oksana');
    const taras = mp3Of(30, 'taras');
    const second = mp3Of(10, 'second');
    const picture = png(512, 512);
    folder.recording('oksana', words.first, oksana);
    folder.recording('taras', words.first, taras);
    folder.recording('oksana', words.second, second);
    folder.illustration(words.illustrated.illustration, picture);

    const imported = await run(folder.dir);

    expect(imported).toEqual({
      ok: true,
      recordings: 3,
      illustrations: 1,
      stale: 0,
      contentVersion: contentVersion + 1,
    });
    const patch = await patchSince(client, contentVersion);
    expect(patch.contentVersion).toBe(contentVersion + 1);
    expect(patch.recordings).toEqual(
      [
        { word: words.first, voice: 'oksana', bytes: oksana, durationMs: 506 },
        { word: words.first, voice: 'taras', bytes: taras, durationMs: 650 },
        { word: words.second, voice: 'oksana', bytes: second, durationMs: 170 },
      ]
        .map(({ word, voice, bytes, durationMs }) => ({
          wordId: word.id,
          narratorVoice: voice,
          recordingKind: 'plain',
          hash: sha256(bytes),
          size: bytes.byteLength,
          durationMs,
          retired: false,
        }))
        .sort((a, b) => a.wordId.localeCompare(b.wordId)),
    );
    expect(patch.illustrations).toEqual([
      {
        wordId: words.illustrated.id,
        hash: sha256(picture),
        size: picture.byteLength,
        retired: false,
      },
    ]);
    expect(store.files).toEqual(
      new Map([
        [`recordings/oksana/plain/${words.first.id}.${sha256(oksana)}.mp3`, 'audio/mpeg'],
        [`recordings/taras/plain/${words.first.id}.${sha256(taras)}.mp3`, 'audio/mpeg'],
        [`recordings/oksana/plain/${words.second.id}.${sha256(second)}.mp3`, 'audio/mpeg'],
        [`illustrations/${words.illustrated.id}.${sha256(picture)}.png`, 'image/png'],
      ]),
    );
  });

  it('leaves out a Recording whose recorded text is no longer its Word’s, for the Recordings job to record again', async () => {
    const { client, run, contentVersion, words } = await importBackend();
    const folder = mediaFolder();
    folder.recording('oksana', words.first, mp3Of(5), 'стари́й текст');
    folder.recording('oksana', words.second, mp3Of(5));

    const imported = await run(folder.dir);

    expect(imported).toMatchObject({ ok: true, recordings: 1, stale: 1 });
    const patch = await patchSince(client, contentVersion);
    expect(patch.recordings.map(({ wordId }) => wordId)).toEqual([words.second.id]);
  });

  it('refuses a second run over the same Edition, and reruns with force', async () => {
    const { client, run, contentVersion, words } = await importBackend();
    const folder = mediaFolder();
    const before = mp3Of(5, 'before');
    folder.recording('oksana', words.first, before);
    await run(folder.dir);
    const after = mp3Of(5, 'after');
    folder.recording('oksana', words.first, after);

    expect(await run(folder.dir)).toEqual({ ok: false, reason: 'already-imported' });
    expect((await client.content.snapshot({ editionId: 'uk' })).contentVersion).toBe(
      contentVersion + 1,
    );

    expect(await run(folder.dir, true)).toMatchObject({
      ok: true,
      recordings: 1,
      contentVersion: contentVersion + 2,
    });
    const patch = await patchSince(client, contentVersion + 1);
    expect(patch.recordings.map(({ hash, retired }) => ({ hash, retired }))).toEqual([
      { hash: sha256(before), retired: true },
      { hash: sha256(after), retired: false },
    ]);
  });

  it('refuses a folder with an undeclared voice, an unknown Word id, an Illustration no Word names or a file that is no mp3, and writes nothing', async () => {
    const { client, store, run, contentVersion, words } = await importBackend();
    const folder = mediaFolder();
    folder.recording('oksana', words.first, mp3Of(5));
    folder.recording('nobody', words.first, mp3Of(5));
    folder.recording('oksana', { ...words.second, id: 'w_nosuch' }, mp3Of(5));
    folder.recording('taras', words.second, new TextEncoder().encode('no mp3'));
    folder.illustration('nobody.png', new TextEncoder().encode('a png'));

    expect(await run(folder.dir)).toEqual({
      ok: false,
      reason: 'refused',
      problems: [
        'assets/recordings/nobody: no Narrator Voice "nobody" in the Edition',
        'assets/recordings/oksana/w_nosuch.mp3: no Word w_nosuch in the Edition',
        `assets/recordings/taras/${words.second.id}.mp3: not an mp3`,
        'assets/illustrations/nobody.png: no Word names this Illustration',
      ],
    });
    expect(store.files.size).toBe(0);
    expect((await client.content.snapshot({ editionId: 'uk' })).contentVersion).toBe(
      contentVersion,
    );
  });

  it('refuses a folder whose Illustration breaks a content rule or whose texts.json is no JSON, and writes nothing', async () => {
    const { client, store, run, contentVersion, words } = await importBackend();
    const folder = mediaFolder();
    folder.recording('oksana', words.first, mp3Of(5));
    folder.file('assets/recordings/taras/texts.json', '{ not json');
    folder.illustration(words.illustrated.illustration, png(640, 480));

    expect(await run(folder.dir)).toEqual({
      ok: false,
      reason: 'refused',
      problems: [
        'assets/recordings/taras/texts.json: not JSON',
        `assets/illustrations/${words.illustrated.illustration}: The picture is 640×480 px, not square`,
      ],
    });
    expect(store.files.size).toBe(0);
    expect((await client.content.snapshot({ editionId: 'uk' })).contentVersion).toBe(
      contentVersion,
    );
  });
});
