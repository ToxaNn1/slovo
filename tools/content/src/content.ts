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
export const ENTRY_KINDS = { word: 'w_', correction: 'c_', idiom: 'i_' } as const;

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
    const { words, corrections, idioms } = edition.entries();
    taken = new Set([
      ...(edition.readIfPresent('idRegistry') ?? []),
      ...[...words, ...corrections, ...idioms].map(({ entry }) => entry.id),
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
 * owner leaves it. A file closed as it was before the command, or deleted,
 * is removed and nothing is recorded.
 */
async function editUntilRecorded(file: string, before: string, tool: ContentTool): Promise<number> {
  const { edition, editor, terminal } = tool;
  const path = join(edition.dir, file);
  for (;;) {
    editor.open(path);
    if (!existsSync(path) || readFileSync(path, 'utf8') === before) {
      rmSync(path, { force: true });
      terminal.print(`${file} closed unchanged: nothing written`);
      return 0;
    }
    const recorded = recordContent({ editionDir: edition.dir });
    if (recorded.ok) {
      terminal.print(`Recorded ${file}`);
      terminal.print(
        `  content version: ${String(recorded.contentVersion)} (was ${String(recorded.previousContentVersion)})`,
      );
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
  }
}
