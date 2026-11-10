import { parseRecord, recordFileOf, type RecordKind } from '@slovo/content-rules';
import type { Actor, Clock, Json } from '@slovo/server-core';
import { and, asc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../database/database';
import {
  actionLog,
  contentBatches,
  contentCorrections,
  contentCrosswordDays,
  contentCuratedCollections,
  contentIdioms,
  contentSynonymRows,
  contentTips,
  contentVersions,
  contentWords,
  mistakeReports,
} from '../database/schema';
import { retireRecordings } from './media-rows';

/** The table of each kind of record. */
const TABLES = {
  word: contentWords,
  correction: contentCorrections,
  idiom: contentIdioms,
  synonymRow: contentSynonymRows,
  tip: contentTips,
  curatedCollection: contentCuratedCollections,
  crosswordDay: contentCrosswordDays,
} as const satisfies Record<RecordKind, unknown>;

const RecordKindSchema = z.enum([
  'word',
  'correction',
  'idiom',
  'synonymRow',
  'tip',
  'curatedCollection',
  'crosswordDay',
]);

/** A content write's Action log row, as `content-writes` keeps it. */
const WriteWhatSchema = z.templateLiteral([
  'content.',
  RecordKindSchema,
  '.',
  z.enum(['create', 'edit', 'retire']),
]);
// A Crossword day takes no flag.
const FlagKindSchema = RecordKindSchema.exclude(['crosswordDay']);
const FlagWhatSchema = z.templateLiteral(['content.', FlagKindSchema, '.flag']);
const StoredSchema = z.object({
  recordVersion: z.number().int(),
  // A Crossword day's id is its date.
  fields: z.looseObject({ id: z.string().optional(), date: z.string().optional() }),
});
const FlagAfterSchema = z.object({ id: z.string() });
const ResolvedSchema = z.object({ flagId: z.number().int() });

const kindOf = (what: string): RecordKind => RecordKindSchema.parse(what.split('.')[1]);

/** The Агент batches «не перевірено»: an Агент's, not reviewed yet. */
const openBatch = and(like(contentBatches.changedBy, 'agent:%'), isNull(contentBatches.reviewedAt));

/** Who the Action log names for an Admin user of the Content queue. */
const adminActor = (email: string): Actor => ({ kind: 'admin-user', email });

/**
 * The Content queue (ADR 0090): the Агент batches to review after the fact,
 * their rollback as one publish, the open flags and the Mistake Reports
 * (ADR 0056). Every write is one transaction with its Action log row.
 */
export function createContentQueue({ database, clock }: { database: Database; clock: Clock }) {
  const { db } = database;
  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  /** Each record a batch wrote, by kind and id, with the batch's first write of it. */
  async function writesOf(tx: Tx | typeof db, batchIds: readonly string[]) {
    if (batchIds.length === 0) return [];
    const rows = await tx
      .select({
        batchId: actionLog.batchId,
        what: actionLog.what,
        before: actionLog.before,
        after: actionLog.after,
      })
      .from(actionLog)
      .where(and(inArray(actionLog.batchId, [...batchIds]), like(actionLog.what, 'content.%')))
      .orderBy(asc(actionLog.id));
    const first = new Map<
      string,
      {
        batchId: string;
        kind: RecordKind;
        id: string;
        op: 'create' | 'edit' | 'retire';
        before: Json;
      }
    >();
    for (const row of rows) {
      const what = WriteWhatSchema.safeParse(row.what);
      if (!what.success || row.batchId === null) continue;
      const kind = kindOf(what.data);
      const { fields } = StoredSchema.parse(row.after);
      const id = fields.id ?? fields.date ?? '';
      const key = `${row.batchId} ${kind} ${id}`;
      if (first.has(key)) continue;
      const op = z.enum(['create', 'edit', 'retire']).parse(what.data.split('.')[2]);
      first.set(key, { batchId: row.batchId, kind, id, op, before: row.before });
    }
    return [...first.values()];
  }

  /** The open batches, oldest first, with the records each added and changed. */
  async function batches(editionId?: string) {
    const open = await db
      .select()
      .from(contentBatches)
      .where(
        editionId === undefined
          ? openBatch
          : and(openBatch, eq(contentBatches.editionId, editionId)),
      )
      .orderBy(asc(contentBatches.createdAt));
    const writes = await writesOf(
      db,
      open.map(({ id }) => id),
    );
    return open.map((batch) => {
      const own = writes.filter((write) => write.batchId === batch.id);
      const added = own.filter((write) => write.op === 'create').length;
      return {
        id: batch.id,
        editionId: batch.editionId,
        author: batch.changedBy.replace(/^agent:/, ''),
        createdAt: batch.createdAt.toISOString(),
        added,
        changed: own.length - added,
      };
    });
  }

  /** The open batch by id, locked, with its Edition's writes held. */
  async function heldBatch(tx: Tx, batchId: string) {
    const [batch] = await tx
      .select()
      .from(contentBatches)
      .where(and(openBatch, eq(contentBatches.id, batchId)))
      .for('update');
    if (batch === undefined) return undefined;
    // An Edition's writes run one at a time until the commit, as content-writes holds them.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${batch.editionId}))`);
    return batch;
  }

  /** Marks an open batch reviewed: it leaves the queue. */
  async function review(email: string, batchId: string, reason: string) {
    return db.transaction(async (tx) => {
      const batch = await heldBatch(tx, batchId);
      if (batch === undefined) return { ok: false } as const;
      const now = clock.now();
      await tx
        .update(contentBatches)
        .set({ reviewedAt: now })
        .where(eq(contentBatches.id, batchId));
      await tx.insert(actionLog).values({
        who: adminActor(email),
        at: now,
        what: 'content.batch.review',
        before: null,
        after: null,
        reason,
        editionId: batch.editionId,
        batchId,
      });
      return { ok: true } as const;
    });
  }

  /**
   * Rolls an open batch back as one publish of its own batch, reviewed at once:
   * a record it created is retired, one it changed gets its fields from before
   * the batch, and one changed after it is skipped.
   */
  async function rollback(email: string, batchId: string, reason: string) {
    return db.transaction(async (tx) => {
      const batch = await heldBatch(tx, batchId);
      if (batch === undefined) return { ok: false } as const;
      const { editionId } = batch;
      const [held] = await tx
        .select({ contentVersion: contentVersions.contentVersion })
        .from(contentVersions)
        .where(eq(contentVersions.editionId, editionId))
        .for('update');
      if (held === undefined) return { ok: false } as const;
      const now = clock.now();
      const changedBy = `admin:${email}` as const;
      const [own] = await tx
        .insert(contentBatches)
        .values({ editionId, changedBy, createdAt: now, reviewedAt: now })
        .returning({ id: contentBatches.id });
      if (own === undefined) throw new Error('the batch was not written');
      const published = held.contentVersion + 1;
      const retired: string[] = [];
      const restored: string[] = [];
      const skipped: string[] = [];
      for (const write of await writesOf(tx, [batchId])) {
        const table = TABLES[write.kind];
        const [current] = await tx
          .select({
            fields: table.fields,
            recordVersion: table.recordVersion,
            batchId: table.batchId,
          })
          .from(table)
          .where(and(eq(table.editionId, editionId), eq(table.id, write.id)));
        if (current === undefined) throw new Error(`no record ${write.id} of the batch`);
        if (current.batchId !== batchId) {
          skipped.push(write.id);
          continue;
        }
        const parsed = parseRecord(
          write.kind,
          recordFileOf(write.kind, write.id),
          write.op === 'create'
            ? { ...current.fields, retired: true }
            : StoredSchema.parse(write.before).fields,
        );
        if (!parsed.ok) throw new Error(`the record ${write.id} before the batch does not parse`);
        const { record } = parsed;
        const where = and(eq(table.editionId, editionId), eq(table.id, write.id));
        const set = {
          retired: 'retired' in record.entry && record.entry.retired === true,
          recordVersion: current.recordVersion + 1,
          contentVersion: published,
          changedBy,
          changedAt: now,
          batchId: own.id,
        };
        switch (record.kind) {
          case 'word': {
            const [word] = await tx
              .select({ fields: contentWords.fields, needs: contentWords.needsNewRecording })
              .from(contentWords)
              .where(where);
            // A Word's Recordings no longer read it once its Lemma or Stress changed (ADR 0083).
            const textChanged =
              word !== undefined &&
              (word.fields.lemma !== record.entry.lemma ||
                JSON.stringify(word.fields.stress) !== JSON.stringify(record.entry.stress));
            const needsNewRecording = word !== undefined && (word.needs || textChanged);
            if (textChanged)
              await retireRecordings(tx, { editionId, wordId: write.id, version: published, now });
            await tx
              .update(contentWords)
              .set({ ...set, fields: record.entry, needsNewRecording })
              .where(where);
            break;
          }
          case 'correction':
            await tx
              .update(contentCorrections)
              .set({ ...set, fields: record.entry })
              .where(where);
            break;
          case 'idiom':
            await tx
              .update(contentIdioms)
              .set({ ...set, fields: record.entry })
              .where(where);
            break;
          case 'synonymRow':
            await tx
              .update(contentSynonymRows)
              .set({ ...set, fields: record.entry })
              .where(where);
            break;
          case 'tip':
            await tx
              .update(contentTips)
              .set({ ...set, fields: record.entry })
              .where(where);
            break;
          case 'curatedCollection':
            await tx
              .update(contentCuratedCollections)
              .set({ ...set, fields: record.entry })
              .where(where);
            break;
          case 'crosswordDay':
            await tx
              .update(contentCrosswordDays)
              .set({ ...set, fields: record.entry })
              .where(where);
            break;
        }
        (write.op === 'create' ? retired : restored).push(write.id);
      }
      const changed = retired.length + restored.length > 0;
      if (changed) {
        await tx
          .update(contentVersions)
          .set({ contentVersion: published, updatedAt: now })
          .where(eq(contentVersions.editionId, editionId));
      }
      await tx
        .update(contentBatches)
        .set({ reviewedAt: now })
        .where(eq(contentBatches.id, batchId));
      await tx.insert(actionLog).values({
        who: adminActor(email),
        at: now,
        what: 'content.batch.rollback',
        before: { batchId },
        after: { retired, restored, skipped },
        reason,
        editionId,
        batchId: own.id,
      });
      return {
        ok: true,
        contentVersion: changed ? published : held.contentVersion,
        retired,
        restored,
        skipped,
      } as const;
    });
  }

  /** The flags not accepted or rejected yet, oldest first. */
  async function flags(editionId?: string) {
    const byEdition = editionId === undefined ? undefined : eq(actionLog.editionId, editionId);
    const rows = await db
      .select()
      .from(actionLog)
      .where(
        and(
          or(like(actionLog.what, 'content.%.flag'), like(actionLog.what, 'content.flag.%')),
          byEdition,
        ),
      )
      .orderBy(asc(actionLog.id));
    const resolved = new Set(
      rows.flatMap((row) => {
        const before = ResolvedSchema.safeParse(row.before);
        return row.what.startsWith('content.flag.') && before.success ? [before.data.flagId] : [];
      }),
    );
    return rows.flatMap((row) => {
      const what = FlagWhatSchema.safeParse(row.what);
      const after = FlagAfterSchema.safeParse(row.after);
      if (!what.success || !after.success || resolved.has(row.id) || row.editionId === null) {
        return [];
      }
      return [
        {
          id: row.id,
          editionId: row.editionId,
          kind: FlagKindSchema.parse(what.data.split('.')[1]),
          recordId: after.data.id,
          author: row.who.kind === 'command' ? row.who.command : authorName(row.who),
          explanation: row.reason ?? '',
          at: row.at.toISOString(),
        },
      ];
    });
  }

  /** Accepts or rejects an open flag; the content stays as it is. */
  async function resolveFlag(
    email: string,
    flagId: number,
    decision: 'accept' | 'reject',
    reason: string,
  ) {
    const open = (await flags()).find((flag) => flag.id === flagId);
    if (open === undefined) return { ok: false } as const;
    await db.insert(actionLog).values({
      who: adminActor(email),
      at: clock.now(),
      what: `content.flag.${decision}`,
      before: { flagId },
      after: null,
      reason,
      editionId: open.editionId,
      batchId: null,
    });
    return { ok: true } as const;
  }

  /** The Mistake Reports still to check, oldest first. */
  async function reports(editionId?: string) {
    const rows = await db
      .select()
      .from(mistakeReports)
      .where(editionId === undefined ? undefined : eq(mistakeReports.editionId, editionId))
      .orderBy(asc(mistakeReports.receivedAt));
    return rows.map((row) => ({ ...row, receivedAt: row.receivedAt.toISOString() }));
  }

  /** «Вирішено»: deletes the Mistake Report (ADR 0056), keeping it in the Action log row. */
  async function resolveReport(email: string, id: string, reason: string) {
    return db.transaction(async (tx) => {
      const [report] = await tx.delete(mistakeReports).where(eq(mistakeReports.id, id)).returning();
      if (report === undefined) return { ok: false } as const;
      await tx.insert(actionLog).values({
        who: adminActor(email),
        at: clock.now(),
        what: 'report.resolve',
        before: { ...report, receivedAt: report.receivedAt.toISOString() },
        after: null,
        reason,
        editionId: report.editionId,
        batchId: null,
      });
      return { ok: true } as const;
    });
  }

  return { batches, review, rollback, flags, resolveFlag, reports, resolveReport };
}

/** The name an Action log row's author is shown by. */
function authorName(who: Actor) {
  return who.kind === 'agent' ? who.name : who.kind === 'admin-user' ? who.email : who.command;
}

export type ContentQueue = ReturnType<typeof createContentQueue>;
