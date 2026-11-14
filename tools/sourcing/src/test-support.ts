import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ContentSnapshotSchema, type ContentSnapshot } from '@slovo/contracts/api';
import { readSnapshotFile } from '@slovo/language-pack';
import {
  EDITIONS_DIR,
  editionFiles,
  openEditionWithSnapshot,
  type EditionFolder,
} from '@slovo/language-pack/edition';

/** A repeatable stand-in for Math.random, for tests. */
export function seededRandom(seed = 7): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/** The UA Edition's seed snapshot: the content an empty database starts from. */
export const UK_SEED_SNAPSHOT = join(EDITIONS_DIR, 'uk', 'seed-snapshot.json');

let seed: ContentSnapshot | undefined;

/** The UA Edition's seed snapshot, read once. */
export function ukSeedSnapshot(): ContentSnapshot {
  return (seed ??= readSnapshotFile(UK_SEED_SNAPSHOT));
}

/** The UA Edition, its records from its seed snapshot. */
export function ukrainianEdition(): EditionFolder {
  return openEditionWithSnapshot(EDITIONS_DIR, 'uk', ukSeedSnapshot());
}

/** The UA Edition's config file. */
export const UK_CONFIG_FILE = editionFiles(join(EDITIONS_DIR, 'uk')).path('config');

/** The snapshot key each kind's records go under, by the prefix of their id. */
const KIND_OF_PREFIX = {
  w_: 'words',
  c_: 'corrections',
  i_: 'idioms',
  r_: 'synonymRows',
  t_: 'tips',
} as const;

/**
 * A snapshot of the UA Edition whose only records are the given ones, each
 * under the kind its id prefix names, parsed as the backend's answer is.
 */
export function snapshotWith(records: Record<string, unknown> = {}): ContentSnapshot {
  const kinds: Record<string, unknown[]> = {};
  for (const [id, record] of Object.entries(records)) {
    const prefix = id.slice(0, 2);
    const kind = Object.entries(KIND_OF_PREFIX).find(([key]) => key === prefix)?.[1];
    if (kind === undefined) throw new Error(`No kind of record has the id ${id}`);
    (kinds[kind] ??= []).push(record);
  }
  return ContentSnapshotSchema.parse({
    ...ukSeedSnapshot(),
    words: [],
    corrections: [],
    idioms: [],
    synonymRows: [],
    tips: [],
    curatedCollections: [],
    crosswordDays: [],
    ...kinds,
  });
}

/**
 * A copy of the UA Edition in a temporary editions folder, with the given
 * config (the UA one by default) and the given records as its snapshot.
 */
export function editionWithSnapshot(
  records: Record<string, unknown> = {},
  config: string = readFileSync(UK_CONFIG_FILE, 'utf8'),
): EditionFolder {
  const editionsDir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  mkdirSync(join(editionsDir, 'uk'));
  writeFileSync(editionFiles(join(editionsDir, 'uk')).path('config'), config);
  return openEditionWithSnapshot(editionsDir, 'uk', snapshotWith(records));
}
