/**
 * `verify`: checks that the quoted text of each Entry it is given is on the
 * page its first source cites (ADR 0012, 0080). A goroh page is read as the
 * sourcing tool reads it, block by block, and a quote only a language model's
 * block holds is refused; any other page is its plain text. Pages come through
 * the sourcing tool's polite client, so a page is fetched once across runs.
 * An Entry whose first source has no page is unverified, unless a book
 * verifies it. A file or folder outside the Edition folder holds drafts, one
 * JSON file per record, each verified as the Entry it would become, before
 * `add` sends it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { EditionFolder } from '@slovo/language-pack/edition';
import {
  ID_PREFIX,
  parseRecord,
  quoteOf,
  quoteOnPage,
  squash,
  withoutFinalPeriod,
  type AuthoredRecord,
} from '@slovo/content-rules';
import type { PoliteClient } from '@slovo/sourcing';

import { readDraftFiles } from './input';

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
/** The kinds a draft can be: those with a quoted field. */
const DRAFT_KINDS = ['word', 'correction', 'idiom', 'synonymRow', 'tip'] as const;

/** An Entry as `verify` sees it: the one quoted field, and every field a book is checked for. */
interface Quoted {
  readonly id: string;
  readonly file: string;
  readonly url: string | undefined;
  readonly text: string;
  readonly bookFields: readonly (readonly [string, string])[];
}

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

/** The Entries of the Edition, each with its quoted field. */
function quotedEntries(edition: EditionFolder): Quoted[] {
  const content = edition.entries();
  return [
    ...content.words.map((authored) => quotedOf({ kind: 'word', ...authored })),
    ...content.corrections.map((authored) => quotedOf({ kind: 'correction', ...authored })),
    ...content.idioms.map((authored) => quotedOf({ kind: 'idiom', ...authored })),
    ...content.synonymRows.map((authored) => quotedOf({ kind: 'synonymRow', ...authored })),
    ...content.tips.map((authored) => quotedOf({ kind: 'tip', ...authored })),
  ].filter((entry) => entry !== undefined);
}

/** The quoted field per kind, and for a Tip every field it quotes from its book. */
function quotedOf(record: AuthoredRecord): Quoted | undefined {
  if (record.kind === 'crosswordDay' || record.kind === 'curatedCollection') return undefined;
  const { file, entry } = record;
  const quoted = (
    text: string,
    bookFields: readonly (readonly [string, string | undefined])[] = [['quote', text]],
  ): Quoted => ({
    id: entry.id,
    file,
    url: entry.sources[0]?.url,
    text,
    bookFields: bookFields.filter((field): field is [string, string] => field[1] !== undefined),
  });
  switch (record.kind) {
    case 'word':
    case 'idiom':
      return quoted(record.entry.primaryDefinition);
    case 'correction':
      return quoted(record.entry.explanation);
    case 'synonymRow':
      return quoted(record.entry.meaning);
    case 'tip': {
      const tip = record.entry;
      return quoted(tip.explanation, [
        ['title', tip.title],
        ['nonStandardForm', tip.nonStandardForm],
        ['standardForm', tip.standardForm],
        ['explanation', tip.explanation],
        ['example', tip.example?.text],
        ['rightAnswer', tip.gameQuestion.rightAnswer],
      ]);
    }
  }
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
  const problems: string[] = [];
  for (const name of targets.names) {
    const matches = matching(all, name, request);
    if (!matches.ok) problems.push(matches.error);
    else for (const entry of matches.entries) picked.add(entry);
  }
  return problems.length === 0
    ? { ok: true, entries: [...picked] }
    : { ok: false, error: problems.join('\n') };
}

/**
 * The Entries a name stands for: an id, an Entry file, or a folder of them;
 * a file or folder outside the Edition folder holds drafts.
 */
function matching(all: readonly Quoted[], name: string, request: VerifyRequest): Selection {
  const byId = all.filter((entry) => entry.id === name);
  if (byId.length > 0) return { ok: true, entries: byId };
  const path = resolve(request.cwd, name);
  const none = { ok: false, error: `No Entry of the Edition is ${name}` } as const;
  if (!existsSync(path)) return none;
  // Both sides resolved through symlinks: macOS's /var is /private/var.
  const inEdition = relative(realpathSync(request.edition.dir), realpathSync(path));
  if (inEdition.startsWith('..') || isAbsolute(inEdition)) return drafts(path, request.cwd);
  const entries = statSync(path).isDirectory()
    ? all.filter((entry) => entry.file.startsWith(inEdition === '' ? '' : `${inEdition}${sep}`))
    : all.filter((entry) => entry.file === inEdition);
  return entries.length === 0 ? none : { ok: true, entries };
}

/** The drafts of a file or folder, each read as the Entry its id prefix names (ADR 0010). */
function drafts(path: string, cwd: string): Selection {
  const read = readDraftFiles(path);
  if (!read.ok) return { ok: false, error: read.problems.join('\n') };
  const entries: Quoted[] = [];
  const problems: string[] = [];
  for (const { draft, file } of read.drafts) {
    const shown = relative(cwd, file);
    const id = typeof draft['id'] === 'string' ? draft['id'] : '';
    const kind = DRAFT_KINDS.find((candidate) => id.startsWith(ID_PREFIX[candidate]));
    if (kind === undefined) {
      problems.push(`${shown}: The draft's id names no kind of Entry`);
      continue;
    }
    const parsed = parseRecord(kind, shown, draft);
    if (!parsed.ok) {
      problems.push(...parsed.refusals.map((refusal) => `${shown}: ${refusal.message}`));
      continue;
    }
    const quoted = quotedOf(parsed.record);
    if (quoted !== undefined) entries.push(quoted);
  }
  if (problems.length > 0) return { ok: false, error: problems.join('\n') };
  return entries.length === 0
    ? { ok: false, error: `No draft is in ${relative(cwd, path)}` }
    : { ok: true, entries };
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
  const found = quoteOnPage(text, url, { status: 200, body });
  if (found.outcome === 'miss') return { outcome: 'miss', detail: found.quote };
  return { outcome: found.outcome };
}

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

function safeDecode(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}
