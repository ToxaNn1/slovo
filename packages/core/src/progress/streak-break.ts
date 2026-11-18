import { createInTurn } from '../in-turn';
import { dateKeyOf, dayNumber, localDateAfter, parseLocalDate, todayKey } from '../local-date';
import type { Analytics } from '../analytics/analytics';
import type { Clock } from '../ports';
import type { Edition } from '../edition/edition';
import type { UserState } from '../user-state/user-state';
import { breakStrip, type CalendarDay } from './calendar';
import { BREAK_DAYS_AT_MOST, BREAK_INTERVAL_DAYS } from './streak';
import type { XpLog } from './xp-log';

/** Whether the reader can start a Break today, derived from the XP log and never stored. */
export type BreakState =
  /** The XP log or the `streakBreak` Feature Switch is off: no Break starts. */
  | { readonly kind: 'off' }
  /** A Break of 1 to `longest` days, the Break days left in the 30 days, can start today. */
  | { readonly kind: 'available'; readonly longest: number }
  /**
   * A Break runs from `firstDay` up to and with `lastDay`, and the 30 days
   * of its allowance end before `nextStart`, all `YYYY-MM-DD`; `daysLeft`
   * counts its days from today to `lastDay`, both included; `strip` holds
   * the 14 days ending the day after it (board 10, p1).
   */
  | {
      readonly kind: 'running';
      readonly firstDay: string;
      readonly lastDay: string;
      readonly nextStart: string;
      readonly daysLeft: number;
      readonly strip: readonly CalendarDay[];
    }
  /** The Break days of the 30 days are spent; the next Break can start on `nextStart`, `YYYY-MM-DD`. */
  | { readonly kind: 'waiting'; readonly nextStart: string };

/**
 * The Break (ADR 0066, 0180): the reader pauses the Streak from today, free,
 * for up to 7 Break days in the 30 days from the first Break of them, and may
 * end it early. Starting one appends a Break-started record to the XP log;
 * its days keep the Streak and add nothing to it. Ending one appends a
 * Break-ended record: today and the days after it count again, and the days
 * not used come back for a later Break in the same 30 days.
 */
export interface StreakBreak {
  /** Whether a Break can start today, on today's local date. */
  readonly state: BreakState;
  /**
   * Starts a Break of `days` from today and keeps its record. Refused, with
   * nothing written, unless the state is `available` and `days` is a whole
   * number from 1 to the longest.
   */
  start(days: number): Promise<'started' | 'refused'>;
  /**
   * Ends the running Break today and keeps its record. Refused, with nothing
   * written, unless the state is `running`.
   */
  end(): Promise<'ended' | 'refused'>;
  /** Calls `listener` after each change of the XP log the state is derived from. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** Opens the Break over the XP log, for the Core composition. */
export function openStreakBreak({
  edition,
  userState,
  clock,
  xpLog,
  analytics,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: Pick<UserState, 'write'>;
  clock: Clock;
  xpLog: Pick<XpLog, 'days' | 'startBreak' | 'endBreak' | 'subscribe'>;
  analytics: Pick<Analytics, 'track'>;
}): StreakBreak {
  const inTurn = createInTurn();
  const on = () => edition.isFeatureEnabled('streakBreak');

  function state(): BreakState {
    if (!on()) return { kind: 'off' };
    const today = parseLocalDate(todayKey(clock));
    const todayNumber = dayNumber(today);
    const after = (days: number) => dateKeyOf(localDateAfter(today, days));
    // The Breaks in order, each 30 days of allowance opened by the first Break after the last ones.
    const ordered = [...xpLog.days.breaks]
      .map(([start, days]) => ({ start: dayNumber(parseLocalDate(start)), days }))
      .filter(({ start }) => Number.isFinite(start))
      .sort((one, other) => one.start - other.start);
    let window: { start: number; used: number } | undefined;
    /** The first day of the 30 days each Break counts in, in the order of `ordered`. */
    const windowStarts: number[] = [];
    for (const { start, days } of ordered) {
      if (window === undefined || start >= window.start + BREAK_INTERVAL_DAYS) {
        window = { start, used: 0 };
      }
      window.used += days;
      windowStarts.push(window.start);
    }
    if (window === undefined) return { kind: 'available', longest: BREAK_DAYS_AT_MOST };
    const nextStartOf = (windowStart: number) =>
      after(windowStart + BREAK_INTERVAL_DAYS - todayNumber);
    const covering = ordered.findIndex(
      ({ start, days }) => todayNumber >= start && todayNumber < start + days,
    );
    const running = ordered[covering];
    const runningWindow = windowStarts[covering];
    if (running !== undefined && runningWindow !== undefined) {
      const { active, frozen, breaks } = xpLog.days;
      const last = after(running.start + running.days - 1 - todayNumber);
      return {
        kind: 'running',
        firstDay: after(running.start - todayNumber),
        lastDay: last,
        nextStart: nextStartOf(runningWindow),
        daysLeft: running.start + running.days - todayNumber,
        strip: breakStrip({
          activeDays: active,
          frozen,
          breaks,
          today: todayKey(clock),
          lastDay: last,
        }),
      };
    }
    const nextStart = nextStartOf(window.start);
    // A Break that starts after today, from a clock that moved back, waits like a spent allowance.
    if (ordered.some(({ start }) => start > todayNumber)) return { kind: 'waiting', nextStart };
    if (todayNumber >= window.start + BREAK_INTERVAL_DAYS) {
      return { kind: 'available', longest: BREAK_DAYS_AT_MOST };
    }
    const left = BREAK_DAYS_AT_MOST - window.used;
    return left > 0 ? { kind: 'available', longest: left } : { kind: 'waiting', nextStart };
  }

  async function start(days: number): Promise<'started' | 'refused'> {
    const current = state();
    if (current.kind !== 'available' || !Number.isInteger(days) || days < 1) return 'refused';
    if (days > current.longest) return 'refused';
    const append = xpLog.startBreak(days);
    await userState.write(append.changes);
    append.commit();
    void analytics.track('breakStarted', { days }).catch(() => undefined);
    return 'started';
  }

  async function end(): Promise<'ended' | 'refused'> {
    const current = state();
    if (current.kind !== 'running') return 'refused';
    const append = xpLog.endBreak(current.firstDay);
    await userState.write(append.changes);
    append.commit();
    return 'ended';
  }

  /** The last state handed over, kept while it stays the same so a reader of it sees no change. */
  let last: BreakState = { kind: 'off' };
  const sameAs = (next: BreakState) => JSON.stringify(next) === JSON.stringify(last);

  return {
    get state() {
      const next = state();
      if (!sameAs(next)) last = next;
      return last;
    },
    start: (days) => inTurn(() => start(days)),
    end: () => inTurn(end),
    subscribe: xpLog.subscribe,
  };
}
