import { z } from 'zod';

import { dayNumber, parseLocalDate } from '../local-date';
import type { UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { progressRecords, XpRecordSchema, type XpDay, type XpRecord } from './records';

const { xpLog, xpDays } = progressRecords;

/** A record of the XP log is folded once its local date is more than this many days before today (ADR 0205). */
const FOLD_AFTER_DAYS = 30;

/**
 * The most bytes of an XP day as the JSON it is kept as, in UTF-8: under the
 * 8 KB a record of Sync may take, with room for the day's own fields.
 */
const XP_DAY_BYTES = 7 * 1024;

/** The most records one launch folds, whole days at a time, so the first fold of a long log is no single huge write. */
const FOLDED_AT_MOST = 2000;

/** How many bytes the text takes in UTF-8. */
function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** The FNV-1a hash of the text, 32 bits in base 36: the same ids give the same hash on every device. */
function hashOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** The first instant of the local date read as UTC, which a row's `t` counts from. */
const baseOf = (date: string) => Date.parse(`${date}T00:00:00.000Z`);

type Row = XpDay['rows'][string];

const RowSchema = z.record(z.string(), z.json());

/**
 * A record as an XP day keeps it: without its date, which is the day's,
 * without the kind of an XP entry, and with its instant as `t`, the
 * milliseconds from the day's base, unless the instant was written another
 * way than the clock writes it, which stays as `at`.
 */
function rowOf(record: XpRecord): Row {
  const { date, kind, at, ...rest } = record;
  const t = Date.parse(at) - baseOf(date);
  // Through JSON, as the record is kept: a field left out stays out.
  return RowSchema.parse(
    JSON.parse(
      JSON.stringify({
        ...(kind === 'xp' ? {} : { kind }),
        ...(new Date(baseOf(date) + t).toISOString() === at ? { t } : { at }),
        ...rest,
      }),
    ),
  );
}

/** The record a row of an XP day of the date reads as; nothing for a row that is no record of the log. */
function recordOf(date: string, { t, ...row }: Row): XpRecord | undefined {
  const at = typeof t === 'number' ? { at: new Date(baseOf(date) + t).toISOString() } : {};
  const parsed = XpRecordSchema.safeParse({ kind: 'xp', ...row, ...at, date });
  return parsed.success ? parsed.data : undefined;
}

const byInstant = ([oneId, one]: [string, XpRecord], [otherId, other]: [string, XpRecord]) =>
  one.at === other.at ? (oneId < otherId ? -1 : 1) : one.at < other.at ? -1 : 1;

/** The XP log as the user state keeps it (ADR 0205). */
interface KeptXpLog {
  /**
   * Every record of the log, by id: those folded into XP days first, by day
   * and instant, then those kept as records. A record under one id in several
   * places counts once: the one with the latest instant, the record kept as
   * one on a tie.
   */
  readonly records: ReadonlyMap<string, XpRecord>;
  /** The changes that fold the log as of `today`; none when nothing is left to fold. */
  foldChanges(today: string): UserStateChanges;
}

/** Reads the XP log, the records and the XP days, from the user state. */
export async function readXpLog(userState: Pick<UserState, 'list'>): Promise<KeptXpLog> {
  const [live, days] = await Promise.all([userState.list(xpLog), userState.list(xpDays)]);
  const folded = new Map<string, XpRecord>();
  for (const [, { date, rows }] of [...days].sort(([one], [other]) => (one < other ? -1 : 1))) {
    const ofDay = Object.entries(rows).flatMap(([id, row]): [string, XpRecord][] => {
      const record = recordOf(date, row);
      return record === undefined ? [] : [[id, record]];
    });
    for (const [id, record] of ofDay.sort(byInstant)) {
      const before = folded.get(id);
      if (before === undefined || record.at > before.at) folded.set(id, record);
    }
  }
  const records = new Map(folded);
  for (const [id, record] of live) {
    const before = folded.get(id);
    if (before === undefined || record.at >= before.at) records.set(id, record);
  }

  function foldChanges(today: string): UserStateChanges {
    const changes = new Map<string, string | undefined>();
    const forget = (id: string) => {
      for (const change of xpLog.record(id).change(undefined)) changes.set(...change);
    };
    const old = new Map<string, [string, XpRecord][]>();
    const todayNumber = dayNumber(parseLocalDate(today));
    for (const [id, record] of live) {
      const before = folded.get(id);
      // An XP day holds the record already: the record kept beside it goes.
      if (before !== undefined && before.at >= record.at) forget(id);
      else if (todayNumber - dayNumber(parseLocalDate(record.date)) > FOLD_AFTER_DAYS) {
        old.set(record.date, [...(old.get(record.date) ?? []), [id, record]]);
      }
    }
    let foldedNow = 0;
    for (const [date, ofDay] of [...old].sort(([one], [other]) => (one < other ? -1 : 1))) {
      if (foldedNow >= FOLDED_AT_MOST) break;
      foldedNow += ofDay.length;
      let rows: Record<string, Row> = {};
      let bytes = 0;
      const keep = () => {
        const ids = Object.keys(rows);
        if (ids.length === 0) return;
        const id = `${date}-${String(ids.length)}-${hashOf(ids.join('\n'))}`;
        for (const change of xpDays.record(id).change({ date, rows })) changes.set(...change);
        rows = {};
        bytes = 0;
      };
      for (const [id, record] of ofDay.sort(byInstant)) {
        const row = rowOf(record);
        // The row's id and value as JSON, the colon between and the comma after.
        const size = utf8Bytes(JSON.stringify(id)) + utf8Bytes(JSON.stringify(row)) + 2;
        if (bytes + size > XP_DAY_BYTES) keep();
        rows[id] = row;
        bytes += size;
        forget(id);
      }
      keep();
    }
    return changes;
  }

  return { records, foldChanges };
}
