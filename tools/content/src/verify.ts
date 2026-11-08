/**
 * `verify`: checks that the quoted text of each Entry it is given is on the
 * page its first source cites (ADR 0012, 0080). A goroh page is read as the
 * sourcing tool reads it, block by block, and a quote only a language model's
 * block holds is refused; any other page is its plain text. Pages come through
 * the sourcing tool's polite client, so a page is fetched once across runs.
 * An Entry whose first source has no page is unverified, unless a book
 * verifies it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import type { EditionFolder } from '@slovo/language-pack/edition';
import { readArticleBlocks, withoutHomonymIndexes, type PoliteClient } from '@slovo/sourcing';

/** Which Entries to verify: named on the command line, or those that differ from a git ref. */
export type VerifyTargets =
  | { readonly kind: 'named'; readonly names: readonly string[] }
  | { readonly kind: 'changed'; readonly ref: string };

export interface VerifyRequest {
  readonly edition: EditionFolder;
  readonly targets: VerifyTargets;
  /** A book as the osvita downloader writes it: one paragraph per line, `<page>\t<text>`. */
  readonly bookFile: string | undefined;
  readonly client: PoliteClient;
  /** Where the names on the command line are relative to. */
  readonly cwd: string;
  readonly print: (line: string) => void;
  readonly problem: (line: string) => void;
}

type Outcome = 'ok' | 'miss' | 'llm' | 'fetch-failed' | 'unverified';
const OUTCOMES: readonly Outcome[] = ['ok', 'miss', 'llm', 'fetch-failed', 'unverified'];
const FAILING: ReadonlySet<Outcome> = new Set(['miss', 'llm', 'fetch-failed']);

/** An Entry as `verify` sees it: the one quoted field, and every field a book is checked for. */
interface Quoted {
  readonly id: string;
  readonly file: string;
  readonly url: string | undefined;
  readonly text: string;
  readonly bookFields: readonly (readonly [string, string])[];
}

const GOROH_HOST = 'goroh.pp.ua';

/** Verifies the Entries and prints one line each, then the count per outcome. */
export async function verifyEntries(request: VerifyRequest): Promise<number> {
  const { edition, targets, print, problem } = request;
  const all = quotedEntries(edition);
  const selected = select(all, request);
  if (!selected.ok) {
    problem(selected.error);
    return 2;
  }
  if (selected.entries.length === 0 && targets.kind === 'changed') {
    print(`No Entry differs from ${targets.ref}`);
    return 0;
  }
  const book = request.bookFile === undefined ? undefined : readBook(request.bookFile);

  const counts = new Map<Outcome, number>();
  for (const entry of selected.entries) {
    const { outcome, detail } =
      entry.url === undefined
        ? book === undefined
          ? { outcome: 'unverified' as const, detail: undefined }
          : checkBook(entry, book)
        : await checkPage(entry.text, entry.url, request.client);
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
    print([outcome, entry.id, entry.file, ...(detail === undefined ? [] : [detail])].join('\t'));
  }
  print(
    OUTCOMES.filter((outcome) => counts.has(outcome))
      .map((outcome) => `${String(counts.get(outcome))} ${outcome}`)
      .join(', '),
  );
  const failed =
    [...FAILING].some((outcome) => counts.has(outcome)) ||
    (book !== undefined && counts.has('unverified'));
  return failed ? 1 : 0;
}

/** The quoted field per kind, and for a Tip every field it quotes from its book. */
function quotedEntries(edition: EditionFolder): Quoted[] {
  const content = edition.entries();
  const quoted = (
    {
      file,
      entry,
    }: { file: string; entry: { id: string; sources: readonly { url?: string | undefined }[] } },
    text: string,
    bookFields: readonly (readonly [string, string | undefined])[] = [['quote', text]],
  ): Quoted => ({
    id: entry.id,
    file,
    url: entry.sources[0]?.url,
    text,
    bookFields: bookFields.filter((field): field is [string, string] => field[1] !== undefined),
  });
  return [
    ...content.words.map((authored) => quoted(authored, authored.entry.primaryDefinition)),
    ...content.corrections.map((authored) => quoted(authored, authored.entry.explanation)),
    ...content.idioms.map((authored) => quoted(authored, authored.entry.primaryDefinition)),
    ...content.synonymRows.map((authored) => quoted(authored, authored.entry.meaning)),
    ...content.tips.map((authored) => {
      const tip = authored.entry;
      return quoted(authored, tip.explanation, [
        ['title', tip.title],
        ['nonStandardForm', tip.nonStandardForm],
        ['standardForm', tip.standardForm],
        ['explanation', tip.explanation],
        ['example', tip.example?.text],
        ['rightAnswer', tip.gameQuestion.rightAnswer],
      ]);
    }),
  ];
}

type Selection = { ok: true; entries: Quoted[] } | { ok: false; error: string };

function select(all: readonly Quoted[], request: VerifyRequest): Selection {
  const { edition, targets } = request;
  if (targets.kind === 'changed') {
    const files = changedFiles(edition.dir, targets.ref);
    if (!files.ok) return files;
    return { ok: true, entries: all.filter((entry) => files.files.has(entry.file)) };
  }
  const picked = new Set<Quoted>();
  for (const name of targets.names) {
    const matches = matching(all, name, request);
    if (matches.length === 0) return { ok: false, error: `No Entry of the Edition is ${name}` };
    for (const entry of matches) picked.add(entry);
  }
  return { ok: true, entries: all.filter((entry) => picked.has(entry)) };
}

/** The Entries a name stands for: an id, an Entry file, or a folder of them. */
function matching(all: readonly Quoted[], name: string, request: VerifyRequest): Quoted[] {
  const byId = all.filter((entry) => entry.id === name);
  if (byId.length > 0) return byId;
  const path = resolve(request.cwd, name);
  if (!existsSync(path)) return [];
  // Both sides resolved through symlinks: macOS's /var is /private/var.
  const inEdition = relative(realpathSync(request.edition.dir), realpathSync(path));
  if (statSync(path).isDirectory()) {
    const folder = inEdition === '' ? '' : `${inEdition}${sep}`;
    return all.filter((entry) => entry.file.startsWith(folder));
  }
  return all.filter((entry) => entry.file === inEdition);
}

/** The Edition's files, relative to its folder, that differ from the ref or are new to git. */
function changedFiles(
  editionDir: string,
  ref: string,
): { ok: true; files: Set<string> } | { ok: false; error: string } {
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: editionDir, encoding: 'utf8', stdio: 'pipe' })
      .split('\n')
      .filter((line) => line !== '');
  try {
    return {
      ok: true,
      files: new Set([
        ...git('diff', '--name-only', '--relative', '--diff-filter=d', ref, '--', '.'),
        ...git('ls-files', '--others', '--exclude-standard', '--', '.'),
      ]),
    };
  } catch (error) {
    const reason =
      error instanceof Error && 'stderr' in error ? String(error.stderr) : String(error);
    return { ok: false, error: `git could not compare the Edition with ${ref}: ${reason.trim()}` };
  }
}

/** Whether the quote is on the page, read through the polite client. */
async function checkPage(
  text: string,
  url: string,
  client: PoliteClient,
): Promise<{ outcome: Outcome; detail?: string }> {
  let body: string;
  try {
    const response = await client.get(encodeURI(safeDecode(url)));
    if (response.status !== 200) {
      return { outcome: 'fetch-failed', detail: `HTTP ${String(response.status)}` };
    }
    body = response.body;
  } catch (error) {
    return {
      outcome: 'fetch-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  const quote = quoteOf(text);
  if (new URL(url).host !== GOROH_HOST) {
    return squash(plainText(body)).includes(quote) ? { outcome: 'ok' } : miss(quote);
  }
  const holding = readArticleBlocks(body).filter((block) => squash(block.text).includes(quote));
  if (holding.some((block) => !block.languageModel)) return { outcome: 'ok' };
  return holding.length > 0 ? { outcome: 'llm' } : miss(quote);
}

const miss = (quote: string) => ({ outcome: 'miss' as const, detail: quote });

interface Paragraph {
  readonly page: string;
  readonly text: string;
}

function readBook(file: string): Paragraph[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.includes('\t'))
    .map((line) => {
      const tab = line.indexOf('\t');
      return { page: line.slice(0, tab), text: squash(line.slice(tab + 1)) };
    });
}

/** Every field the Entry quotes must be in the book; the page is the quoted field's. */
function checkBook(
  entry: Quoted,
  book: readonly Paragraph[],
): { outcome: Outcome; detail: string } {
  const whole = book.map((paragraph) => paragraph.text).join('\n');
  const missing = entry.bookFields
    .filter(([, text]) => !whole.includes(squash(withoutFinalPeriod(text))))
    .map(([name]) => name);
  if (missing.length > 0) {
    return { outcome: 'unverified', detail: `not in the book: ${missing.join(', ')}` };
  }
  const quote = quoteOf(entry.text);
  const page = book.find((paragraph) => paragraph.text.includes(quote))?.page ?? '?';
  return { outcome: 'ok', detail: `page ${page}` };
}

/**
 * Lower case, without homonym indexes, spaces, quotation marks, apostrophes or
 * dashes: the 06.11 wave's comparison. The Edition drops the indexes a page
 * sets after a word, so `лю́тий` quotes the page's `лю́тий2`.
 */
function squash(text: string): string {
  return withoutHomonymIndexes(text)
    .toLowerCase()
    .replace(/[\s’ʼ«»"„“”'–—-]/g, '');
}

const withoutFinalPeriod = (text: string) => text.replace(/\.$/, '');

/** The field's first 40 characters, without a final period, compared squashed. */
function quoteOf(text: string): string {
  return squash(withoutFinalPeriod(text).slice(0, 40));
}

function safeDecode(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  bdquo: '„',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  shy: '',
};

/** A page's text: no scripts, styles or tags, entities decoded. */
function plainText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity: string, name: string) => {
      if (name.startsWith('#')) {
        const code =
          name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return String.fromCodePoint(code);
      }
      return ENTITIES[name.toLowerCase()] ?? entity;
    });
}
