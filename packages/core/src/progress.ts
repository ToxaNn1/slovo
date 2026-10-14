import { createInTurn, createSubscribers } from './in-turn';
import { dayNumber, parseLocalDate, todayKey } from './local-date';
import type { Clock, UserStateChanges } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** The reader's progress as it stands, derived from the Active Days. */
export interface ProgressState {
  /**
   * The consecutive Active Days up to today, or up to yesterday while today
   * isn't an Active Day yet; 0 once a day is missed.
   */
  readonly streak: number;
  /** The Best Streak: the most consecutive Active Days there have ever been. */
  readonly bestStreak: number;
}

/**
 * Progress: the Active Days, and the Streak and the Best Streak derived from
 * them, never stored. Read from the user state once, when it opens, like the
 * Cycle, so open one per app session (the Core composition does).
 */
export interface Progress {
  /**
   * The progress as it stands. A change never edits it: it makes a new one and
   * tells the subscribers, so it stays the same object until a number changes.
   */
  readonly state: ProgressState;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { activeDays: activeDayRecords } = userStateRecords;

/** The Streak and the Best Streak of the Active Days, by `YYYY-MM-DD`, on the local date `today`. */
function progressOf(activeDays: ReadonlySet<string>, today: string): ProgressState {
  const days = new Set(
    [...activeDays].map((date) => dayNumber(parseLocalDate(date))).filter(Number.isFinite),
  );
  const todayNumber = dayNumber(parseLocalDate(today));
  let streak = 0;
  for (let day = days.has(todayNumber) ? todayNumber : todayNumber - 1; days.has(day); day -= 1) {
    streak += 1;
  }
  let bestStreak = 0;
  for (const first of days) {
    if (days.has(first - 1)) continue;
    let length = 1;
    while (days.has(first + length)) length += 1;
    bestStreak = Math.max(bestStreak, length);
  }
  return { streak, bestStreak };
}

/**
 * A change of the Active Days not made yet, like a Cycle change: the
 * user-state changes that keep it, for the caller to write alone or in one
 * write with its own, and the step that makes it in memory once they are
 * written (ADR 0013).
 */
export interface ActiveDayChange {
  readonly changes: UserStateChanges;
  /** Makes the change in memory. Call it once the changes are written. */
  commit(): void;
}

/**
 * Opens Progress over the user state, for the Core composition, with
 * `recordToday`, which records today's local date in the clock's time zone as
 * an Active Day, and `todayChange`, the change that records it for the caller
 * to write with its own. Recording a day already recorded writes nothing.
 */
export async function openProgress({
  userState,
  clock,
}: {
  userState: UserState;
  clock: Clock;
}): Promise<{
  progress: Progress;
  recordToday: () => Promise<void>;
  todayChange: () => ActiveDayChange;
}> {
  const activeDays = new Set((await userState.list(activeDayRecords)).keys());
  let state = progressOf(activeDays, todayKey(clock));
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  /** Makes the state follow the Active Days on the local date `today`, telling the subscribers if a number changed. */
  function follow(today: string): void {
    const next = progressOf(activeDays, today);
    if (next.streak !== state.streak || next.bestStreak !== state.bestStreak) {
      state = next;
      subscribers.tell();
    }
  }

  /** The change that records `today` as an Active Day; no changes when it is recorded already. */
  function todayChange(today: string): ActiveDayChange {
    return {
      changes: activeDays.has(today) ? new Map() : activeDayRecords.record(today).change(true),
      commit() {
        activeDays.add(today);
        follow(today);
      },
    };
  }

  /**
   * Writes today as an Active Day, then makes the change in memory. The state
   * follows today even when the write fails, so the Streak counts back from
   * yesterday until today is kept.
   */
  async function recordToday(): Promise<void> {
    const today = todayKey(clock);
    const change = todayChange(today);
    try {
      if (change.changes.size > 0) await userState.write(change.changes);
      change.commit();
    } finally {
      follow(today);
    }
  }

  return {
    progress: {
      get state() {
        return state;
      },
      subscribe: subscribers.subscribe,
    },
    recordToday: () => inTurn(recordToday),
    todayChange: () => todayChange(todayKey(clock)),
  };
}
