import type { XpTable } from '@slovo/contracts';

import { createSubscribers } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock, Random, UserStateChanges } from '../ports';
import type { Edition } from '../edition/edition';
import type { XpAction, XpAward } from '../game/game-xp';
import type { LocalDate } from '../local-date';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords, type XpRecord } from '../user-state/user-state-schema';

const { xpLog: xpRecords } = userStateRecords;

/** What the XP log hands over: the XP derived from its records, never stored. */
export interface XpLogState {
  /** All XP ever earned in this Edition. */
  readonly total: number;
  /** The XP earned today, in the clock's time zone. */
  readonly today: number;
}

/** What the XP log holds by local date `YYYY-MM-DD`, for the Active Days and the Streak. */
export interface XpLogDays {
  /** The XP earned on each local date that has any. */
  readonly byDate: ReadonlyMap<string, number>;
  /** The missed local dates a consumed Streak freeze covers. */
  readonly frozen: ReadonlySet<string>;
  /** The Breaks started: the length in days by the local date each starts on. */
  readonly breaks: ReadonlyMap<string, number>;
}

/** Records to append for another write, and the step that makes them in memory once written. */
export interface XpLogAppend {
  readonly changes: UserStateChanges;
  /** Makes the change in memory. Call it once the changes are written. */
  commit(): void;
}

/**
 * The XP log (ADR 0066): an append-only log of the XP each learning action
 * earned, kept per Edition, which the total and today's XP are derived from.
 * The amounts and the Review cap come from the Edition's XP table; the log
 * syncs as a union by record id, so two devices agree and no record doubles.
 * The Daily Crossword of a date earns once, and Review answers count up to
 * the cap a day, however many devices' records merge.
 */
export interface XpLog {
  /** The XP as it stands, in memory for the session. */
  readonly state: XpLogState;
  /** The XP and the freezes by local date, in memory for the session. */
  readonly days: XpLogDays;
  /** The record the action appends, for another write; empty when it earns nothing. */
  award(action: XpAction): XpAward;
  /**
   * The freeze-consumed records that cover the missed local dates, for another
   * write. A date has one such record by its id, so two devices that cover the
   * same day merge into one.
   */
  freeze(dates: readonly string[]): XpLogAppend;
  /**
   * The Break-started record of a Break of `days` from today, for another
   * write. A date has one such record by its id, so two devices that start a
   * Break on the same day merge into one.
   */
  startBreak(days: number): XpLogAppend;
  /** Calls `listener` after each change of the XP. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** The award of an action that earns nothing: no change to write, nothing to make in memory. */
const NOTHING_EARNED: XpAward = {
  changes: new Map(),
  amount: 0,
  commit: () => undefined,
};

/**
 * The XP an action earns by the Edition's XP table, with the Review XP
 * already earned today, which the table's daily cap bounds.
 */
function amountOf(table: XpTable, action: XpAction, reviewToday: number): number {
  switch (action.source) {
    case 'game-round':
      return table.round;
    case 'game-finished':
      return action.played > 0 && action.right / action.played >= table.finishedGameShare
        ? table.finishedGame
        : 0;
    case 'game-best':
      return table.bestResult;
    case 'daily-crossword':
      return table.dailyCrossword;
    case 'review-answer':
      return Math.max(0, Math.min(table.reviewAnswer, table.reviewDailyCap - reviewToday));
  }
}

/**
 * The id of the action's record. The Daily Crossword of a date has one, so
 * two devices that solve it merge into one record; any other action's id is
 * new, made by `newId`.
 */
const fixedIdOf = (action: XpAction): string | undefined =>
  action.source === 'daily-crossword' ? `daily-crossword-${action.date}` : undefined;

/** Opens the XP log over the user state, for the Core composition. */
export async function openXpLog({
  edition,
  userState,
  clock,
  random,
  dayTurned,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'xp'>;
  userState: Pick<UserState, 'list'>;
  clock: Clock;
  random: Random;
  dayTurned: Pick<Subject<LocalDate>, 'subscribe'>;
}): Promise<XpLog> {
  const on = edition.isFeatureEnabled('xpLog');
  const records = new Map<string, XpRecord>(on ? await userState.list(xpRecords) : []);
  const subscribers = createSubscribers();
  /** Tells the records of one session apart when the clock and the random source stand still. */
  let sequence = 0;

  function derive(): XpLogState & XpLogDays & { reviewToday: number } {
    const today = todayKey(clock);
    let total = 0;
    const byDate = new Map<string, number>();
    const frozen = new Set<string>();
    const breaks = new Map<string, number>();
    /** The Review XP of each date, which counts up to the daily cap even as two devices' logs merge. */
    const review = new Map<string, number>();
    for (const record of records.values()) {
      switch (record.kind) {
        case 'freeze':
          frozen.add(record.date);
          break;
        case 'break':
          breaks.set(record.date, Math.max(breaks.get(record.date) ?? 0, record.days));
          break;
        case 'xp': {
          let amount = record.amount;
          if (record.source === 'review-answer') {
            const before = review.get(record.date) ?? 0;
            amount = Math.max(0, Math.min(amount, edition.xp.reviewDailyCap - before));
            review.set(record.date, before + amount);
          }
          total += amount;
          byDate.set(record.date, (byDate.get(record.date) ?? 0) + amount);
        }
      }
    }
    return {
      total,
      today: byDate.get(today) ?? 0,
      reviewToday: review.get(today) ?? 0,
      byDate,
      frozen,
      breaks,
    };
  }
  let derived = derive();
  let state: XpLogState = { total: derived.total, today: derived.today };

  function change(): void {
    derived = derive();
    state = { total: derived.total, today: derived.today };
    subscribers.tell();
  }

  /** An id no other device makes: the instant, a random part and this session's count. */
  function newId(at: Date): string {
    const randomPart = Math.floor(random.next() * 36 ** 8)
      .toString(36)
      .padStart(8, '0');
    sequence += 1;
    return `${at.getTime().toString(36)}-${randomPart}-${sequence.toString(36)}`;
  }

  function award(action: XpAction): XpAward {
    const fixedId = fixedIdOf(action);
    if (!on || (fixedId !== undefined && records.has(fixedId))) return NOTHING_EARNED;
    const amount = amountOf(edition.xp, action, derived.reviewToday);
    if (amount === 0) return NOTHING_EARNED;
    const at = clock.now();
    const id = fixedId ?? newId(at);
    const record: XpRecord = {
      kind: 'xp',
      date: todayKey(clock),
      at: at.toISOString(),
      source: action.source,
      amount,
    };
    return {
      changes: xpRecords.record(id).change(record),
      amount,
      commit() {
        records.set(id, record);
        change();
      },
    };
  }

  function freeze(dates: readonly string[]): XpLogAppend {
    const at = clock.now().toISOString();
    const added = new Map<string, XpRecord>(
      dates.map((date) => [`freeze-${date}`, { kind: 'freeze', date, at }]),
    );
    return {
      changes: new Map(
        [...added].flatMap(([id, record]) => [...xpRecords.record(id).change(record)]),
      ),
      commit() {
        if (added.size === 0) return;
        for (const [id, record] of added) records.set(id, record);
        change();
      },
    };
  }

  function startBreak(days: number): XpLogAppend {
    const date = todayKey(clock);
    const id = `break-${date}`;
    const record: XpRecord = { kind: 'break', date, at: clock.now().toISOString(), days };
    return {
      changes: xpRecords.record(id).change(record),
      commit() {
        records.set(id, record);
        change();
      },
    };
  }

  dayTurned.subscribe(change);

  return {
    get state() {
      return state;
    },
    get days() {
      return derived;
    },
    award,
    freeze,
    startBreak,
    subscribe: subscribers.subscribe,
  };
}
