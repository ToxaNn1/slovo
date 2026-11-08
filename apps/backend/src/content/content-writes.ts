import {
  checkRecord,
  contentSetOf,
  parseRecord,
  recordFileOf,
  type AuthoredRecord,
  type RecordKind,
  type Refusal,
} from '@slovo/content-rules';
import { contentReport, missedTargets } from '@slovo/language-pack';
import type { Clock, EditionRegistry, Json, Random } from '@slovo/server-core';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../database/database';
import { quoteCheckCounts } from './quote-check';
import {
  actionLog,
  contentBatches,
  contentCorrections,
  contentCuratedCollections,
  contentIdioms,
  contentIds,
  contentSynonymRows,
  contentTips,
  contentVersions,
  contentWords,
  type ContentAuthor,
} from '../database/schema';

/** The id prefix of each kind of record (ADR 0010). */
const ID_PREFIX: Record<RecordKind, string> = {
  word: 'w_',
  correction: 'c_',
  idiom: 'i_',
  synonymRow: 'r_',
  tip: 't_',
  curatedCollection: 'cc_',
};

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 6;

/** What a write published. */
export interface Written {
  readonly id: string;
  readonly recordVersion: number;
  readonly contentVersion: number;
  readonly batchId: string;
  readonly needsNewRecording?: boolean;
}

/** Why a write or a read of the content queue was not done. */
export type WriteRefusal =
  | { readonly ok: false; readonly reason: 'not-found' | 'not-imported' }
  | { readonly ok: false; readonly reason: 'refused'; readonly refusals: readonly Refusal[] }
  | { readonly ok: false; readonly reason: 'stale'; readonly currentVersion: number };

export type WriteResult = { readonly ok: true; readonly written: Written } | WriteRefusal;

/** Who a write comes from: an Агент by its token, or an Admin user of a session in the content editor. */
export type Writer =
  | { readonly kind: 'agent'; readonly name: string }
  | { readonly kind: 'admin-user'; readonly email: string };

/** The Action log's name for the writer. */
const whoOf = (writer: Writer) =>
  writer.kind === 'agent'
    ? { kind: 'agent' as const, name: writer.name }
    : { kind: 'admin-user' as const, email: writer.email };

/** The field a record of each kind is listed by in the content editor. */
const LABEL_FIELD: Readonly<Record<RecordKind, string>> = {
  word: 'lemma',
  correction: 'nonStandardForm',
  idiom: 'expression',
  synonymRow: 'dominant',
  tip: 'title',
  curatedCollection: 'name',
};

/** The text a record is listed and searched by. */
function labelOf(kind: RecordKind, fields: Readonly<Record<string, unknown>>): string {
  const value = fields[LABEL_FIELD[kind]];
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const text = Object.values(value).find((part) => typeof part === 'string');
    if (typeof text === 'string') return text;
  }
  return typeof fields['id'] === 'string' ? fields['id'] : '';
}

/** One write of a record: what it changes, from which record version, in which batch. */
export type ContentWrite =
  | { readonly op: 'create'; readonly fields: Readonly<Record<string, unknown>> }
  | {
      readonly op: 'edit';
      readonly id: string;
      readonly recordVersion: number;
      readonly fields: Readonly<Record<string, unknown>>;
    }
  | { readonly op: 'retire'; readonly id: string; readonly recordVersion: number };

/** A record as a row keeps it: the fields with what each save keeps beside them. */
interface StoredRecord {
  readonly id: string;
  readonly fields: { readonly id: string };
  readonly recordVersion: number;
}

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

/**
 * The content write API's store (ADR 0090): every write runs in one
 * transaction, one at a time per Edition, through the shared content rules,
 * and publishes a new content version with its Action log row.
 */
export function createContentWrites({
  database,
  clock,
  random,
  editions,
}: {
  database: Database;
  clock: Clock;
  random: Random;
  editions: EditionRegistry;
}) {
  const { db } = database;
  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  /** Every record of the Edition, by kind. */
  async function recordsOf(tx: Tx, editionId: string) {
    const word = await tx
      .select({
        id: contentWords.id,
        fields: contentWords.fields,
        recordVersion: contentWords.recordVersion,
        needsNewRecording: contentWords.needsNewRecording,
      })
      .from(contentWords)
      .where(eq(contentWords.editionId, editionId));
    const correction = await tx
      .select({
        id: contentCorrections.id,
        fields: contentCorrections.fields,
        recordVersion: contentCorrections.recordVersion,
      })
      .from(contentCorrections)
      .where(eq(contentCorrections.editionId, editionId));
    const idiom = await tx
      .select({
        id: contentIdioms.id,
        fields: contentIdioms.fields,
        recordVersion: contentIdioms.recordVersion,
      })
      .from(contentIdioms)
      .where(eq(contentIdioms.editionId, editionId));
    const synonymRow = await tx
      .select({
        id: contentSynonymRows.id,
        fields: contentSynonymRows.fields,
        recordVersion: contentSynonymRows.recordVersion,
      })
      .from(contentSynonymRows)
      .where(eq(contentSynonymRows.editionId, editionId));
    const tip = await tx
      .select({
        id: contentTips.id,
        fields: contentTips.fields,
        recordVersion: contentTips.recordVersion,
      })
      .from(contentTips)
      .where(eq(contentTips.editionId, editionId));
    const curatedCollection = await tx
      .select({
        id: contentCuratedCollections.id,
        fields: contentCuratedCollections.fields,
        recordVersion: contentCuratedCollections.recordVersion,
      })
      .from(contentCuratedCollections)
      .where(eq(contentCuratedCollections.editionId, editionId));
    return { word, correction, idiom, synonymRow, tip, curatedCollection };
  }

  /** The Edition's content version, held to the commit; none while it is not imported. */
  async function heldVersion(tx: Tx, editionId: string) {
    // An Edition's writes run one at a time until the commit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${editionId}))`);
    const [held] = await tx
      .select({ contentVersion: contentVersions.contentVersion })
      .from(contentVersions)
      .where(eq(contentVersions.editionId, editionId))
      .for('update');
    return held?.contentVersion;
  }

  /** Opens a batch of the Агент's writes to the Edition. */
  async function openBatch(
    writer: Writer,
    editionId: string,
  ): Promise<{ ok: true; batchId: string } | WriteRefusal> {
    if (editions.find(editionId) === undefined) return { ok: false, reason: 'not-found' };
    return db.transaction(async (tx) => {
      if ((await heldVersion(tx, editionId)) === undefined) {
        return { ok: false, reason: 'not-imported' } as const;
      }
      const [batch] = await tx
        .insert(contentBatches)
        .values({ editionId, changedBy: authorOf(writer), createdAt: clock.now() })
        .returning({ id: contentBatches.id });
      if (batch === undefined) throw new Error('the batch was not written');
      return { ok: true, batchId: batch.id } as const;
    });
  }

  const authorOf = (writer: Writer): ContentAuthor =>
    writer.kind === 'agent' ? `agent:${writer.name}` : `admin:${writer.email}`;

  /** Whether the batch is the Агент's own, of the Edition. */
  async function ownBatch(tx: Tx, writer: Writer, editionId: string, batchId: string) {
    const [batch] = await tx
      .select({ id: contentBatches.id })
      .from(contentBatches)
      .where(
        and(
          eq(contentBatches.id, batchId),
          eq(contentBatches.editionId, editionId),
          eq(contentBatches.changedBy, authorOf(writer)),
        ),
      );
    return batch !== undefined;
  }

  /** A new id of the kind that the Edition never gave, registered at once. */
  async function newId(tx: Tx, editionId: string, kind: RecordKind) {
    for (;;) {
      let id = ID_PREFIX[kind];
      for (let index = 0; index < ID_LENGTH; index += 1) {
        id += ID_ALPHABET.charAt(random.int(ID_ALPHABET.length));
      }
      const [registered] = await tx
        .insert(contentIds)
        .values({ editionId, id, registeredAt: clock.now() })
        .onConflictDoNothing()
        .returning({ id: contentIds.id });
      if (registered !== undefined) return id;
    }
  }

  /** Writes the record's row at its new versions. */
  async function saveRow(
    tx: Tx,
    record: AuthoredRecord,
    common: {
      editionId: string;
      recordVersion: number;
      contentVersion: number;
      changedBy: ContentAuthor;
      changedAt: Date;
      batchId: string;
    },
    needsNewRecording: boolean,
  ) {
    const key = {
      id: record.entry.id,
      retired: 'retired' in record.entry && record.entry.retired,
      ...common,
    };
    switch (record.kind) {
      case 'word': {
        const row = { ...key, fields: record.entry, needsNewRecording };
        await tx
          .insert(contentWords)
          .values(row)
          .onConflictDoUpdate({ target: [contentWords.editionId, contentWords.id], set: row });
        return;
      }
      case 'correction': {
        const row = { ...key, fields: record.entry };
        await tx
          .insert(contentCorrections)
          .values(row)
          .onConflictDoUpdate({
            target: [contentCorrections.editionId, contentCorrections.id],
            set: row,
          });
        return;
      }
      case 'idiom': {
        const row = { ...key, fields: record.entry };
        await tx
          .insert(contentIdioms)
          .values(row)
          .onConflictDoUpdate({ target: [contentIdioms.editionId, contentIdioms.id], set: row });
        return;
      }
      case 'synonymRow': {
        const row = { ...key, fields: record.entry };
        await tx
          .insert(contentSynonymRows)
          .values(row)
          .onConflictDoUpdate({
            target: [contentSynonymRows.editionId, contentSynonymRows.id],
            set: row,
          });
        return;
      }
      case 'tip': {
        const row = { ...key, fields: record.entry };
        await tx
          .insert(contentTips)
          .values(row)
          .onConflictDoUpdate({ target: [contentTips.editionId, contentTips.id], set: row });
        return;
      }
      case 'curatedCollection': {
        const row = { ...key, fields: record.entry };
        await tx
          .insert(contentCuratedCollections)
          .values(row)
          .onConflictDoUpdate({
            target: [contentCuratedCollections.editionId, contentCuratedCollections.id],
            set: row,
          });
        return;
      }
    }
  }

  /**
   * Checks one write by the content rules and publishes it as the next
   * content version, with its Action log row, in one transaction: a
   * refusal writes nothing.
   */
  async function write(
    writer: Writer,
    {
      editionId,
      kind,
      batchId,
      reason,
      change,
    }: {
      editionId: string;
      kind: RecordKind;
      batchId: string;
      reason?: string | undefined;
      change: ContentWrite;
    },
  ): Promise<WriteResult> {
    const edition = editions.find(editionId);
    if (edition === undefined) return { ok: false, reason: 'not-found' };
    return db.transaction(async (tx): Promise<WriteResult> => {
      const contentVersion = await heldVersion(tx, editionId);
      if (contentVersion === undefined) return { ok: false, reason: 'not-imported' };
      if (!(await ownBatch(tx, writer, editionId, batchId))) {
        return { ok: false, reason: 'not-found' };
      }
      const records = await recordsOf(tx, editionId);
      let current: StoredRecord | undefined;
      if (change.op !== 'create') {
        current = records[kind].find(({ id }) => id === change.id);
        if (current === undefined) return { ok: false, reason: 'not-found' };
        if (current.recordVersion !== change.recordVersion) {
          return { ok: false, reason: 'stale', currentVersion: current.recordVersion };
        }
      }
      const id = current?.id ?? (await newId(tx, editionId, kind));
      const fields =
        change.op === 'retire' ? { ...current?.fields, retired: true } : { ...change.fields, id };
      const parsed = parseRecord(kind, recordFileOf(kind, id), fields);
      if (!parsed.ok) return { ok: false, reason: 'refused', refusals: parsed.refusals };
      const { record } = parsed;
      const fieldsOf = <T>(rows: readonly { readonly fields: T }[]) =>
        rows.map((row) => row.fields);
      const set = contentSetOf({
        word: fieldsOf(records.word),
        correction: fieldsOf(records.correction),
        idiom: fieldsOf(records.idiom),
        synonymRow: fieldsOf(records.synonymRow),
        tip: fieldsOf(records.tip),
        curatedCollection: fieldsOf(records.curatedCollection),
      });
      const now = clock.now();
      const refusals = checkRecord(edition.config, set, record, { today: now });
      if (refusals.length > 0) return { ok: false, reason: 'refused', refusals };

      const recordVersion = (current?.recordVersion ?? 0) + 1;
      const published = contentVersion + 1;
      // A Word's Recordings no longer read it once its Lemma or Stress changed (ADR 0083).
      const wordBefore = records.word.find((row) => row.id === id);
      const needsNewRecording =
        record.kind === 'word' &&
        wordBefore !== undefined &&
        (wordBefore.needsNewRecording ||
          wordBefore.fields.lemma !== record.entry.lemma ||
          JSON.stringify(wordBefore.fields.stress) !== JSON.stringify(record.entry.stress));
      await saveRow(
        tx,
        record,
        {
          editionId,
          recordVersion,
          contentVersion: published,
          changedBy: authorOf(writer),
          changedAt: now,
          batchId,
        },
        needsNewRecording,
      );
      await tx
        .update(contentVersions)
        .set({ contentVersion: published, updatedAt: now })
        .where(eq(contentVersions.editionId, editionId));
      await tx.insert(actionLog).values({
        who: whoOf(writer),
        at: now,
        what: `content.${kind}.${change.op}`,
        before:
          current === undefined
            ? null
            : toJson({ recordVersion: current.recordVersion, fields: current.fields }),
        after: toJson({ recordVersion, fields: record.entry }),
        reason: reason ?? null,
        editionId,
        batchId,
      });
      return {
        ok: true,
        written: {
          id,
          recordVersion,
          contentVersion: published,
          batchId,
          ...(kind === 'word' ? { needsNewRecording } : {}),
        },
      };
    });
  }

  /** Flags a record for the Content queue: an Action log row, no change of the content. */
  async function flag(
    writer: Writer,
    {
      editionId,
      kind,
      id,
      batchId,
      reason,
    }: { editionId: string; kind: RecordKind; id: string; batchId: string; reason: string },
  ): Promise<{ ok: true } | WriteRefusal> {
    if (editions.find(editionId) === undefined) return { ok: false, reason: 'not-found' };
    return db.transaction(async (tx): Promise<{ ok: true } | WriteRefusal> => {
      if ((await heldVersion(tx, editionId)) === undefined) {
        return { ok: false, reason: 'not-imported' };
      }
      if (!(await ownBatch(tx, writer, editionId, batchId))) {
        return { ok: false, reason: 'not-found' };
      }
      const current = (await recordsOf(tx, editionId))[kind].find((row) => row.id === id);
      if (current === undefined) return { ok: false, reason: 'not-found' };
      await tx.insert(actionLog).values({
        who: whoOf(writer),
        at: clock.now(),
        what: `content.${kind}.flag`,
        before: null,
        after: null,
        reason,
        editionId,
        batchId,
      });
      return { ok: true };
    });
  }

  /** The counts of the Edition's live content against its content targets. */
  async function report(editionId: string) {
    const edition = editions.find(editionId);
    if (edition === undefined) return { ok: false, reason: 'not-found' } as const;
    return db.transaction(
      async (tx) => {
        const [held] = await tx
          .select({ contentVersion: contentVersions.contentVersion })
          .from(contentVersions)
          .where(eq(contentVersions.editionId, editionId));
        if (held === undefined) return { ok: false, reason: 'not-imported' } as const;
        const records = await recordsOf(tx, editionId);
        const fieldsOf = <T>(rows: readonly { readonly fields: T }[]) =>
          rows.map((row) => row.fields);
        const counted = contentReport({
          categories: edition.config.categories,
          correctionCategories: edition.config.correctionCategories,
          words: fieldsOf(records.word),
          corrections: fieldsOf(records.correction),
          idioms: fieldsOf(records.idiom),
        });
        return {
          ok: true as const,
          contentVersion: held.contentVersion,
          // The API's arrays are its own.
          report: {
            ...counted,
            wordsPerCategory: [...counted.wordsPerCategory],
            rarity: [...counted.rarity],
            correctionsPerType: [...counted.correctionsPerType],
            correctionsPerCategory: [...counted.correctionsPerCategory],
            idiomsPerType: [...counted.idiomsPerType],
          },
          targets: edition.targets,
          missed: missedTargets(counted, edition.targets),
          quoteCheck: await quoteCheckCounts(tx, editionId),
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  /** A record's fields and its record version, which an edit is made from. */
  async function record(editionId: string, kind: RecordKind, id: string) {
    if (editions.find(editionId) === undefined) return { ok: false, reason: 'not-found' } as const;
    return db.transaction(async (tx) => {
      if ((await heldVersion(tx, editionId)) === undefined) {
        return { ok: false, reason: 'not-imported' } as const;
      }
      const current = (await recordsOf(tx, editionId))[kind].find((row) => row.id === id);
      if (current === undefined) return { ok: false, reason: 'not-found' } as const;
      return {
        ok: true,
        fields: current.fields,
        recordVersion: current.recordVersion,
        retired: 'retired' in current.fields && current.fields.retired,
        ...('needsNewRecording' in current ? { needsNewRecording: current.needsNewRecording } : {}),
      } as const;
    });
  }

  /** The records of a kind the content editor lists: by a text query in their label, retired ones on request. */
  async function list(
    editionId: string,
    kind: RecordKind,
    {
      query = '',
      retired = false,
    }: { query?: string | undefined; retired?: boolean | undefined } = {},
  ) {
    if (editions.find(editionId) === undefined) return { ok: false, reason: 'not-found' } as const;
    return db.transaction(async (tx) => {
      if ((await heldVersion(tx, editionId)) === undefined) {
        return { ok: false, reason: 'not-imported' } as const;
      }
      const needle = query.trim().toLocaleLowerCase();
      const records = (await recordsOf(tx, editionId))[kind]
        .map((row) => {
          const fields: Readonly<Record<string, unknown>> = row.fields;
          return {
            id: row.id,
            label: labelOf(kind, fields),
            retired: fields['retired'] === true,
            recordVersion: row.recordVersion,
          };
        })
        .filter((row) => retired || !row.retired)
        .filter((row) => needle === '' || row.label.toLocaleLowerCase().includes(needle))
        .sort((a, b) => a.label.localeCompare(b.label));
      return { ok: true, records } as const;
    });
  }

  return { openBatch, write, flag, report, record, list };
}

export type ContentWrites = ReturnType<typeof createContentWrites>;
