import type { Collections } from '../saved/collections';
import type { Favorites } from '../saved/favorites';
import type { Game } from '../game/game';
import type { History } from '../saved/history';
import type { Knowledge, KnownCounts } from '../knowledge/knowledge';
import { createInTurn, createSubscribers } from '../in-turn';
import { dayNumber, parseLocalDate, todayBounds, todayKey } from '../local-date';
import type { Clock, UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/**
 * The reader's progress as it stands, as the stats sheet shows it: the Streak
 * and the Best Streak derived from the Active Days, the counts of the Entries
 * the reader has Seen today and kept, the best Game result, and the counts of
 * the Knowledge Marks.
 */
export interface ProgressState {
  /**
   * The consecutive Active Days up to today, or up to yesterday while today
   * isn't an Active Day yet; 0 once a day is missed.
   */
  readonly streak: number;
  /** The Best Streak: the most consecutive Active Days there have ever been. */
  readonly bestStreak: number;
  /** The Entries Seen today: the History entries whose time falls on today's local date. */
  readonly seenToday: number;
  /** The Entries in Favorites. */
  readonly favorites: number;
  /** The Entries in Collections, each counted once however many Collections it is in. */
  readonly inCollections: number;
  /**
   * The Best result of «Вгадай слово», which the statistics screen keeps;
   * none before its first finished Game, or with the Game off.
   */
  readonly bestResult: number | undefined;
  /** The Entries marked Known, by kind, as the Knowledge Marks give them. */
  readonly known: KnownCounts;
  /** The Entries due for Review today, which the Knowledge Marks give with a Hidden Entry left out. */
  readonly dueToday: number;
}

/**
 * Progress: the Active Days, and the Streak and the Best Streak derived from
 * them, never stored, with the counts of History, Favorites, Collections and
 * the Knowledge Marks and the Game's best result, which it follows as they change. Read from the
 * user state once, when it opens, like the Cycle, so open one per app session
 * (the Core composition does).
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
function streaksOf(
  activeDays: ReadonlySet<string>,
  today: string,
): Pick<ProgressState, 'streak' | 'bestStreak'> {
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

const sameState = (one: ProgressState, other: ProgressState) =>
  (Object.keys(one) as (keyof ProgressState)[]).every((key) => one[key] === other[key]);

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
 * to write with its own. Recording a day already recorded writes nothing. It
 * follows History, Favorites, Collections, the Knowledge Marks and the
 * Game, so a change of any of them changes the state at once.
 */
export async function openProgress({
  userState,
  clock,
  history,
  favorites,
  collections,
  game,
  knowledge,
}: {
  userState: UserState;
  clock: Clock;
  history: History;
  favorites: Favorites;
  collections: Collections;
  game: Pick<Game, 'state' | 'subscribe'>;
  knowledge: Pick<Knowledge, 'state' | 'subscribe'>;
}): Promise<{
  progress: Progress;
  recordToday: () => Promise<void>;
  todayChange: () => ActiveDayChange;
}> {
  const activeDays = new Set((await userState.list(activeDayRecords)).keys());
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  /**
   * The History entries Seen on today's local date. History is newest first,
   * so the count stops at the first one Seen before today.
   */
  function seenTodayIn(list: History['list']): number {
    const { start, end } = todayBounds(clock);
    let seenToday = 0;
    for (const { seenAt } of list) {
      const time = seenAt.getTime();
      if (time < start) break;
      // An entry ahead of today, after the clock moved back, is not today's.
      if (time < end) seenToday += 1;
    }
    return seenToday;
  }

  /** The state as of now, on the local date `today` in the clock's time zone. */
  function stateOf(today: string): ProgressState {
    return {
      ...streaksOf(activeDays, today),
      seenToday: seenTodayIn(history.list),
      favorites: favorites.list.length,
      inCollections: new Set(
        collections.list.flatMap((collection) =>
          collections.entries(collection.id).map((entry) => entry.entryId),
        ),
      ).size,
      bestResult: game.state.bestResults['guess-word'],
      known: knowledge.state.known,
      dueToday: knowledge.state.due.length,
    };
  }

  let state = stateOf(todayKey(clock));

  /** Makes the state again on the local date `today`, and tells the subscribers when a number changed. */
  function follow(today = todayKey(clock)): void {
    const next = stateOf(today);
    if (sameState(next, state)) return;
    state = next;
    subscribers.tell();
  }

  for (const source of [history, favorites, collections, game, knowledge]) {
    source.subscribe(() => {
      follow();
    });
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
