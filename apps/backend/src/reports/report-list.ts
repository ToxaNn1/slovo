import { and, desc, eq, gte, type SQL } from 'drizzle-orm';

import type { Database } from '../database/database';
import { mistakeReports } from '../database/schema';

/** Which kept reports `reports list` prints; none of the two keeps them all. */
export interface ReportFilter {
  /** Keeps the reports of this Edition alone. */
  readonly editionId?: string | undefined;
  /** Keeps the reports received at this time or later. */
  readonly since?: Date | undefined;
}

/**
 * The lines `reports list` prints of the Mistake Reports still to check
 * (ADR 0056), newest first: one with the time, Edition, Entry id, type and
 * comment, then one with the id `reports resolve` takes and the versions the
 * report came from.
 */
export async function listReports({ db }: Database, filter: ReportFilter = {}): Promise<string[]> {
  const conditions: SQL[] = [];
  if (filter.editionId !== undefined) {
    conditions.push(eq(mistakeReports.editionId, filter.editionId));
  }
  if (filter.since !== undefined) conditions.push(gte(mistakeReports.receivedAt, filter.since));
  const kept = await db
    .select()
    .from(mistakeReports)
    .where(and(...conditions))
    .orderBy(desc(mistakeReports.receivedAt), desc(mistakeReports.id));
  if (kept.length === 0) return ['No Mistake Reports to check.'];
  return kept.flatMap((report) => [
    [
      readableTime(report.receivedAt),
      report.editionId,
      report.entryId,
      report.type,
      // Quoted, so a comment of several lines stays on one line.
      report.comment === '' ? '(no comment)' : JSON.stringify(report.comment),
    ].join('  '),
    `  id ${report.id}, app ${report.appVersion}, content ${String(report.contentVersion)}`,
  ]);
}

/** The time to the second, in UTC, as `2026-10-28 14:05:07 UTC`. */
const readableTime = (time: Date) => `${time.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
