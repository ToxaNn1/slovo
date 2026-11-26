/**
 * The two open files `source:lemmas` picks from, each downloaded once into
 * the sourcing cache at run time and never kept in the repo (ADR 0196):
 *
 * - the headword list: `ukrainian.dict` of LanguageTool's
 *   `morfologik-ukrainian-lt` (LGPL 2.1 or later), built from dict_uk;
 * - the Zipf frequencies: `large_uk.msgpack.gz` of `wordfreq` (ADR 0146);
 * - the Wiktionary labels: the pages of uk.wiktionary's dated, dialect,
 *   historical and rare word categories, read from its database dump
 *   (CC BY-SA, used as facts only).
 *
 * Each is pinned to a version or dump date and its SHA-256, so every run on
 * every machine picks from the same files.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { headwordList } from './morfologik';
import { readWordfreq } from './wordfreq';
import { readZipEntry } from './zip';

/** A file inside a downloaded archive. */
export interface ArchiveSource {
  readonly url: string;
  readonly sha256: string;
  readonly entry: string;
}

const MORFOLOGIK_UKRAINIAN: ArchiveSource = {
  url: 'https://repo1.maven.org/maven2/ua/net/nlp/morfologik-ukrainian-lt/6.8.6/morfologik-ukrainian-lt-6.8.6.jar',
  sha256: '4b8a06a731d12047dd91bfb3a63638f258b4477f1591e167fe0b286a4c22c645',
  entry: 'org/languagetool/resource/uk/ukrainian.dict',
};

const WORDFREQ_UK: ArchiveSource = {
  url: 'https://files.pythonhosted.org/packages/24/61/62835c475d69872d30689f284497853fe33fe1d6dd18f57346d13305861d/wordfreq-3.1.1-py3-none-any.whl',
  sha256: '4b1c6ecffc6198be3396d5cf871c4423ca71c907c231348d352dd54d62b97473',
  entry: 'wordfreq/data/large_uk.msgpack.gz',
};

/** A downloaded file, pinned by its SHA-256. */
export interface PinnedFile {
  readonly url: string;
  readonly sha256: string;
}

/** The three tables of a dated Wiktionary dump that say which pages a category holds. */
export interface WiktionaryDump {
  /** The dump date, `YYYYMMDD`. */
  readonly date: string;
  readonly page: PinnedFile;
  readonly linktarget: PinnedFile;
  readonly categorylinks: PinnedFile;
  /** The categories whose pages are labelled Lemmas, as titles with `_` for spaces. */
  readonly categories: readonly string[];
}

const UK_WIKTIONARY_DUMP = 'https://dumps.wikimedia.org/ukwiktionary/20261101/ukwiktionary-20261101';

const UK_WIKTIONARY: WiktionaryDump = {
  date: '20261101',
  page: {
    url: `${UK_WIKTIONARY_DUMP}-page.sql.gz`,
    sha256: '771ec45d40708374a9a3fb8b601e4ab50bb2ae7af4ea1bdc9330e00daabd8a11',
  },
  linktarget: {
    url: `${UK_WIKTIONARY_DUMP}-linktarget.sql.gz`,
    sha256: '996b195ac039bb00a0c488387d6c5bbf605f5b03f6e1ac862c0bc7c4f2c93e34',
  },
  categorylinks: {
    url: `${UK_WIKTIONARY_DUMP}-categorylinks.sql.gz`,
    sha256: 'f847b161c89868fb78eeee6c23f60a4cd658e14aab5ce5cfeb1c9b1b8b3e9a5c',
  },
  categories: [
    'Застарілі_вирази/uk',
    'Діалектні_вирази/uk',
    'Діалектизми/uk',
    'Історизми/uk',
    'Рідковживані_слова_та_вирази/uk',
  ],
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

/**
 * The Lemmas uk.wiktionary labels dated, dialect, historical or rare: the
 * main-namespace pages of the dump's labelling categories, `_` read as a
 * space. Built once from the three tables and kept in the cache.
 */
export async function loadWiktionaryLabels(
  options: LemmaSourceOptions,
  dump: WiktionaryDump = UK_WIKTIONARY,
): Promise<ReadonlySet<string>> {
  const file = await cachedFile(options, `wiktionary-labels-${dump.date}.txt`, async () => {
    const [page, linktarget, categorylinks] = [
      await downloadVerified(options, dump.page),
      await downloadVerified(options, dump.linktarget),
      await downloadVerified(options, dump.categorylinks),
    ];
    const wanted = new Set(dump.categories);
    const categories = new Set<string>();
    for (const [id, namespace, title] of sqlRows(linktarget)) {
      if (namespace === '14' && title !== undefined && wanted.has(utf8(title))) {
        if (id !== undefined) categories.add(id);
      }
    }
    const titles = new Map<string, string>();
    for (const [id, namespace, title] of sqlRows(page)) {
      if (id !== undefined && namespace === '0' && title !== undefined) titles.set(id, title);
    }
    const labelled = new Set<string>();
    for (const row of sqlRows(categorylinks)) {
      const [from] = row;
      const target = row.at(-1);
      if (from === undefined || target === undefined || !categories.has(target)) continue;
      const title = titles.get(from);
      if (title !== undefined) labelled.add(utf8(title).replaceAll('_', ' ').normalize('NFC'));
    }
    return Buffer.from([...labelled].sort().join('\n'), 'utf8');
  });
  const text = Buffer.from(file).toString('utf8');
  return new Set(text === '' ? [] : text.split('\n'));
}

/** A field of a dump row, read byte for byte, as UTF-8. */
function utf8(field: string): string {
  return Buffer.from(field, 'latin1').toString('utf8');
}

/**
 * The rows of a gzipped MySQL table dump, each field as written: a string
 * unescaped but still byte for byte (latin1), a number or NULL as its text.
 */
function* sqlRows(gzipped: Uint8Array): Generator<string[]> {
  const text = gunzipSync(gzipped).toString('latin1');
  const escapes: Readonly<Record<string, string>> = { n: '\n', r: '\r', t: '\t', '0': '\0', Z: '\x1a' };
  for (const statement of text.matchAll(/^INSERT INTO `\w+` VALUES\s*/gm)) {
    let at = statement.index + statement[0].length;
    while (text[at] === '(') {
      at += 1;
      const row: string[] = [];
      for (;;) {
        let field = '';
        if (text[at] === "'") {
          at += 1;
          while (text[at] !== "'" && at < text.length) {
            if (text[at] === '\\') {
              at += 1;
              const escaped = text[at] ?? '';
              field += escapes[escaped] ?? escaped;
            } else field += text[at] ?? '';
            at += 1;
          }
          at += 1;
        } else {
          while (text[at] !== ',' && text[at] !== ')' && at < text.length) {
            field += text[at] ?? '';
            at += 1;
          }
        }
        row.push(field);
        if (text[at] === ',') at += 1;
        else break;
      }
      at += 1; // the closing parenthesis
      yield row;
      if (text[at] === ',') at += 1;
      while (text[at] === '\n') at += 1;
    }
  }
}

/** The file at `source.url`, refused unless its SHA-256 is the pinned one. */
async function downloadVerified(
  { download, log }: LemmaSourceOptions,
  source: PinnedFile,
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
