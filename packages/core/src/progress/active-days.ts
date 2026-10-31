import { createInTurn, createSubscribers } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock, UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

const { activeDays: activeDayRecords } = userStateRecords;

/**
 * The change that records today as an Active Day, for a caller to make in one
 * write with its own, and the step that makes it in memory once they are
 * written (ADR 0013).
 */
export interface ActiveDayChange {
  readonly changes: UserStateChanges;
  /** Makes the change in memory. Call it once the changes are written. */
  commit(): void;
}

/**
 * The Active Days, the local dates `YYYY-MM-DD` the app was used on, which the
 * day change records (ADR 0022) and Progress derives the Streak from.
 */
export interface ActiveDays {
  /** The Active Days as they stand, in memory for the session. */
  readonly days: ReadonlySet<string>;
  /**
   * Writes today, in the clock's time zone, as an Active Day, then makes the
   * change in memory. Writes nothing once today is kept. The subscribers hear
   * of it even when the write fails, so Progress counts back from yesterday
   * until today is kept.
   */
  recordToday(): Promise<void>;
  /** The change that records today for another write, none once today is kept. */
  todayChange(): ActiveDayChange;
  /** Calls `listener` after each change of the days. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** Opens the Active Days over the user state, for the Core composition. */
export async function openActiveDays({
  userState,
  clock,
}: {
  userState: UserState;
  clock: Clock;
}): Promise<ActiveDays> {
  const days = new Set((await userState.list(activeDayRecords)).keys());
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  function todayChange(): ActiveDayChange {
    const today = todayKey(clock);
    return {
      changes: days.has(today) ? new Map() : activeDayRecords.record(today).change(true),
      commit() {
        days.add(today);
        subscribers.tell();
      },
    };
  }

  async function recordToday(): Promise<void> {
    const change = todayChange();
    try {
      if (change.changes.size > 0) await userState.write(change.changes);
    } catch (error) {
      subscribers.tell();
      throw error;
    }
    change.commit();
  }

  return {
    days,
    recordToday: () => inTurn(recordToday),
    todayChange,
    subscribe: subscribers.subscribe,
  };
}
