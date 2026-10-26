import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { checkLanguagePack, formatBuildError, recordContent } from '@slovo/language-pack';
import { EditionFolderError, type EditionFolder } from '@slovo/language-pack/edition';

/** Opens a file for the owner and returns once they close it. */
export interface Editor {
  open(path: string): void;
}

/** Where the tool talks to the owner. */
export interface Terminal {
  print(line: string): void;
  /** A problem or a refusal. */
  problem(line: string): void;
  /** Asks a yes-or-no question, yes by default; no when nothing more can be read. */
  confirm(question: string): Promise<boolean>;
  /** Asks a question and returns the answer, or undefined when nothing more can be read. */
  ask(question: string): Promise<string | undefined>;
}

/** What every command works with: the Edition, and the ports to the owner. */
export interface ContentTool {
  readonly edition: EditionFolder;
  readonly editor: Editor;
  readonly terminal: Terminal;
  /** A number in [0, 1), as Math.random gives. */
  readonly random: () => number;
}

/** The kinds of Entry `new` drafts, by the prefix of their ids. */
export const ENTRY_KINDS = {
  word: 'w_',
  correction: 'c_',
  idiom: 'i_',
  'synonym-row': 'r_',
} as const;

export type EntryKind = keyof typeof ENTRY_KINDS;

/**
 * Drafts an Entry of the given kind with an id no Entry of the Edition has
 * had, in the file the build reads it from, and opens it in the editor.
 * Once the draft passes the build's checks, the content is recorded as
 * `pnpm build:pack --record` records it: the new id joins the id registry
 * and the content version grows. A draft closed unchanged is removed, so
 * nothing is written and no id is issued. Returns the exit code.
 */
export async function newEntry(kind: EntryKind, tool: ContentTool): Promise<number> {
  const { edition, terminal } = tool;
  let taken: Set<string>;
  try {
    const { words, corrections, idioms, synonymRows, tips } = edition.entries();
    taken = new Set([
      ...(edition.readIfPresent('idRegistry') ?? []),
      ...[...words, ...corrections, ...idioms, ...synonymRows, ...tips].map(
        ({ entry }) => entry.id,
      ),
    ]);
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    reportProblems(terminal, `Edition "${edition.id}"`, error.errors.map(formatBuildError));
    return 1;
  }
  const id = freshId(ENTRY_KINDS[kind], taken, tool.random);
  const file = edition.entryFile(id);
  const path = join(edition.dir, file);
  const draft = `${JSON.stringify(draftEntry(kind, id, edition), null, 2)}\n`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, draft);
  terminal.print(`Drafted ${file}`);
  return editUntilRecorded(file, draft, tool);
}

/**
 * Opens an existing Entry in the editor, found by its id, or by its Lemma,
 * expression, non-standard form or a Synonym Row's dominant, with or without stress marks and in any
 * case. When the text matches several Entries, such as homonyms, it lists
 * them and asks which one to open. After each save the content is checked
 * and recorded as `newEntry` does; an Entry closed unchanged writes nothing.
 * Returns the exit code.
 */
export async function editEntry(text: string, tool: ContentTool): Promise<number> {
  const { edition, terminal } = tool;
  let matches: Match[];
  if (/^[a-z]_[a-z0-9]+$/.test(text) && existsSync(join(edition.dir, edition.entryFile(text)))) {
    matches = [{ id: text }];
  } else {
    try {
      matches = matchingEntries(edition, text);
    } catch (error) {
      if (!(error instanceof EditionFolderError)) throw error;
      reportProblems(terminal, `Edition "${edition.id}"`, error.errors.map(formatBuildError));
      return 1;
    }
  }
  if (matches.length === 0) {
    terminal.problem(`No Entry of Edition "${edition.id}" matches "${text}"`);
    return 1;
  }
  const match = matches.length === 1 ? matches[0] : await pick(matches, terminal);
  if (match === undefined) {
    terminal.problem('No Entry picked: nothing opened');
    return 1;
  }
  const file = edition.entryFile(match.id);
  return editUntilRecorded(file, readFileSync(join(edition.dir, file), 'utf8'), tool, 'keep');
}

/**
 * Retires an Entry: it stays in its file, marked retired, because its id is
 * never reused (ADR 0010), and the content is recorded as `newEntry` does.
 * Returns the exit code.
 */
export function retireEntry(id: string, { edition, terminal }: ContentTool): number {
  const file = edition.entryFile(id);
  const path = join(edition.dir, file);
  if (!existsSync(path)) {
    terminal.problem(`No Entry of Edition "${edition.id}" has the id "${id}"`);
    return 1;
  }
  const before = readFileSync(path, 'utf8');
  let entry: unknown;
  try {
    entry = JSON.parse(before);
  } catch {
    terminal.problem(`${file}: Invalid JSON: fix it with pnpm content edit ${id}`);
    return 1;
  }
  if (typeof entry === 'object' && entry !== null && 'retired' in entry && entry.retired === true) {
    terminal.print(`${file} is already retired: nothing written`);
    return 0;
  }
  // Rewrites only the flag, so the file keeps the owner's formatting.
  writeFileSync(
    path,
    /"retired":\s*false/.test(before)
      ? before.replace(/"retired":\s*false/, '"retired": true')
      : before.replace(/\s*\}\s*$/, ',\n  "retired": true\n}\n'),
  );
  const recorded = recordContent({ editionDir: edition.dir });
  if (!recorded.ok) {
    writeFileSync(path, before);
    reportProblems(terminal, `${file} not retired`, recorded.errors.map(formatBuildError));
    return 1;
  }
  terminal.print(`Retired ${file}`);
  printContentVersion(terminal, recorded);
  return 0;
}

/**
 * Checks the whole Edition with the build's own rules, writing nothing, and
 * reports every problem and every content target it misses. Returns the
 * exit code.
 */
export function checkEdition({ edition, terminal }: ContentTool): number {
  const result = checkLanguagePack({ editionDir: edition.dir });
  if (!result.ok) {
    reportProblems(terminal, `Edition "${edition.id}"`, result.errors.map(formatBuildError));
    return 1;
  }
  terminal.print(`Edition "${edition.id}": no problems`);
  if (result.missedTargets.length === 0) return 0;
  reportProblems(
    terminal,
    'Content targets',
    result.missedTargets.map(({ target, message }) => `${target}: ${message}`),
    'missed',
  );
  return 1;
}

/**
 * Opens an Entry file until it passes and its content is recorded, or the
 * owner leaves it. A file closed as it was before the command writes
 * nothing: a draft is removed, an existing Entry kept as it was. A deleted
 * draft is gone; a deleted Entry is written back, since its id stays taken
 * (ADR 0010) and only retiring withdraws it.
 */
async function editUntilRecorded(
  file: string,
  before: string,
  tool: ContentTool,
  unchanged: 'remove' | 'keep' = 'remove',
): Promise<number> {
  const { edition, editor, terminal } = tool;
  const path = join(edition.dir, file);
  for (;;) {
    editor.open(path);
    if (!existsSync(path) || readFileSync(path, 'utf8') === before) {
      if (unchanged === 'remove') rmSync(path, { force: true });
      else writeFileSync(path, before);
      terminal.print(`${file} closed unchanged: nothing written`);
      return 0;
    }
    const recorded = recordContent({ editionDir: edition.dir });
    if (recorded.ok) {
      terminal.print(`Recorded ${file}`);
      printContentVersion(terminal, recorded);
      return 0;
    }
    reportProblems(terminal, `${file} not recorded`, recorded.errors.map(formatBuildError));
    if (!(await terminal.confirm(`Reopen ${file} in the editor? [Y/n]`))) {
      terminal.problem(
        `Kept ${file}, not recorded: fix it, then run pnpm build:pack ${edition.id} --record`,
      );
      return 1;
    }
  }
}

function printContentVersion(
  terminal: Terminal,
  {
    contentVersion,
    previousContentVersion,
  }: { contentVersion: number; previousContentVersion: number },
): void {
  terminal.print(
    `  content version: ${String(contentVersion)} (was ${String(previousContentVersion)})`,
  );
}

/** An Entry a text matched, with what the owner tells it apart by. */
interface Match {
  readonly id: string;
  readonly label?: string;
}

/** The Entries whose Lemma, expression, non-standard form or dominant is the text, in id order. */
function matchingEntries(edition: EditionFolder, text: string): Match[] {
  const { words, corrections, idioms, synonymRows } = edition.entries();
  const wanted = comparable(text);
  return [
    ...words.map(({ entry }) => ({ entry, text: entry.lemma, gist: entry.primaryDefinition })),
    ...corrections.map(({ entry }) => ({
      entry,
      text: entry.nonStandardForm,
      gist: `→ ${entry.standardEquivalents.join(', ')}`,
    })),
    ...idioms.map(({ entry }) => ({
      entry,
      text: entry.expression,
      gist: entry.primaryDefinition,
    })),
    ...synonymRows.map(({ entry }) => ({ entry, text: entry.dominant.text, gist: entry.meaning })),
  ]
    .filter(({ text: candidate }) => comparable(candidate) === wanted)
    .map(({ entry, text: candidate, gist }) => ({
      id: entry.id,
      label: `${entry.id} ${kindOf(entry.id)} ${candidate}: ${short(gist)}${entry.retired ? ' (retired)' : ''}`,
    }))
    .toSorted((a, b) => (a.id < b.id ? -1 : 1));
}

/** Lists the matches and asks for one by its number or its id. */
async function pick(matches: readonly Match[], terminal: Terminal): Promise<Match | undefined> {
  terminal.print(`${String(matches.length)} Entries match:`);
  matches.forEach(({ label }, index) => {
    terminal.print(`  ${String(index + 1)}. ${label ?? ''}`);
  });
  const answer = (await terminal.ask(`Open which? [1-${String(matches.length)}]`))?.trim() ?? '';
  return matches[Number(answer) - 1] ?? matches.find(({ id }) => id === answer);
}

/** A text as the owner may type it: stress marks dropped, in lower case. */
function comparable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\u0301/g, '')
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase();
}

function kindOf(id: string): string {
  return Object.entries(ENTRY_KINDS).find(([, prefix]) => id.startsWith(prefix))?.[0] ?? 'entry';
}

function short(text: string): string {
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

function reportProblems(
  terminal: Terminal,
  subject: string,
  problems: readonly string[],
  what = 'problem(s)',
): void {
  terminal.problem(`${subject}: ${String(problems.length)} ${what}`);
  for (const problem of problems) terminal.problem(`  ${problem}`);
}

/** A new opaque id with the given prefix that no id taken so far has. */
function freshId(prefix: string, taken: ReadonlySet<string>, random: () => number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (;;) {
    let id = prefix;
    for (let i = 0; i < 6; i += 1) id += alphabet.charAt(Math.floor(random() * alphabet.length));
    if (!taken.has(id)) return id;
  }
}

/**
 * A draft that names every field the kind requires and the lists most
 * Entries fill, with sample values where the schema takes one of a few.
 * Texts are left empty, so an untouched draft never passes.
 */
function draftEntry(kind: EntryKind, id: string, edition: EditionFolder): Record<string, unknown> {
  const sources = [{ title: '' }];
  const rowWord = () => ({ text: '', stress: [] });
  switch (kind) {
    case 'word':
      return {
        kind,
        id,
        lemma: '',
        stress: [],
        partOfSpeech: 'noun',
        gender: 'feminine',
        primaryDefinition: '',
        extraDefinitions: [],
        examples: [],
        synonyms: [],
        antonyms: [],
        registers: [],
        categoryId: edition.config.categories[0]?.id ?? '',
        rarity: 3,
        sources,
        correctionIds: [],
      };
    case 'correction':
      return {
        kind,
        id,
        nonStandardForm: '',
        correctionType: 'russianism',
        standardEquivalents: [''],
        explanation: '',
        examplePair: { nonStandard: '', standard: '' },
        categoryId: edition.config.correctionCategories[0]?.id ?? '',
        sources,
      };
    case 'idiom':
      return {
        kind,
        id,
        expression: '',
        idiomType: 'idiom',
        primaryDefinition: '',
        extraDefinitions: [],
        examples: [],
        sources,
      };
    case 'synonym-row':
      return {
        kind: 'synonymRow',
        id,
        dominant: rowWord(),
        meaning: '',
        members: Array.from({ length: 5 }, rowWord),
        sources,
      };
  }
}
