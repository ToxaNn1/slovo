import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Word } from '@slovo/contracts';
import { ContentSnapshotSchema } from '@slovo/contracts/api';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';

import { LANDING_EDITION } from './edition';

/**
 * Where the site's content comes from at the build (ADR 0148): the backend's
 * content snapshot when `SLOVO_BACKEND_URL` is set, the Edition's seed
 * snapshot when it is not (a local build, the PR checks).
 */
export type SnapshotSource = { kind: 'backend'; url: string } | { kind: 'seed'; file: string };

export function snapshotSource(env: Readonly<Record<string, string | undefined>>): SnapshotSource {
  const backend = env['SLOVO_BACKEND_URL'];
  if (backend === undefined)
    return { kind: 'seed', file: join(EDITIONS_DIR, LANDING_EDITION, 'seed-snapshot.json') };
  if (backend.trim() === '') throw new Error('SLOVO_BACKEND_URL is set but empty.');
  const url = `${backend.replace(/\/+$/, '')}/v1/editions/${LANDING_EDITION}/content/snapshot`;
  return { kind: 'backend', url };
}

/** What reading a source needs, injected so a test runs without the network or the disk. */
export interface SnapshotReaders {
  fetch: (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
  readFile: (file: string) => string;
}

const defaultReaders: SnapshotReaders = {
  fetch: (url) => fetch(url),
  readFile: (file) => readFileSync(file, 'utf8'),
};

/**
 * The live Words of the landing's Edition, parsed once where they enter the
 * site, the Retired ones left out. Any failure throws, so a build with the
 * backend set never falls back to the seed.
 */
export async function readLiveWords(
  source: SnapshotSource,
  readers: SnapshotReaders = defaultReaders,
): Promise<Word[]> {
  const raw: unknown =
    source.kind === 'seed'
      ? JSON.parse(readers.readFile(source.file))
      : await fetchJson(source.url, readers);
  const snapshot = ContentSnapshotSchema.parse(raw);
  if (snapshot.editionId !== LANDING_EDITION)
    throw new Error(
      `The snapshot is of Edition "${snapshot.editionId}", not "${LANDING_EDITION}".`,
    );
  return snapshot.words.filter((word) => !word.retired);
}

async function fetchJson(url: string, readers: SnapshotReaders): Promise<unknown> {
  const response = await readers.fetch(url);
  if (!response.ok)
    throw new Error(`The content snapshot at ${url} answered ${String(response.status)}.`);
  return response.json();
}
