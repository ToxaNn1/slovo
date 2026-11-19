import {
  type AuthoredRecord,
  type RecordKind,
  type Refusal,
  recordIdOf,
} from '@slovo/content-rules';
import type { Word } from '@slovo/contracts';
import { collectionAppearance, editionDayStart, type Json } from '@slovo/server-core';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import type { Database } from '../database/database';
import {
  actionLog,
  contentCorrections,
  contentCrosswordDays,
  contentCuratedCollections,
  contentIdioms,
  contentSynonymRows,
  contentTips,
  contentVersions,
  contentWords,
  mediaRecordings,
  type ContentAuthor,
} from '../database/schema';

/**
 * The one writer of a content record of any kind (ADR 0090): the table of
 * each kind, the rules a save of each kind keeps, the content version a
 * write publishes and the Action log row it leaves. The save of the content
 * write API, the Content queue's rollback and the import all write through it.
 */

type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

/** The kinds given, which must be every kind of record. */
const everyKind = <const K extends readonly RecordKind[]>(
  kinds: K & (Exclude<RecordKind, K[number]> extends never ? unknown : never),
) => kinds;

/** The kinds of record, one table each (ADR 0090). */
export const RECORD_KINDS = everyKind([
  'word',
  'correction',
  'idiom',
  'synonymRow',
  'tip',
  'curatedCollection',
  'crosswordDay',
]);
export const RecordKindSchema = z.enum(RECORD_KINDS);

/** The kinds of record that are Entries, which a Mistake Report names (ADR 0056). */
export const ENTRY_KINDS = ['word', 'correction', 'idiom', 'synonymRow', 'tip'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** The table of each kind of record. */
export const TABLES = {
  word: contentWords,
  correction: contentCorrections,
  idiom: contentIdioms,
  synonymRow: contentSynonymRows,
  tip: contentTips,
  curatedCollection: contentCuratedCollections,
  crosswordDay: contentCrosswordDays,
} as const satisfies Record<RecordKind, unknown>;

/** The Edition's content version, held to the commit; none while it is not imported. */
export async function holdContentVersion(
  tx: Transaction,
  editionId: string,
): Promise<number | undefined> {
  // An Edition's writes run one at a time until the commit.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${editionId}))`);
  const [held] = await tx
    .select({ contentVersion: contentVersions.contentVersion })
    .from(contentVersions)
    .where(eq(contentVersions.editionId, editionId))
    .for('update');
  return held?.contentVersion;
}

/** Publishes the Edition's next content version, held by `holdContentVersion`. */
export async function publishContentVersion(
  tx: Transaction,
  editionId: string,
  contentVersion: number,
  now: Date,
): Promise<void> {
  await tx
    .update(contentVersions)
    .set({ contentVersion, updatedAt: now })
    .where(eq(contentVersions.editionId, editionId));
}

/** Whether a Word's Recordings, made from `read`, no longer read its fields (ADR 0083). */
export function readsDifferently(
  fields: Pick<Word, 'lemma' | 'stress'>,
  read: Pick<Word, 'lemma' | 'stress'>,
): boolean {
  return (
    fields.lemma !== read.lemma || JSON.stringify(fields.stress) !== JSON.stringify(read.stress)
  );
}

/**
 * Whether the saved Word needs a new Recording: a Word whose Lemma or Stress
 * the save changes no longer reads as its Recordings, so they retire at the
 * saved content version, in the same transaction, and it needs new ones
 * (ADR 0083, 0099, 0195). Once set, only the narrator-voice work clears it.
 */
export async function needsNewRecordingOf(
  tx: Pick<Transaction, 'update'>,
  {
    editionId,
    word,
    before,
    contentVersion,
    now,
  }: {
    editionId: string;
    word: Pick<Word, 'id' | 'lemma' | 'stress'>;
    before: { readonly fields: Word; readonly needsNewRecording: boolean } | undefined;
    contentVersion: number;
    now: Date;
  },
): Promise<boolean> {
  if (before === undefined) return false;
  const changed = readsDifferently(before.fields, word);
  if (changed) {
    await tx
      .update(mediaRecordings)
      .set({ retiredAt: now, contentVersion })
      .where(
        and(
          eq(mediaRecordings.editionId, editionId),
          eq(mediaRecordings.wordId, word.id),
          isNull(mediaRecordings.retiredAt),
        ),
      );
  }
  return before.needsNewRecording || changed;
}

/** A Curated Collection as its row keeps it beside its fields: when it appeared. */
export interface Appearance {
  readonly publishedOn: string;
  readonly appearedAt: Date;
}

/**
 * How a save comes: an author's (the content write API) or a restore of
 * content the Edition had (the Content queue's rollback, the import).
 */
export type SaveSource = 'authored' | 'restored';

/**
 * When an authored Curated Collection appears, and why the save is refused
 * by it (ADR 0178): an appeared collection keeps its publish date; one not
 * appeared yet appears anew by the date it is saved with.
 */
export function authoredAppearance(
  publishedOn: string,
  before: Appearance | undefined,
  now: Date,
  file: string,
):
  | { readonly ok: true; readonly appearedAt: Date }
  | { readonly ok: false; readonly refusal: Refusal } {
  if (before === undefined) return { ok: true, appearedAt: collectionAppearance(publishedOn, now) };
  if (publishedOn === before.publishedOn) return { ok: true, appearedAt: before.appearedAt };
  if (before.appearedAt <= now) {
    return {
      ok: false,
      refusal: {
        rule: 'curated-collection-appeared',
        file,
        field: 'publishedOn',
        message: `The collection appeared on ${before.publishedOn} and keeps that date`,
      },
    };
  }
  return { ok: true, appearedAt: collectionAppearance(publishedOn, now) };
}

/**
 * When a restored Curated Collection appears (ADR 0178): it keeps its
 * appearance, or appears from the start of the publish date it is restored
 * with, as an imported one does.
 */
export function restoredAppearance(publishedOn: string, before: Appearance | undefined): Date {
  return before?.publishedOn === publishedOn ? before.appearedAt : editionDayStart(publishedOn);
}

/** The columns a save of a record sets beside its fields. */
export interface SavedRow {
  readonly editionId: string;
  readonly recordVersion: number;
  readonly contentVersion: number;
  readonly changedBy: ContentAuthor;
  readonly changedAt: Date;
  readonly batchId: string;
}

/** What a save wrote, or why its kind's rules refused it. */
export type Saved =
  | { readonly ok: true; readonly needsNewRecording: boolean }
  | { readonly ok: false; readonly refusal: Refusal };

/**
 * Writes the record's row at its new versions, a new row or over the row of
 * its id, by the rules of its kind. A refusal writes nothing; a restore is
 * never refused.
 */
export async function saveRecord(
  tx: Transaction,
  record: AuthoredRecord,
  row: SavedRow,
  source: 'restored',
): Promise<Extract<Saved, { ok: true }>>;
export async function saveRecord(
  tx: Transaction,
  record: AuthoredRecord,
  row: SavedRow,
  source: SaveSource,
): Promise<Saved>;
export async function saveRecord(
  tx: Transaction,
  record: AuthoredRecord,
  row: SavedRow,
  source: SaveSource,
): Promise<Saved> {
  const { editionId, changedAt: now } = row;
  const id = recordIdOf(record);
  const key = {
    ...row,
    id,
    retired: 'retired' in record.entry && record.entry.retired === true,
  };
  const ofId = (table: { editionId: AnyPgColumn; id: AnyPgColumn }) =>
    and(eq(table.editionId, editionId), eq(table.id, id));
  switch (record.kind) {
    case 'word': {
      const [before] = await tx
        .select({
          fields: contentWords.fields,
          needsNewRecording: contentWords.needsNewRecording,
        })
        .from(contentWords)
        .where(ofId(contentWords));
      const needsNewRecording = await needsNewRecordingOf(tx, {
        editionId,
        word: record.entry,
        before,
        contentVersion: row.contentVersion,
        now,
      });
      const saved = { ...key, fields: record.entry, needsNewRecording };
      await tx
        .insert(contentWords)
        .values(saved)
        .onConflictDoUpdate({ target: [contentWords.editionId, contentWords.id], set: saved });
      return { ok: true, needsNewRecording };
    }
    case 'curatedCollection': {
      const [before] = await tx
        .select({
          fields: contentCuratedCollections.fields,
          appearedAt: contentCuratedCollections.appearedAt,
        })
        .from(contentCuratedCollections)
        .where(ofId(contentCuratedCollections));
      const { publishedOn } = record.entry;
      const kept =
        before === undefined
          ? undefined
          : { publishedOn: before.fields.publishedOn, appearedAt: before.appearedAt };
      const appearance =
        source === 'restored'
          ? { ok: true as const, appearedAt: restoredAppearance(publishedOn, kept) }
          : authoredAppearance(publishedOn, kept, now, record.file);
      if (!appearance.ok) return appearance;
      const saved = { ...key, fields: record.entry, appearedAt: appearance.appearedAt };
      await tx
        .insert(contentCuratedCollections)
        .values(saved)
        .onConflictDoUpdate({
          target: [contentCuratedCollections.editionId, contentCuratedCollections.id],
          set: saved,
        });
      return { ok: true, needsNewRecording: false };
    }
    case 'correction': {
      const saved = { ...key, fields: record.entry };
      await tx
        .insert(contentCorrections)
        .values(saved)
        .onConflictDoUpdate({
          target: [contentCorrections.editionId, contentCorrections.id],
          set: saved,
        });
      return { ok: true, needsNewRecording: false };
    }
    case 'idiom': {
      const saved = { ...key, fields: record.entry };
      await tx
        .insert(contentIdioms)
        .values(saved)
        .onConflictDoUpdate({ target: [contentIdioms.editionId, contentIdioms.id], set: saved });
      return { ok: true, needsNewRecording: false };
    }
    case 'synonymRow': {
      const saved = { ...key, fields: record.entry };
      await tx
        .insert(contentSynonymRows)
        .values(saved)
        .onConflictDoUpdate({
          target: [contentSynonymRows.editionId, contentSynonymRows.id],
          set: saved,
        });
      return { ok: true, needsNewRecording: false };
    }
    case 'tip': {
      const saved = { ...key, fields: record.entry };
      await tx
        .insert(contentTips)
        .values(saved)
        .onConflictDoUpdate({ target: [contentTips.editionId, contentTips.id], set: saved });
      return { ok: true, needsNewRecording: false };
    }
    case 'crosswordDay': {
      const saved = { ...key, fields: record.entry };
      await tx
        .insert(contentCrosswordDays)
        .values(saved)
        .onConflictDoUpdate({
          target: [contentCrosswordDays.editionId, contentCrosswordDays.id],
          set: saved,
        });
      return { ok: true, needsNewRecording: false };
    }
  }
}

/** What a write does to its record. */
export const WriteOpSchema = z.enum(['create', 'edit', 'retire']);
export type WriteOp = z.infer<typeof WriteOpSchema>;

/** A record as a write's Action log row keeps it. */
interface LoggedRecord {
  readonly recordVersion: number;
  readonly fields: object;
}

const WhatSchema = z.templateLiteral(['content.', RecordKindSchema, '.', WriteOpSchema]);
const LoggedSchema = z.object({
  recordVersion: z.number().int(),
  // A Crossword day's id is its date.
  fields: z.looseObject({ id: z.string().optional(), date: z.string().optional() }),
});

/** A record as JSON, for the Action log's columns: undefined fields are left out, as JSON leaves them. */
function toJson(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value !== 'object') return null;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, field]) => field !== undefined)
      .map(([key, field]) => [key, toJson(field)]),
  );
}

/** The columns of a write's Action log row that say what it did: the record before and after. */
export function writeLogged(
  kind: RecordKind,
  op: WriteOp,
  before: LoggedRecord | undefined,
  after: LoggedRecord,
): { what: string; before: Json; after: Json } {
  return {
    what: `content.${kind}.${op}`,
    before:
      before === undefined
        ? null
        : toJson({ recordVersion: before.recordVersion, fields: before.fields }),
    after: toJson({ recordVersion: after.recordVersion, fields: after.fields }),
  };
}

/** The write an Action log row logged, with the record's fields before it; none for another row. */
export function loggedWrite(row: {
  readonly what: string;
  readonly before: Json;
  readonly after: Json;
}):
  | {
      readonly kind: RecordKind;
      readonly id: string;
      readonly op: WriteOp;
      readonly fieldsBefore: Readonly<Record<string, unknown>> | undefined;
    }
  | undefined {
  const what = WhatSchema.safeParse(row.what);
  if (!what.success) return undefined;
  const [, kind, op] = what.data.split('.');
  const { fields } = LoggedSchema.parse(row.after);
  const before = row.before === null ? undefined : LoggedSchema.parse(row.before).fields;
  return {
    kind: RecordKindSchema.parse(kind),
    id: fields.id ?? fields.date ?? '',
    op: WriteOpSchema.parse(op),
    fieldsBefore: before,
  };
}

/** A write's Action log row, its kind, its record's id and its op, as the database reads them. */
export const logged = {
  isWrite: sql`${actionLog.what} ~ ${`^content\\.(${RECORD_KINDS.join('|')})\\.(${WriteOpSchema.options.join('|')})$`}`,
  kind: sql`split_part(${actionLog.what}, '.', 2)`,
  id: sql`coalesce(${actionLog.after}->'fields'->>'id', ${actionLog.after}->'fields'->>'date', '')`,
  op: sql<string>`split_part(${actionLog.what}, '.', 3)`,
};
