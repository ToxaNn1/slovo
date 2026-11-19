/**
 * The two open files `source:lemmas` picks from, each downloaded once into
 * the sourcing cache at run time and never kept in the repo (ADR 0196):
 *
 * - the headword list: `ukrainian.dict` of LanguageTool's
 *   `morfologik-ukrainian-lt` (LGPL 2.1 or later), built from dict_uk;
 * - the Zipf frequencies: `large_uk.msgpack.gz` of `wordfreq` (ADR 0146).
 *
 * Each is pinned to a version and its SHA-256, so every run on every
 * machine picks from the same files.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { headwordList } from './morfologik';
import { readWordfreq } from './wordfreq';
import { readZipEntry } from './zip';

/** A file inside a downloaded archive. */
export interface ArchiveSource {
  readonly url: string;
  readonly sha256: string;
  readonly entry: string;
}

export const MORFOLOGIK_UKRAINIAN: ArchiveSource = {
  url: 'https://repo1.maven.org/maven2/ua/net/nlp/morfologik-ukrainian-lt/6.8.6/morfologik-ukrainian-lt-6.8.6.jar',
  sha256: '4b8a06a731d12047dd91bfb3a63638f258b4477f1591e167fe0b286a4c22c645',
  entry: 'org/languagetool/resource/uk/ukrainian.dict',
};

export const WORDFREQ_UK: ArchiveSource = {
  url: 'https://files.pythonhosted.org/packages/24/61/62835c475d69872d30689f284497853fe33fe1d6dd18f57346d13305861d/wordfreq-3.1.1-py3-none-any.whl',
  sha256: '4b1c6ecffc6198be3396d5cf871c4423ca71c907c231348d352dd54d62b97473',
  entry: 'wordfreq/data/large_uk.msgpack.gz',
};

/** Downloads a file whole. */
export type Download = (url: string) => Promise<Uint8Array>;

export interface LemmaSourceOptions {
  readonly cacheDir: string;
  readonly download: Download;
  readonly log: (message: string) => void;
}

/** The headword list, `<lemma>\t<tags>` per line, from the cache or built once. */
export async function loadHeadwords(
  options: LemmaSourceOptions,
  source: ArchiveSource = MORFOLOGIK_UKRAINIAN,
): Promise<string> {
  const file = await cachedFile(options, `headwords-${baseName(source)}.tsv`, async () => {
    const archive = await downloadVerified(options, source);
    options.log('Reading the Lemma forms out of the dictionary (once; about 15 s)');
    return Buffer.from(headwordList(readZipEntry(archive, source.entry)), 'utf8');
  });
  return Buffer.from(file).toString('utf8');
}

/** The Zipf frequency list, from the cache or downloaded once. */
export async function loadWordfreq(
  options: LemmaSourceOptions,
  source: ArchiveSource = WORDFREQ_UK,
): Promise<ReadonlyMap<string, number>> {
  const file = await cachedFile(
    options,
    `${baseName(source)}-${source.entry.split('/').pop() ?? ''}`,
    async () => readZipEntry(await downloadVerified(options, source), source.entry),
  );
  return readWordfreq(file);
}

/** The archive at `source.url`, refused unless its SHA-256 is the pinned one. */
async function downloadVerified(
  { download, log }: LemmaSourceOptions,
  source: ArchiveSource,
): Promise<Uint8Array> {
  log(`Downloading ${source.url}`);
  const archive = await download(source.url);
  const sha256 = createHash('sha256').update(archive).digest('hex');
  if (sha256 !== source.sha256) {
    throw new Error(`${source.url} has SHA-256 ${sha256}, not the pinned ${source.sha256}`);
  }
  return archive;
}

/** `<cache>/lemmas/<name>`, built and written once, read on every later run. */
async function cachedFile(
  { cacheDir }: LemmaSourceOptions,
  name: string,
  build: () => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const path = join(cacheDir, 'lemmas', name);
  if (existsSync(path)) return readFileSync(path);
  const bytes = await build();
  mkdirSync(dirname(path), { recursive: true });
  // Written aside and renamed, so a parallel run never reads half a file.
  const partial = `${path}.${String(process.pid)}.part`;
  writeFileSync(partial, bytes);
  renameSync(partial, path);
  return bytes;
}

/** The archive's file name without its extension, e.g. `wordfreq-3.1.1-py3-none-any`. */
function baseName(source: ArchiveSource): string {
  return (source.url.split('/').pop() ?? source.url).replace(/\.[a-z]+$/, '');
}
