import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { FeatureSwitchStateSchema, featureSwitchStates } from '@slovo/contracts';
import type { ContentSnapshot } from '@slovo/contracts/api';
import { loadEdition } from '@slovo/core';
import { afterAll } from 'vitest';
import { z } from 'zod';

import { buildFromSnapshot, type BuildResult } from './build';
import { EDITIONS_DIR, openEditionWithoutRecords } from './edition-folder';
import { readSnapshotFile } from './snapshot-source';

// Helpers the Language Pack tests share. No module of the package imports them.

/** The UA Edition's folder. */
export const ukrainianFolder = openEditionWithoutRecords(EDITIONS_DIR, 'uk');

/** The UA Edition, loaded by the Core from its config file as the app loads it. */
export const ukrainian = loadEdition(
  JSON.parse(readFileSync(ukrainianFolder.path('config'), 'utf8')) as unknown,
);

/**
 * The UA Edition's seed snapshot file: the committed slice of the backend's
 * snapshot an empty database is seeded from. Tests across the repo read it,
 * here and in the content tools.
 */
export const UK_SEED_SNAPSHOT = join(ukrainianFolder.dir, 'seed-snapshot.json');

/** The UA Edition's seed snapshot, read fresh as the import reads it. */
export function ukrainianSnapshot(): ContentSnapshot {
  return readSnapshotFile(UK_SEED_SNAPSHOT);
}

/** A file of this package's `fixtures/`. */
export function fixtureFile(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}

const fixtureCopies = new Map<string, string>();

// The copies serve every test of the file that imports this module and go once it is done.
afterAll(() => {
  for (const dir of fixtureCopies.values()) rmSync(dirname(dir), { recursive: true, force: true });
  fixtureCopies.clear();
});

/**
 * The folder of a fixture Edition of this package's `fixtures/`, as an
 * Edition is read: a copy whose `edition.json` declares every Feature Switch,
 * `on` but those the fixture states (ADR 0199). Made once per name and
 * removed after the test file's tests.
 */
export function fixtureDir(name: string): string {
  const made = fixtureCopies.get(name);
  if (made !== undefined) return made;
  const dir = join(mkdtempSync(join(tmpdir(), 'slovo-fixture-')), name);
  cpSync(fixtureFile(name), dir, { recursive: true });
  const configFile = join(dir, 'edition.json');
  const config = z
    .looseObject({ featureSwitches: z.record(z.string(), FeatureSwitchStateSchema) })
    .parse(JSON.parse(readFileSync(configFile, 'utf8')));
  const featureSwitches = featureSwitchStates(config.featureSwitches);
  writeFileSync(configFile, `${JSON.stringify({ ...config, featureSwitches }, null, 2)}\n`);
  fixtureCopies.set(name, dir);
  return dir;
}

/**
 * The valid fixture Edition's seed snapshot: its records, as the backend
 * serves them, read fresh as the import reads it. The folder gives the
 * config and assets alone (ADR 0153).
 */
export function validSnapshot(): ContentSnapshot {
  return readSnapshotFile(join(fixtureDir('valid'), 'seed-snapshot.json'));
}

/** Builds the UA Language Pack as the app build does: the folder's config and assets, the seed snapshot's records. */
export function buildUkrainianPack(outFile: string): BuildResult {
  return buildFromSnapshot({
    editionDir: ukrainianFolder.dir,
    snapshot: ukrainianSnapshot(),
    outFile,
  });
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
