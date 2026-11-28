import { createInTurn } from '../in-turn';
import { dateKeyOf, dayNumber, localDateAfter, parseLocalDate, todayKey } from '../local-date';
import type { Analytics } from '../analytics/analytics';
import type { Clock } from '../ports';
import type { Edition } from '../edition/edition';
import { writeStaged } from '../user-state/staged-write';
import type { UserState } from '../user-state/user-state';
import { breakStrip, type CalendarDay } from './calendar';
import { BREAK_DAYS_AT_MOST, BREAK_INTERVAL_DAYS } from './streak';
import type { XpLog } from './xp-log';

/** Whether the reader can start a Break today, derived from the XP log and never stored. */
export type BreakState =
  /** The XP log or the `streakBreak` Feature Switch is off: no Break starts. */
  | { readonly kind: 'off' }
  /** A Break of 1 to `longest` days can start today: the most that keeps every 30 days in a row at 7 Break days. */
  | { readonly kind: 'available'; readonly longest: number }
  /**
   * A Break runs from `firstDay` up to and with `lastDay`, and the next
   * Break can start on `nextStart`, a day after it, all `YYYY-MM-DD`; `daysLeft`
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
  /** The Break days of the 30 days that end today are spent; the next Break can start on `nextStart`, `YYYY-MM-DD`. */
  | { readonly kind: 'waiting'; readonly nextStart: string };

/**
 * The Break (ADR 0066): the reader pauses the Streak from today, free,
 * for up to 7 Break days in any 30 days in a row, so no Break runs past them
 * across the edge of a month's allowance, and may end it early. Starting one appends a Break-started record to the XP log;
 * its days keep the Streak and add nothing to it. Ending one appends a
 * Break-ended record: today and the days after it count again, and the days
 * not used come back for a later Break.
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
    const ordered = [...xpLog.days.breaks]
      .map(([start, days]) => ({ start: dayNumber(parseLocalDate(start)), days }))
      .filter(({ start }) => Number.isFinite(start));
    const breakDays = new Set(
      ordered.flatMap(({ start, days }) => Array.from({ length: days }, (_, day) => start + day)),
    );
    if (breakDays.size === 0) return { kind: 'available', longest: BREAK_DAYS_AT_MOST };
    /** Whether a Break of `days` from the day keeps every 30 days in a row at `BREAK_DAYS_AT_MOST` Break days at most. */
    function fits(first: number, days: number): boolean {
      for (let from = first - BREAK_INTERVAL_DAYS + 1; from < first + days; from += 1) {
        let count = 0;
        for (let day = from; day < from + BREAK_INTERVAL_DAYS; day += 1) {
          if (breakDays.has(day) || (day >= first && day < first + days)) count += 1;
        }
        if (count > BREAK_DAYS_AT_MOST) return false;
      }
      return true;
    }
    const lastBreakDay = Math.max(...breakDays);
    /** The first day from `from` on which a Break of one day fits: 30 days after the last Break day at the latest. */
    function nextStartFrom(from: number): string {
      let day = from;
      while (breakDays.has(day) || !fits(day, 1)) day += 1;
      return after(day - todayNumber);
    }
    const running = ordered.find(
      ({ start, days }) => todayNumber >= start && todayNumber < start + days,
    );
    if (running !== undefined) {
      const { active, frozen, breaks } = xpLog.days;
      const lastDayNumber = running.start + running.days - 1;
      const last = after(lastDayNumber - todayNumber);
      return {
        kind: 'running',
        firstDay: after(running.start - todayNumber),
        lastDay: last,
        nextStart: nextStartFrom(lastDayNumber + 1),
        daysLeft: lastDayNumber + 1 - todayNumber,
        strip: breakStrip({
          activeDays: active,
          frozen,
          breaks,
          today: todayKey(clock),
          lastDay: last,
        }),
      };
    }
    // A Break that starts after today, from a clock that moved back, waits for the day after it.
    if (lastBreakDay > todayNumber)
      return { kind: 'waiting', nextStart: nextStartFrom(lastBreakDay + 1) };
    let longest = 0;
    while (longest < BREAK_DAYS_AT_MOST && fits(todayNumber, longest + 1)) longest += 1;
    return longest > 0
      ? { kind: 'available', longest }
      : { kind: 'waiting', nextStart: nextStartFrom(todayNumber + 1) };
  }

  async function start(days: number): Promise<'started' | 'refused'> {
    const current = state();
    if (current.kind !== 'available' || !Number.isInteger(days) || days < 1) return 'refused';
    if (days > current.longest) return 'refused';
    await writeStaged(userState, [xpLog.startBreak(days)]);
    void analytics.track('breakStarted', { days }).catch(() => undefined);
    return 'started';
  }

  async function end(): Promise<'ended' | 'refused'> {
    const current = state();
    if (current.kind !== 'running') return 'refused';
    await writeStaged(userState, [xpLog.endBreak(current.firstDay)]);
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
