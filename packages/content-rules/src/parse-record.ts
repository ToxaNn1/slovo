import {
  CorrectionSchema,
  CuratedCollectionSchema,
  IdiomSchema,
  SynonymRowSchema,
  TipSchema,
  WordSchema,
  type Correction,
  type CuratedCollection,
  type Idiom,
  type SynonymRow,
  type Tip,
  type Word,
} from '@slovo/contracts';
import type { z } from 'zod';

import type { Authored, Refusal } from './refusal';

/** A record of an Edition's content of one kind, with the file it is authored in. */
export type AuthoredRecord =
  | ({ readonly kind: 'word' } & Authored<Word>)
  | ({ readonly kind: 'correction' } & Authored<Correction>)
  | ({ readonly kind: 'idiom' } & Authored<Idiom>)
  | ({ readonly kind: 'synonymRow' } & Authored<SynonymRow>)
  | ({ readonly kind: 'tip' } & Authored<Tip>)
  | ({ readonly kind: 'curatedCollection' } & Authored<CuratedCollection>);

export type RecordKind = AuthoredRecord['kind'];

/**
 * Parses outside JSON as a record of its kind, where it enters: from an
 * Edition file or a save. Every problem is refused by the schema rule and
 * named by its field.
 */
export function parseRecord(
  kind: RecordKind,
  file: string,
  json: unknown,
): { ok: true; record: AuthoredRecord } | { ok: false; refusals: Refusal[] } {
  switch (kind) {
    case 'word':
      return recordOf(parseAgainst(WordSchema, file, json), (entry) => ({ kind, file, entry }));
    case 'correction':
      return recordOf(parseAgainst(CorrectionSchema, file, json), (entry) => ({ kind, file, entry }));
    case 'idiom':
      return recordOf(parseAgainst(IdiomSchema, file, json), (entry) => ({ kind, file, entry }));
    case 'synonymRow':
      return recordOf(parseAgainst(SynonymRowSchema, file, json), (entry) => ({ kind, file, entry }));
    case 'tip':
      return recordOf(parseAgainst(TipSchema, file, json), (entry) => ({ kind, file, entry }));
    case 'curatedCollection':
      return recordOf(parseAgainst(CuratedCollectionSchema, file, json), (entry) => ({
        kind,
        file,
        entry,
      }));
  }
}

function recordOf<T>(
  result: { ok: true; value: T } | { ok: false; refusals: Refusal[] },
  toRecord: (entry: T) => AuthoredRecord,
): { ok: true; record: AuthoredRecord } | { ok: false; refusals: Refusal[] } {
  return result.ok ? { ok: true, record: toRecord(result.value) } : result;
}

/**
 * JSON checked against a schema, with every problem refused by the schema rule
 * and named by its field. `entryId` names the record when its id can be read.
 */
export function parseAgainst<T>(
  schema: z.ZodType<T>,
  file: string,
  json: unknown,
  { isEntry = true }: { isEntry?: boolean } = {},
): { ok: true; value: T } | { ok: false; refusals: Refusal[] } {
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };
  const entryId = isEntry ? entryIdOf(json) : undefined;
  const refusals = result.error.issues.flatMap((issue) =>
    // An unknown key is reported on the object holding it, so name each key as the field.
    (issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => ({ path: [...issue.path, key], message: 'Unknown field' }))
      : [{ path: issue.path, message: issue.message }]
    ).map(({ path: fieldPath, message }) => ({
      rule: 'schema' as const,
      file,
      ...(entryId === undefined ? {} : { entryId }),
      ...(fieldPath.length === 0 ? {} : { field: fieldPath.join('.') }),
      message,
    })),
  );
  return { ok: false, refusals };
}

function entryIdOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('id' in value)) return undefined;
  return typeof value.id === 'string' && value.id !== '' ? value.id : undefined;
}
