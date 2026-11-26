/**
 * Грінченко's «Словарь української мови» (1907–1909, public domain) as a
 * Word source (ADR 0207): a second headword list for `source:lemmas` and a
 * basis for `source:words` when no explanatory dictionary has the Lemma.
 *
 * The text is our own OCR of a public-domain scan, downloaded once from
 * archive.org into the sourcing cache, pinned by SHA-256 and never kept in
 * the repo. The cache keeps one article per line, `<headword>\t<gloss>\t<sigla>`:
 * the headword in lower case without stress marks, the rest of the article
 * on one line (endings, grammar label, Russian gloss, Examples, sigla), and
 * the source sigla joined by `; `.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { Gender, PartOfSpeech } from '@slovo/contracts';

import type { Download } from './lemma-sources';
import { matchKey, unstressed } from './text';

/** One volume of the scan. */
export interface HrinchenkoScan {
  /** The archive.org identifier, also the cached file's name. */
  readonly id: string;
  readonly url: string;
  readonly sha256: string;
}

/** The University of Toronto copy of the 1909 printing, in two bound volumes (А–Н, О–Я). */
export const HRINCHENKO_SCANS: readonly HrinchenkoScan[] = [
  {
    id: 'slovarukranskomo01hrin',
    url: 'https://archive.org/download/slovarukranskomo01hrin/slovarukranskomo01hrin.pdf',
    sha256: 'f9479e05e4c5c09c2f0555f9aef95c9ab77f9213eff47710f272da945487d3e7',
  },
  {
    id: 'slovarukranskomo02hrin',
    url: 'https://archive.org/download/slovarukranskomo02hrin/slovarukranskomo02hrin.pdf',
    sha256: 'aabc13158ce8bb1b5fb4a9fb02256c6d85a9d0406cc3f9002cd00ac41948cbc3',
  },
];

/** How a draft cites Грінченко. */
export const HRINCHENKO_SOURCE = {
  title:
    'Словарь української мови, зібраний редакцією журналу «Кіевская старина», упорядкував Борис Грінченко (1907–1909)',
  shortName: 'Словник Грінченка',
  url: 'https://archive.org/details/slovarukranskomo01hrin',
} as const;

export interface HrinchenkoArticle {
  /** Lower case, without stress marks, as the dictionary spells it. */
  readonly headword: string;
  /** The rest of the article on one line. */
  readonly gloss: string;
  readonly sigla: readonly string[];
}

/** The articles by the match key of their headword. */
export type HrinchenkoIndex = ReadonlyMap<string, readonly HrinchenkoArticle[]>;

/** The text of every page of a scan, in order. */
export type ReadPages = (pdfFile: string) => Promise<readonly string[]>;

export interface HrinchenkoSourceOptions {
  readonly cacheDir: string;
  readonly download: Download;
  readonly readPages: ReadPages;
  readonly log: (message: string) => void;
}

const UPPER = 'А-ЯІЇЄҐ';
const LOWER = 'а-яіїєґ';
/** A line that opens an article: a capitalised headword, a comma, its endings or label. */
const ARTICLE_START = new RegExp(`^[^\\p{L}]*([${UPPER}][${LOWER}'’ʼ\\u0301-]+), (.*)$`, 'u');
/** The endings, then the grammar label: «ни, ж.», «жу, жиш, гл.», «нар.». */
const GRAMMAR = new RegExp(`^(?:[${LOWER}'’ʼ\\u0301-]+, )*(ж|м|с|мн|гл|нар)\\.(?:\\s|$)`, 'u');
/** A siglum after a sentence: «Нп.», «Пирят. у.», «Мир. ХРВ. 70.», «Шух. І. 76.». */
const SIGLUM = new RegExp(
  `(?<=[.!?:;»"“]\\s)[${UPPER}][${LOWER}]{0,5}\\.(?:\\s(?:[${UPPER}IVX]{1,4}|у)\\.)*(?:\\s\\d+\\.)?`,
  'gu',
);
/** Labels of the dictionary that read like sigla. */
const LABELS = new Set(['Ум.', 'Ув.', 'Соб.', 'См.', 'Ласк.', 'Мн.', 'Ед.', 'Употр.', 'Иск.']);

const GRAMMAR_OF_LABEL: Record<string, { partOfSpeech: PartOfSpeech; gender?: Gender }> = {
  ж: { partOfSpeech: 'noun', gender: 'feminine' },
  м: { partOfSpeech: 'noun', gender: 'masculine' },
  с: { partOfSpeech: 'noun', gender: 'neuter' },
  мн: { partOfSpeech: 'noun', gender: 'plural-only' },
  гл: { partOfSpeech: 'verb' },
  нар: { partOfSpeech: 'adverb' },
};

/** The articles on one OCR page, in order; front matter has none. */
export function parseHrinchenkoPage(text: string): HrinchenkoArticle[] {
  const articles: { headword: string; text: string }[] = [];
  let current: { headword: string; text: string } | undefined;
  let afterBreak = true;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') {
      afterBreak = true;
      continue;
    }
    const start = ARTICLE_START.exec(line);
    const headword = start?.[1];
    const rest = start?.[2];
    if (headword !== undefined && rest !== undefined && afterBreak) {
      current = { headword, text: rest };
      articles.push(current);
    } else if (current !== undefined) {
      current.text = current.text.endsWith('-')
        ? `${current.text.slice(0, -1)}${line}`
        : `${current.text} ${line}`;
    }
    afterBreak = /[.!?)]$/.test(line);
  }
  return articles.flatMap(({ headword, text: article }) => {
    const word = unstressed(headword).toLocaleLowerCase('uk').replace(/-+$/, '');
    if (word.length < 2) return [];
    const gloss = article.replaceAll('\t', ' ').replace(/\s+/g, ' ').trim();
    return [{ headword: word, gloss, sigla: siglaOf(gloss) }];
  });
}

/** The part of speech, and a noun's gender, from the label after the endings. */
export function hrinchenkoGrammar(gloss: string): { partOfSpeech?: PartOfSpeech; gender?: Gender } {
  const label = GRAMMAR.exec(gloss)?.[1];
  return label === undefined ? {} : { ...GRAMMAR_OF_LABEL[label] };
}

/** The sigla after the gloss sentence. */
function siglaOf(gloss: string): string[] {
  const grammar = GRAMMAR.exec(gloss);
  const body = grammar === null ? 0 : grammar[0].length;
  const glossEnd = gloss.indexOf('.', body);
  const from = glossEnd === -1 ? gloss.length : glossEnd + 1;
  return [...gloss.matchAll(SIGLUM)]
    .filter((match) => match.index >= from && !LABELS.has(match[0]))
    .map((match) => match[0]);
}

/** The Lemma forms of a `<lemma>\t<tags>` headword list whose Lemma Грінченко has. */
export function onlyHrinchenkoHeadwords(headwords: string, index: HrinchenkoIndex): string {
  return headwords
    .split('\n')
    .filter((line) => line !== '' && index.has(matchKey(line.split('\t')[0] ?? '')))
    .map((line) => `${line}\n`)
    .join('');
}

/** The index in the cache, if `pnpm source:hrinchenko` has built it. */
export function cachedHrinchenko(
  cacheDir: string,
  scans: readonly HrinchenkoScan[] = HRINCHENKO_SCANS,
): HrinchenkoIndex | undefined {
  const path = indexPath(cacheDir, scans);
  return existsSync(path) ? readIndex(readFileSync(path, 'utf8')) : undefined;
}

/** The index, from the cache or built once from the pinned scans. */
export async function loadHrinchenko(
  options: HrinchenkoSourceOptions,
  scans: readonly HrinchenkoScan[] = HRINCHENKO_SCANS,
): Promise<HrinchenkoIndex> {
  const cached = cachedHrinchenko(options.cacheDir, scans);
  if (cached !== undefined) return cached;
  const lines: string[] = [];
  for (const scan of scans) {
    const pdf = await cachedScan(options, scan);
    options.log(`Reading ${scan.id} by OCR (once; about an hour a volume)`);
    for (const page of await options.readPages(pdf)) {
      for (const { headword, gloss, sigla } of parseHrinchenkoPage(page)) {
        lines.push(`${headword}\t${gloss}\t${sigla.join('; ')}\n`);
      }
    }
  }
  const tsv = lines.join('');
  writeAside(indexPath(options.cacheDir, scans), tsv);
  return readIndex(tsv);
}

/** `<cache>/lemmas/hrinchenko-<pins>.tsv`: a new pin builds a new index. */
function indexPath(cacheDir: string, scans: readonly HrinchenkoScan[]): string {
  const pins = scans.map((scan) => scan.sha256.slice(0, 12)).join('-');
  return join(cacheDir, 'lemmas', `hrinchenko-${pins}.tsv`);
}

/** The scan's PDF in the cache, downloaded and checked once. */
async function cachedScan(options: HrinchenkoSourceOptions, scan: HrinchenkoScan): Promise<string> {
  const path = join(options.cacheDir, 'hrinchenko', `${scan.id}.pdf`);
  if (existsSync(path)) return path;
  options.log(`Downloading ${scan.url}`);
  const bytes = await options.download(scan.url);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== scan.sha256) {
    throw new Error(`${scan.url} has SHA-256 ${sha256}, not the pinned ${scan.sha256}`);
  }
  writeAside(path, bytes);
  return path;
}

/** Written aside and renamed, so a parallel run never reads half a file. */
function writeAside(path: string, content: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.${String(process.pid)}.part`;
  writeFileSync(partial, content);
  renameSync(partial, path);
}

function readIndex(tsv: string): HrinchenkoIndex {
  const index = new Map<string, HrinchenkoArticle[]>();
  for (const line of tsv.split('\n')) {
    const [headword, gloss, sigla] = line.split('\t');
    if (headword === undefined || headword === '' || gloss === undefined) continue;
    const article = {
      headword,
      gloss,
      sigla: sigla === undefined || sigla === '' ? [] : sigla.split('; '),
    };
    const key = matchKey(headword);
    index.set(key, [...(index.get(key) ?? []), article]);
  }
  return index;
}
