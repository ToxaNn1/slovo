import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { formatBuildError, recordContent, type BuildError } from '@slovo/language-pack';
import { EditionFolderError, type EditionFile } from '@slovo/language-pack/edition';
import { entriesByText, matchKey } from '@slovo/sourcing';

import {
  draftEntry,
  ENTRY_KINDS,
  freshId,
  printContentVersion,
  reportProblems,
  takenIds,
  type ContentTool,
  type EntryKind,
} from './content';

/** The files a record writes, put back after a check with `record: false`. */
const RECORD_FILES: readonly EditionFile[] = ['idRegistry', 'manifest', 'crosswordDays'];

/** An Entry to import, read from the array or a draft, with where it came from. */
interface Incoming {
  /** The id issued or the draft's own. */
  readonly id: string;
  readonly fields: Record<string, unknown>;
  /** The array or the draft file, and the item's place in the array. */
  readonly origin: { readonly file: string; readonly field?: string };
}

/**
 * Imports Entries of one kind: a JSON array of new Entries, each issued an id
 * the Edition has never issued (ADR 0010), or a folder of ready drafts as
 * `source:*` writes them, each keeping its id. Before writing it refuses an
 * Entry whose text the Edition already has in any kind, Retired or not, a
 * text imported twice, and a draft id the Edition or another draft has.
 * It writes one file per Entry in the kind's folder, shaped as `new` drafts
 * it, then checks the whole Edition and records the content as `pnpm
 * build:pack --record` does; with `record: false` it checks the same and
 * records nothing, for a wave whose coordinator records once (ADR 0080). On
 * any problem it prints them as the build does, removes the files it wrote
 * and records nothing. Returns the exit code.
 */
export function importEntries(
  kind: EntryKind,
  source: string,
  { edition, terminal, random }: ContentTool,
  { record }: { record: boolean },
): number {
  const problems: BuildError[] = [];
  let taken: Set<string>;
  let incoming: Incoming[];
  let texts: ReturnType<typeof edition.entryTexts>;
  try {
    taken = takenIds(edition);
    texts = edition.entryTexts();
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    reportProblems(terminal, `Edition "${edition.id}"`, error.errors.map(formatBuildError));
    return 1;
  }
  const prefix = ENTRY_KINDS[kind];
  if (isFolder(source)) {
    incoming = readDrafts(source, problems);
    const seen = new Set<string>();
    for (const { id, origin } of incoming) {
      if (!id.startsWith(prefix)) {
        problems.push({
          ...origin,
          field: 'id',
          message: `"${id}" is not an id of kind ${kind}: those start with ${prefix}`,
        });
      } else if (
        taken.has(id) ||
        seen.has(id) ||
        existsSync(join(edition.dir, edition.entryFile(id)))
      ) {
        problems.push({
          ...origin,
          field: 'id',
          message: `The id "${id}" is already taken in the Edition`,
        });
      }
      seen.add(id);
    }
  } else {
    const issued = new Set(taken);
    incoming = readArray(source, problems).map(({ fields, field }) => {
      const id = freshId(prefix, issued, random);
      issued.add(id);
      return { id, fields, origin: { file: source, field } };
    });
  }

  const known = entriesByText(texts);
  const imported = new Set<string>();
  for (const { fields, origin } of incoming) {
    const text = textOf(kind, fields);
    if (text === undefined) continue;
    const ids = known(text).map(({ id, retired }) => (retired ? `${id} (retired)` : id));
    if (ids.length > 0) {
      problems.push({
        ...origin,
        message: `"${text}" is already an Entry of the Edition: ${ids.join(', ')}`,
      });
    } else if (imported.has(matchKey(text))) {
      problems.push({ ...origin, message: `"${text}" is imported twice` });
    }
    imported.add(matchKey(text));
  }
  if (problems.length > 0) {
    reportProblems(terminal, `Nothing imported`, problems.map(formatBuildError));
    return 1;
  }

  const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined);
  const recordFiles = RECORD_FILES.map((name) => {
    const path = edition.path(name);
    return { path, before: read(path) };
  });
  const written: { file: string; path: string }[] = [];
  // Failed until recorded, so that a throw on the way cleans up as a refusal does.
  let recorded: ReturnType<typeof recordContent> = { ok: false, errors: [] };
  try {
    for (const { id, fields } of incoming) {
      const file = edition.entryFile(id);
      const path = join(edition.dir, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(shaped(kind, id, fields, edition), null, 2)}\n`);
      written.push({ file, path });
    }
    recorded = recordContent({ editionDir: edition.dir });
  } finally {
    if (!record || !recorded.ok) {
      for (const { path, before } of recordFiles) {
        if (read(path) === before) continue;
        if (before === undefined) rmSync(path, { force: true });
        else writeFileSync(path, before);
      }
    }
    if (!recorded.ok) for (const { path } of written) rmSync(path, { force: true });
  }
  if (!recorded.ok) {
    reportProblems(terminal, 'Nothing imported', recorded.errors.map(formatBuildError));
    return 1;
  }
  terminal.print(`Imported ${String(written.length)} ${kind} Entries:`);
  for (const { file } of written) terminal.print(`  ${file}`);
  if (record) printContentVersion(terminal, recorded);
  else terminal.print(`  not recorded: record them with pnpm build:pack ${edition.id} --record`);
  return 0;
}

function isFolder(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

/** The items of a JSON array of objects; an id an item carries is replaced. */
function readArray(
  file: string,
  problems: BuildError[],
): { fields: Record<string, unknown>; field: string }[] {
  const items = readJson(file, problems);
  if (items === undefined) return [];
  if (!Array.isArray(items)) {
    problems.push({ file, message: 'Not a JSON array of Entries' });
    return [];
  }
  return items.flatMap((item: unknown, index) => {
    const field = `[${String(index)}]`;
    if (isRecord(item)) return [{ fields: item, field }];
    problems.push({ file, field, message: 'Not a JSON object' });
    return [];
  });
}

/** The drafts of a folder, in file order, each with its own id. */
function readDrafts(folder: string, problems: BuildError[]): Incoming[] {
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .toSorted()
    .flatMap((name) => {
      const file = join(folder, name);
      const draft = readJson(file, problems);
      if (draft === undefined) return [];
      if (!isRecord(draft) || typeof draft['id'] !== 'string') {
        problems.push({ file, field: 'id', message: 'Not a draft with an id' });
        return [];
      }
      return [{ id: draft['id'], fields: draft, origin: { file } }];
    });
}

function readJson(file: string, problems: BuildError[]): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    problems.push({ file, message: 'Unreadable or invalid JSON' });
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The text an Entry of the kind is known by, as `have` lists it; undefined when it has none yet. */
function textOf(kind: EntryKind, fields: Record<string, unknown>): string | undefined {
  const field = (value: unknown, key: string) => (isRecord(value) ? value[key] : undefined);
  const text = {
    word: () => fields['lemma'],
    correction: () => fields['nonStandardForm'],
    idiom: () => fields['expression'],
    'synonym-row': () => field(fields['dominant'], 'text'),
    tip: () => fields['title'],
  }[kind]();
  return typeof text === 'string' && text.trim() !== '' ? text : undefined;
}

/** The Entry with the kind and id `new` gives it and its fields in the order `new` drafts them. */
function shaped(
  kind: EntryKind,
  id: string,
  fields: Record<string, unknown>,
  edition: ContentTool['edition'],
): Record<string, unknown> {
  const draft = draftEntry(kind, id, edition);
  const entry: Record<string, unknown> = { ...fields, kind: draft['kind'], id };
  const order = [...Object.keys(draft), ...Object.keys(fields)];
  return Object.fromEntries(
    [...new Set(order)].filter((key) => key in entry).map((key) => [key, entry[key]]),
  );
}
