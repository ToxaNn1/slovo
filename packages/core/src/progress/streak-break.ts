import { createInTurn } from '../in-turn';
import { dateKeyOf, dayNumber, localDateAfter, parseLocalDate, todayKey } from '../local-date';
import type { Analytics } from '../analytics/analytics';
import type { Clock } from '../ports';
import type { Edition } from '../edition/edition';
import type { UserState } from '../user-state/user-state';
import { BREAK_DAYS_AT_MOST, BREAK_INTERVAL_DAYS } from './streak';
import type { XpLog } from './xp-log';

/** Whether the reader can start a Break today, derived from the XP log and never stored. */
export type BreakState =
  /** The XP log or the `streakBreak` Feature Switch is off: no Break starts. */
  | { readonly kind: 'off' }
  /** A Break of 1 to `longest` days can start today. */
  | { readonly kind: 'available'; readonly longest: number }
  /** A Break runs up to and with `lastDay`, `YYYY-MM-DD`. */
  | { readonly kind: 'running'; readonly lastDay: string }
  /** The last Break is over; the next one can start on `nextStart`, `YYYY-MM-DD`. */
  | { readonly kind: 'waiting'; readonly nextStart: string };

/**
 * The Break (ADR 0066): the reader pauses the Streak for up to 7 days from
 * today, once every 30 days, free. Starting one appends a Break-started record
 * to the XP log; its days keep the Streak and add nothing to it.
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
  xpLog: Pick<XpLog, 'days' | 'startBreak' | 'subscribe'>;
  analytics: Pick<Analytics, 'track'>;
}): StreakBreak {
  const inTurn = createInTurn();
  const on = () => edition.isFeatureEnabled('xpLog') && edition.isFeatureEnabled('streakBreak');

  function state(): BreakState {
    if (!on()) return { kind: 'off' };
    const today = parseLocalDate(todayKey(clock));
    const todayNumber = dayNumber(today);
    const after = (days: number) => dateKeyOf(localDateAfter(today, days));
    let latest: { start: number; days: number } | undefined;
    for (const [start, days] of xpLog.days.breaks) {
      const startNumber = dayNumber(parseLocalDate(start));
      // A Break that starts after today, from a clock that moved back, waits like the latest.
      if (Number.isFinite(startNumber) && (latest === undefined || startNumber > latest.start)) {
        latest = { start: startNumber, days };
      }
    }
    if (latest === undefined || todayNumber >= latest.start + BREAK_INTERVAL_DAYS) {
      return { kind: 'available', longest: BREAK_DAYS_AT_MOST };
    }
    const lastDay = latest.start + latest.days - 1;
    if (todayNumber >= latest.start && todayNumber <= lastDay) {
      return { kind: 'running', lastDay: after(lastDay - todayNumber) };
    }
    return { kind: 'waiting', nextStart: after(latest.start + BREAK_INTERVAL_DAYS - todayNumber) };
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
    subscribe: xpLog.subscribe,
  };
}
