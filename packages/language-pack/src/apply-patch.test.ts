import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Word } from '@slovo/contracts';
import { PATCH_FORMAT, type Patch } from '@slovo/contracts/api';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { applyPatch, openLanguagePack, patchStateOf, type NodeLanguagePack } from './index';
import { nodePackDatabase } from './read-pack';
import { buildUkrainianPack, ukrainianSnapshot } from './test-support';

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

  it('takes a retired Word out of the live ids and keeps it readable by id', async () => {
    const pack = writablePack();

    await applyPatch(pack.writer, patchOf({ words: [{ ...first, retired: true }] }), '"next"');

    expect(await pack.listIds('word')).not.toContain(first.id);
    expect(await pack.getEntries([first.id])).toMatchObject([{ id: first.id, retired: true }]);
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

  it('refuses a Patch that would lower the content version', async () => {
    const pack = writablePack();

    await expect(
      applyPatch(pack.writer, { ...patchOf(), contentVersion: snapshot.contentVersion - 1 }, '"x"'),
    ).rejects.toThrow(/lower/);
    expect((await pack.metadata()).contentVersion).toBe(snapshot.contentVersion);
  });
});
