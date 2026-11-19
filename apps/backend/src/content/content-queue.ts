import { ID_PREFIX } from '@slovo/contracts';
import { parseRecord, recordFileOf } from '@slovo/content-rules';
import type { Actor, Clock } from '@slovo/server-core';
import { and, asc, eq, getTableColumns, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../database/database';
import { accounts, actionLog, contentBatches, mistakeReports } from '../database/schema';
import {
  ENTRY_KINDS,
  holdContentVersion,
  logged,
  loggedWrite,
  publishContentVersion,
  RecordKindSchema,
  saveRecord,
  TABLES,
  type EntryKind,
} from './content-records';

// A Crossword day takes no flag.
const FlagKindSchema = RecordKindSchema.exclude(['crosswordDay']);
const FlagWhatSchema = z.templateLiteral(['content.', FlagKindSchema, '.flag']);
const FlagAfterSchema = z.object({ id: z.string() });
const ResolvedSchema = z.object({ flagId: z.number().int() });

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

  /**
   * Each record the batch wrote, by kind and id, with the batch's first write
   * of it and the record as it was before that write.
   */
  async function writesOf(tx: Tx, batchId: string) {
    const rows = await tx
      .select({ what: actionLog.what, before: actionLog.before, after: actionLog.after })
      .from(actionLog)
      .where(and(eq(actionLog.batchId, batchId), logged.isWrite))
      .orderBy(asc(actionLog.id));
    const first = new Map<string, NonNullable<ReturnType<typeof loggedWrite>>>();
    for (const row of rows) {
      const write = loggedWrite(row);
      if (write === undefined) continue;
      const key = `${write.kind} ${write.id}`;
      if (!first.has(key)) first.set(key, write);
    }
    return [...first.values()];
  }

  /**
   * By batch, the records each wrote and those of them its first write of
   * created, counted in the database: the list of batches and the alert read
   * two numbers a batch, not the fields its writes logged.
   */
  async function countsOf(batchIds: readonly string[]) {
    if (batchIds.length === 0) return new Map<string, { records: number; added: number }>();
    const { kind, id } = logged;
    const firsts = db
      .selectDistinctOn([actionLog.batchId, kind, id], {
        batchId: actionLog.batchId,
        op: logged.op.as('op'),
      })
      .from(actionLog)
      .where(and(inArray(actionLog.batchId, [...batchIds]), logged.isWrite))
      .orderBy(actionLog.batchId, kind, id, asc(actionLog.id))
      .as('firsts');
    const rows = await db
      .select({
        batchId: firsts.batchId,
        records: sql<number>`count(*)::int`,
        added: sql<number>`(count(*) filter (where ${firsts.op} = 'create'))::int`,
      })
      .from(firsts)
      .groupBy(firsts.batchId);
    return new Map(
      rows.flatMap(({ batchId, records, added }) =>
        batchId === null ? [] : [[batchId, { records, added }] as const],
      ),
    );
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
    const counts = await countsOf(open.map(({ id }) => id));
    return open.map((batch) => {
      const { records, added } = counts.get(batch.id) ?? { records: 0, added: 0 };
      return {
        id: batch.id,
        editionId: batch.editionId,
        author: batch.changedBy.replace(/^agent:/, ''),
        createdAt: batch.createdAt.toISOString(),
        added,
        changed: records - added,
      };
    });
  }

  /** The open batch by id, locked, with its Edition's writes held. */
  async function heldBatch(tx: Tx, batchId: string) {
    const [found] = await tx
      .select({ editionId: contentBatches.editionId })
      .from(contentBatches)
      .where(eq(contentBatches.id, batchId));
    if (found === undefined) return undefined;
    // An Edition's writes run one at a time until the commit, as content-writes
    // holds them: the Edition lock first, then the row, in a write's order.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${found.editionId}))`);
    const [batch] = await tx
      .select()
      .from(contentBatches)
      .where(and(openBatch, eq(contentBatches.id, batchId)))
      .for('update');
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
      const contentVersion = await holdContentVersion(tx, editionId);
      if (contentVersion === undefined) return { ok: false } as const;
      const now = clock.now();
      const changedBy = `admin:${email}` as const;
      const [own] = await tx
        .insert(contentBatches)
        .values({ editionId, changedBy, createdAt: now, reviewedAt: now })
        .returning({ id: contentBatches.id });
      if (own === undefined) throw new Error('the batch was not written');
      const published = contentVersion + 1;
      const retired: string[] = [];
      const restored: string[] = [];
      const skipped: string[] = [];
      for (const write of await writesOf(tx, batchId)) {
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
          write.op === 'create' ? { ...current.fields, retired: true } : write.fieldsBefore,
        );
        if (!parsed.ok) throw new Error(`the record ${write.id} before the batch does not parse`);
        await saveRecord(
          tx,
          parsed.record,
          {
            editionId,
            recordVersion: current.recordVersion + 1,
            contentVersion: published,
            changedBy,
            changedAt: now,
            batchId: own.id,
          },
          'restored',
        );
        (write.op === 'create' ? retired : restored).push(write.id);
      }
      const changed = retired.length + restored.length > 0;
      if (changed) {
        await publishContentVersion(tx, editionId, published, now);
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
        contentVersion: changed ? published : contentVersion,
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
    return db.transaction(async (tx) => {
      const [flag] = await tx
        .select({ what: actionLog.what, after: actionLog.after, editionId: actionLog.editionId })
        .from(actionLog)
        .where(and(eq(actionLog.id, flagId), like(actionLog.what, 'content.%.flag')));
      if (
        flag === undefined ||
        flag.editionId === null ||
        !FlagWhatSchema.safeParse(flag.what).success ||
        !FlagAfterSchema.safeParse(flag.after).success
      ) {
        return { ok: false } as const;
      }
      // One decision per flag: decisions on the Edition's flags run one at a time.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${flag.editionId}))`);
      const [resolved] = await tx
        .select({ id: actionLog.id })
        .from(actionLog)
        .where(
          and(
            like(actionLog.what, 'content.flag.%'),
            sql`${actionLog.before}->>'flagId' = ${String(flagId)}`,
          ),
        );
      if (resolved !== undefined) return { ok: false } as const;
      await tx.insert(actionLog).values({
        who: adminActor(email),
        at: clock.now(),
        what: `content.flag.${decision}`,
        before: { flagId },
        after: null,
        reason,
        editionId: flag.editionId,
        batchId: null,
      });
      return { ok: true } as const;
    });
  }

  /**
   * The Mistake Reports still to check, oldest first, each with the Entry it
   * names as the content database keeps it now and the email of a signed-in
   * reader's Account (ADR 0159).
   */
  async function reports(editionId?: string) {
    const { accountId: _accountId, ...columns } = getTableColumns(mistakeReports);
    const rows = await db
      .select({ ...columns, accountEmail: accounts.email })
      .from(mistakeReports)
      .leftJoin(accounts, eq(accounts.id, mistakeReports.accountId))
      .where(editionId === undefined ? undefined : eq(mistakeReports.editionId, editionId))
      .orderBy(asc(mistakeReports.receivedAt));
    const entries = await entriesOf(rows);
    return rows.map((row) => ({
      ...row,
      receivedAt: row.receivedAt.toISOString(),
      entry: entries.get(`${row.editionId} ${row.entryId}`) ?? null,
    }));
  }

  /**
   * The Entries the rows name, as the content database keeps them now, by
   * `<Edition> <Entry id>`: one read per kind of Entry named. An id the
   * Edition has no record of is left out.
   */
  async function entriesOf(rows: readonly { editionId: string; entryId: string }[]) {
    const found = new Map<
      string,
      { kind: EntryKind; fields: Readonly<Record<string, unknown>>; retired: boolean }
    >();
    for (const kind of ENTRY_KINDS) {
      const named = new Map<string, string[]>();
      for (const { editionId, entryId } of rows) {
        if (!entryId.startsWith(ID_PREFIX[kind])) continue;
        named.set(editionId, [...(named.get(editionId) ?? []), entryId]);
      }
      if (named.size === 0) continue;
      const table = TABLES[kind];
      const kept = await db
        .select({
          editionId: table.editionId,
          id: table.id,
          fields: table.fields,
          retired: table.retired,
        })
        .from(table)
        .where(
          or(
            ...[...named].map(([editionId, ids]) =>
              and(eq(table.editionId, editionId), inArray(table.id, ids)),
            ),
          ),
        );
      for (const record of kept) {
        found.set(`${record.editionId} ${record.id}`, {
          kind,
          fields: record.fields,
          retired: record.retired,
        });
      }
    }
    return found;
  }

  /** «Вирішено»: deletes the Mistake Report (ADR 0056), keeping it in the Action log row. */
  async function resolveReport(email: string, id: string, reason: string) {
    return db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(mistakeReports)
        .where(eq(mistakeReports.id, id))
        .returning();
      if (deleted === undefined) return { ok: false } as const;
      // The Action log keeps what the report said, not who sent it (ADR 0159).
      const { accountId: _accountId, ...report } = deleted;
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

  return { batches, review, rollback, flags, resolveFlag, reports, resolveReport, entriesOf };
}

/** The name an Action log row's author is shown by. */
function authorName(who: Actor) {
  return who.kind === 'agent' ? who.name : who.kind === 'admin-user' ? who.email : who.command;
}

export type ContentQueue = ReturnType<typeof createContentQueue>;
