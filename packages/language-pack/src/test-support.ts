import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checksumOf } from '@slovo/content-rules';

import type { ContentSnapshot } from '@slovo/contracts/api';
import { loadEdition } from '@slovo/core';

import { buildFromSnapshot, type BuildResult } from './build';
import { crosswordDaysChecksum } from './crossword-days';
import { CROSSWORD_DAYS_FILE, EDITIONS_DIR, openEdition } from './edition-folder';
import { MANIFEST_FILE } from './content-manifest';
import { ID_REGISTRY_FILE } from './id-registry';
import { readEditionWithSnapshot } from './read-edition';
import { readSnapshotFile } from './snapshot-source';

// Helpers the Language Pack tests share. No module of the package imports them.

/** The UA Edition's folder. */
export const ukrainianFolder = openEdition(EDITIONS_DIR, 'uk');

/** The UA Edition, loaded by the Core from its config file as the app loads it. */
export const ukrainian = loadEdition(
  JSON.parse(readFileSync(ukrainianFolder.path('config'), 'utf8')) as unknown,
);

/**
 * The UA Edition's seed snapshot: the committed slice of the backend's
 * snapshot an empty database is seeded from, read as the import reads it.
 */
export function ukrainianSnapshot(): ContentSnapshot {
  return readSnapshotFile(join(ukrainianFolder.dir, 'seed-snapshot.json'));
}

/** Builds the UA Language Pack as the app build does: the folder's config and assets, the seed snapshot's records. */
export function buildUkrainianPack(outFile: string): BuildResult {
  return buildFromSnapshot({
    editionDir: ukrainianFolder.dir,
    snapshot: ukrainianSnapshot(),
    outFile,
  });
}

/** The folder of an Edition's content each kind of record of a snapshot is authored in. */
const CONTENT_FOLDERS = {
  words: 'content/words',
  idioms: 'content/idioms',
  corrections: 'content/corrections',
  tips: 'content/tips',
  synonymRows: 'content/synonym-rows',
  curatedCollections: 'content/curated-collections',
} as const;

/**
 * A copy of the UA Edition's folder under `dir` whose content folder holds the
 * seed snapshot's records and crossword days, recorded at its content
 * version: for the tests of what still reads an Edition folder (`--record`,
 * the Daily Crossword), so that none reads the Edition's own content folder.
 */
export function ukrainianSeedFolder(dir: string): string {
  const editionDir = join(dir, 'uk');
  const skipped = new Set(
    ['content', 'dist', 'seed-snapshot.json'].map((name) => join(ukrainianFolder.dir, name)),
  );
  cpSync(ukrainianFolder.dir, editionDir, {
    recursive: true,
    filter: (from) => !skipped.has(from),
  });
  const snapshot = ukrainianSnapshot();
  const writeJson = (file: string, value: unknown) => {
    writeFileSync(join(editionDir, file), `${JSON.stringify(value, null, 2)}\n`);
  };
  const ids: string[] = [];
  for (const [kind, folder] of Object.entries(CONTENT_FOLDERS)) {
    mkdirSync(join(editionDir, folder), { recursive: true });
    for (const record of snapshot[kind as keyof typeof CONTENT_FOLDERS]) {
      // A content file names no kind: its folder does.
      const file = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'kind'));
      writeJson(join(folder, `${record.id}.json`), file);
      ids.push(record.id);
    }
  }
  writeJson(CROSSWORD_DAYS_FILE, snapshot.crosswordDays);
  writeJson(ID_REGISTRY_FILE, ids.toSorted());
  const read = readEditionWithSnapshot(editionDir, snapshot, { today: new Date() });
  if (read.valid === undefined) throw new Error('The seed snapshot does not read');
  writeJson(MANIFEST_FILE, {
    contentVersion: snapshot.contentVersion,
    contentChecksum: checksumOf(read.valid.content),
    crosswordDaysChecksum: crosswordDaysChecksum(snapshot.crosswordDays),
  });
  return editionDir;
}

/**
 * A font file with a glyph for each of the given characters and no other:
 * the smallest TrueType file a character map can be read from, a `cmap`
 * table alone with one format 4 subtable. Characters outside the Basic
 * Multilingual Plane are not supported.
 */
export function fontWith(characters: string): Buffer {
  const codes = [...new Set(Array.from(characters, (character) => character.charCodeAt(0)))].sort(
    (a, b) => a - b,
  );
  // One segment per character, mapping it to glyph 1, 2, … in turn, and the closing segment.
  const segments = [
    ...codes.map((code, index) => ({ code, delta: (index + 1 - code) & 0xffff })),
    { code: 0xffff, delta: 1 },
  ];
  const count = segments.length;
  const subtable = Buffer.alloc(16 + 8 * count);
  subtable.writeUInt16BE(4, 0);
  subtable.writeUInt16BE(subtable.length, 2);
  subtable.writeUInt16BE(2 * count, 6);
  segments.forEach(({ code, delta }, index) => {
    subtable.writeUInt16BE(code, 14 + 2 * index);
    subtable.writeUInt16BE(code, 16 + 2 * count + 2 * index);
    subtable.writeUInt16BE(delta, 16 + 4 * count + 2 * index);
  });
  const cmap = Buffer.alloc(12);
  cmap.writeUInt16BE(1, 2);
  cmap.writeUInt16BE(3, 4);
  cmap.writeUInt16BE(1, 6);
  cmap.writeUInt32BE(12, 8);
  const header = Buffer.alloc(28);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(1, 4);
  header.write('cmap', 12, 'latin1');
  header.writeUInt32BE(28, 20);
  header.writeUInt32BE(cmap.length + subtable.length, 24);
  return Buffer.concat([header, cmap, subtable]);
}
