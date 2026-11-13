/**
 * The records a command sends: a JSON array of records, or a folder of
 * drafts, one JSON file per record. The backend issues the ids, so an id a
 * draft carries is left out; `verify` reads the drafts with their ids.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Incoming {
  /** The record's fields without an id. */
  readonly fields: Record<string, unknown>;
  /** The array and the item's place in it, or the draft file. */
  readonly origin: string;
}

/** The records of an array file or a drafts folder; a problem names its file. */
export function readIncoming(
  path: string,
): { ok: true; records: Incoming[] } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const records = isFolder(path) ? readDrafts(path, problems) : readArray(path, problems);
  return problems.length === 0 ? { ok: true, records } : { ok: false, problems };
}

/** One JSON object of a file, as `edit` reads it. */
export function readObject(
  file: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; problem: string } {
  const problems: string[] = [];
  const value = readJson(file, problems);
  if (value === undefined) return { ok: false, problem: problems.join('\n') };
  return isObject(value)
    ? { ok: true, value }
    : { ok: false, problem: `${file}: Not a JSON object` };
}

function isFolder(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

function readArray(file: string, problems: string[]): Incoming[] {
  const items = readJson(file, problems);
  if (items === undefined) return [];
  if (!Array.isArray(items)) {
    problems.push(`${file}: Not a JSON array of records`);
    return [];
  }
  return items.flatMap((item: unknown, index) => {
    const origin = `${file}[${String(index)}]`;
    if (isObject(item)) return [{ fields: withoutId(item), origin }];
    problems.push(`${origin}: Not a JSON object`);
    return [];
  });
}

function readDrafts(folder: string, problems: string[]): Incoming[] {
  return draftsOf(jsonFilesIn(folder), problems).map(({ draft, file }) => ({
    fields: withoutId(draft),
    origin: file,
  }));
}

/**
 * The drafts of a folder, or the one draft of a file, as `verify` reads them:
 * each with its file and the id it carries.
 */
export function readDraftFiles(
  path: string,
): { ok: true; drafts: Draft[] } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const drafts = draftsOf(isFolder(path) ? jsonFilesIn(path) : [path], problems);
  return problems.length === 0 ? { ok: true, drafts } : { ok: false, problems };
}

export interface Draft {
  readonly draft: Record<string, unknown>;
  readonly file: string;
}

function jsonFilesIn(folder: string): string[] {
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .toSorted()
    .map((name) => join(folder, name));
}

function draftsOf(files: readonly string[], problems: string[]): Draft[] {
  return files.flatMap((file) => {
    const draft = readJson(file, problems);
    if (draft === undefined) return [];
    if (isObject(draft)) return [{ draft, file }];
    problems.push(`${file}: Not a JSON object`);
    return [];
  });
}

function readJson(file: string, problems: string[]): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    problems.push(`${file}: Unreadable or invalid JSON`);
    return undefined;
  }
}

export function withoutId(fields: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = fields;
  return rest;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
