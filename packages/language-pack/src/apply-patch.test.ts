import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { CuratedCollection, RecordingRow, Word } from '@slovo/contracts';
import { PATCH_FORMAT, type Patch } from '@slovo/contracts/api';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildFromSnapshot } from './build';
import { applyPatch, openLanguagePack, patchStateOf, type NodeLanguagePack } from './index';
import { mediaOf } from './media-rows';
import { nodePackDatabase } from './read-pack';
import { buildUkrainianPack, ukrainianFolder, ukrainianSnapshot } from './test-support';

// Patches applied to the UA Language Pack opened writable, as the app's pack is (ADR 0090).

let dir: string;
let builtFile: string;
const snapshot = ukrainianSnapshot();
const opened: NodeLanguagePack[] = [];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'slovo-apply-patch-'));
  builtFile = join(dir, 'built.db');
  if (!buildUkrainianPack(builtFile).ok) throw new Error('No UA pack');
});

afterEach(() => {
  for (const pack of opened.splice(0)) pack.close();
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let copies = 0;
/** A fresh writable copy of the built pack. */
function writablePack(): NodeLanguagePack {
  copies += 1;
  const file = join(dir, `pack-${String(copies)}.db`);
  copyFileSync(builtFile, file);
  const pack = openLanguagePack(file, { writable: true });
  opened.push(pack);
  return pack;
}

/** Two live Words of the snapshot. */
const [first, second] = snapshot.words.filter((word) => !word.retired);
if (first === undefined || second === undefined) throw new Error('The UA snapshot has no Words');

function patchOf(records: Partial<Patch> = {}): Patch {
  return {
    editionId: snapshot.editionId,
    since: snapshot.contentVersion,
    contentVersion: snapshot.contentVersion + 1,
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
  primaryDefinition: 'A new meaning.',
  extraDefinitions: [],
  examples: [{ text: 'A new example.' }],
});

describe('applying a Patch', () => {
  it('drops the content checksum of the built pack, which no longer names its content', async () => {
    const pack = writablePack();
    expect((await pack.metadata()).contentChecksum).toBeDefined();

    await applyPatch(pack.writer, patchOf({ words: [changed(first)] }), '"next"');

    const metadata = await pack.metadata();
    expect(metadata.contentVersion).toBe(snapshot.contentVersion + 1);
    expect(metadata.contentChecksum).toBeUndefined();
  });

  it('replaces a changed Word, its child rows too, and moves the content version and ETag on', async () => {
    const pack = writablePack();

    await applyPatch(pack.writer, patchOf({ words: [changed(first)] }), '"next"');

    const [read] = await pack.getEntries([first.id]);
    expect(read).toMatchObject({
      id: first.id,
      primaryDefinition: 'A new meaning.',
      extraDefinitions: [],
      examples: [{ text: 'A new example.' }],
    });
    expect((await pack.metadata()).contentVersion).toBe(snapshot.contentVersion + 1);
  });

  it('keeps the ETag of the Patch applied last', async () => {
    const pack = writablePack();
    const file = join(dir, `pack-${String(copies)}.db`);

    await applyPatch(pack.writer, patchOf(), '"next"');

    const db = new DatabaseSync(file, { readOnly: true });
    expect(await patchStateOf(nodePackDatabase(db))).toEqual({
      editionId: snapshot.editionId,
      contentVersion: snapshot.contentVersion + 1,
      etag: '"next"',
    });
    db.close();
  });

  it('adds a new Word', async () => {
    const pack = writablePack();
    const added: Word = { ...first, id: 'w_patchadded', lemma: 'новеньке' };

    await applyPatch(pack.writer, patchOf({ words: [added] }), '"next"');

    expect(await pack.getEntries([added.id])).toEqual([added]);
    expect(await pack.listIds('word')).toContain(added.id);
  });

  it('retires a Word with the Word that replaces it, and lists the two', async () => {
    const pack = writablePack();
    const [, second] = snapshot.words;
    if (second === undefined) throw new Error('The fixture has two Words');
    const replaced: Word = { ...first, retired: true, replacedBy: second.id };
    expect(await pack.listReplacedWords()).toEqual([]);

    await applyPatch(pack.writer, patchOf({ words: [replaced] }), '"next"');

    expect(await pack.getEntries([first.id])).toEqual([replaced]);
    expect(await pack.listReplacedWords()).toEqual([{ id: first.id, replacedBy: second.id }]);
  });

  it('brings a Word its Short Definition and takes it away again', async () => {
    const pack = writablePack();
    const short: Word = { ...first, shortDefinition: 'A short meaning.' };

    await applyPatch(pack.writer, patchOf({ words: [short] }), '"next"');
    expect(await pack.getEntries([first.id])).toEqual([short]);

    await applyPatch(
      pack.writer,
      patchOf({
        since: snapshot.contentVersion + 1,
        contentVersion: snapshot.contentVersion + 2,
        words: [first],
      }),
      '"after"',
    );
    expect(await pack.getEntries([first.id])).toEqual([first]);
  });

  it('keeps a pack with a Short Definition in the shape the build before it reads', async () => {
    const pack = writablePack();
    const file = join(dir, `pack-${String(copies)}.db`);
    await applyPatch(
      pack.writer,
      patchOf({ words: [{ ...first, shortDefinition: 'A short meaning.' }] }),
      '"next"',
    );

    // What the build before reads of a Word: the pack format, its columns by name and its Definitions in order.
    const db = new DatabaseSync(file, { readOnly: true });
    const read = <T>(sql: string) => nodePackDatabase(db).getAllAsync<T>(sql, [first.id]);
    expect((await pack.metadata()).packFormat).toBe(14);
    expect(
      await read(
        'SELECT lemma, part_of_speech, gender, category_id, rarity, etymology, region, history, origin, illustration, retired FROM words WHERE id = ?',
      ),
    ).toEqual([expect.objectContaining({ lemma: first.lemma, retired: 0 })]);
    expect(await read('SELECT text FROM definitions WHERE word_id = ? ORDER BY position')).toEqual(
      [first.primaryDefinition, ...first.extraDefinitions].map((text) => ({ text })),
    );
    db.close();
  });

  it('takes a retired Word out of the live ids and keeps it readable by id', async () => {
    const pack = writablePack();

    await applyPatch(pack.writer, patchOf({ words: [{ ...first, retired: true }] }), '"next"');

    expect(await pack.listIds('word')).not.toContain(first.id);
    expect(await pack.getEntries([first.id])).toMatchObject([{ id: first.id, retired: true }]);
  });

  it('removes a Retired collection, row and Entries, and brings it back when it returns', async () => {
    const pack = writablePack();
    const collection: CuratedCollection = {
      id: 'cc_patchadded',
      name: 'Нова добірка',
      description: 'Добірка з Patch.',
      publishedOn: '2026-01-01',
      entryIds: [first.id, second.id],
      retired: false,
    };
    const next = (since: number, curatedCollections: CuratedCollection[]): Patch => ({
      ...patchOf({ curatedCollections }),
      since,
      contentVersion: since + 1,
    });
    const ids = async () => (await pack.listCuratedCollections()).map(({ id }) => id);
    const v = snapshot.contentVersion;

    await applyPatch(pack.writer, next(v, [collection]), '"1"');
    expect(await ids()).toContain(collection.id);

    await applyPatch(pack.writer, next(v + 1, [{ ...collection, retired: true }]), '"2"');
    expect(await ids()).not.toContain(collection.id);

    await applyPatch(pack.writer, next(v + 2, [collection]), '"3"');
    expect(await pack.listCuratedCollections()).toContainEqual(collection);
  });

  it('rolls the whole Patch back when a record fails half-way', async () => {
    const pack = writablePack();
    // Two stress marks on one position break the key of `word_stress`.
    const broken: Word = { ...second, stress: [0, 0] };

    await expect(
      applyPatch(pack.writer, patchOf({ words: [changed(first), broken] }), '"next"'),
    ).rejects.toThrow();

    expect(await pack.getEntries([first.id])).toEqual([first]);
    expect((await pack.metadata()).contentVersion).toBe(snapshot.contentVersion);
  });

  it('refuses a Patch of another Edition or from another content version', async () => {
    const pack = writablePack();

    await expect(applyPatch(pack.writer, { ...patchOf(), editionId: 'en' }, '"x"')).rejects.toThrow(
      /does not apply/,
    );
    await expect(
      applyPatch(pack.writer, { ...patchOf(), since: snapshot.contentVersion - 1 }, '"x"'),
    ).rejects.toThrow(/does not apply/);
    expect((await pack.metadata()).contentVersion).toBe(snapshot.contentVersion);
  });

  it('clears the mark of a Word whose new Recording the Patch brings, and keeps it on the others', async () => {
    const file = join(dir, 'marked.db');
    const built = buildFromSnapshot({
      editionDir: ukrainianFolder.dir,
      snapshot: { ...snapshot, needsNewRecording: [first.id, second.id].sort() },
      outFile: file,
    });
    if (!built.ok) throw new Error('No marked UA pack');
    const pack = openLanguagePack(file, { writable: true });
    opened.push(pack);
    const recording: RecordingRow = {
      wordId: first.id,
      narratorVoice: 'oksana',
      recordingKind: 'plain',
      hash: 'a'.repeat(64),
      size: 1000,
      durationMs: 900,
      retired: false,
    };

    await applyPatch(pack.writer, patchOf({ recordings: [recording] }), '"next"');

    const db = new DatabaseSync(file, { readOnly: true });
    const media = async (wordId: string) => mediaOf(nodePackDatabase(db), wordId);
    expect(await media(first.id)).toMatchObject({ needsNewRecording: false });
    expect((await media(first.id)).recordings).toContainEqual(
      expect.objectContaining({ hash: recording.hash }),
    );
    expect(await media(second.id)).toMatchObject({ needsNewRecording: true });
    db.close();
  });

  it('replaces the child rows of every Entry kind it brings again, never doubling them', async () => {
    const pack = writablePack();
    const live = <T extends { retired: boolean }>(rows: readonly T[]): T[] =>
      rows.filter((row) => !row.retired).slice(0, 1);
    const records = {
      corrections: live(snapshot.corrections),
      idioms: live(snapshot.idioms),
      synonymRows: live(snapshot.synonymRows),
      tips: live(snapshot.tips),
    };
    const ids = Object.values(records).flatMap((rows) => rows.map(({ id }) => id));
    expect(ids).toHaveLength(4);
    const before = await pack.getEntries(ids);

    await applyPatch(pack.writer, patchOf(records), '"again"');

    expect(await pack.getEntries(ids)).toEqual(before);
  });

  it('refuses every Patch on a pack opened read-only, the default', async () => {
    const pack = openLanguagePack(builtFile);
    opened.push(pack);

    await expect(applyPatch(pack.writer, patchOf(), '"x"')).rejects.toThrow(/readonly/);
    expect((await pack.metadata()).contentVersion).toBe(snapshot.contentVersion);
  });

  it('applies a Patch that keeps the content version, as it lowers nothing', async () => {
    const pack = writablePack();

    await applyPatch(
      pack.writer,
      { ...patchOf(), contentVersion: snapshot.contentVersion },
      '"same"',
    );

    expect((await pack.metadata()).contentVersion).toBe(snapshot.contentVersion);
  });

  it('refuses a Patch that would lower the content version', async () => {
    const pack = writablePack();

    await expect(
      applyPatch(pack.writer, { ...patchOf(), contentVersion: snapshot.contentVersion - 1 }, '"x"'),
    ).rejects.toThrow(/lower/);
    expect((await pack.metadata()).contentVersion).toBe(snapshot.contentVersion);
  });
});
