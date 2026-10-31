import type { Collections } from '../saved/collections';
import type { Favorites } from '../saved/favorites';
import type { Game } from '../game/game';
import type { History } from '../saved/history';
import type { Knowledge, KnownCounts } from '../knowledge/knowledge';
import { createSubscribers } from '../in-turn';
import { todayBounds, todayKey } from '../local-date';
import type { Clock } from '../ports';
import type { Edition } from '../edition/edition';
import type { ActiveDays } from './active-days';
import { calendarMonths, type CalendarMonth } from './calendar';
import { STREAK_MILESTONES } from './streak';

/**
 * The reader's progress as it stands, as the stats sheet shows it: the Streak
 * and the Best Streak derived from the Active Days, the counts of the Entries
 * the reader has Seen today and kept, the best Game result, and the counts of
 * the Knowledge Marks.
 */
export interface ProgressState {
  /**
   * The consecutive Active Days up to today, or up to yesterday while today
   * isn't an Active Day yet, which a day a Streak freeze covers keeps; 0 once
   * a missed day with no freeze breaks it.
   */
  readonly streak: number;
  /** The Best Streak: the longest Streak there has ever been. */
  readonly bestStreak: number;
  /** The Streak freezes held, 0 to 2; 0 with freezes off. */
  readonly freezesHeld: number;
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
  /**
   * The months of the Active Days calendar as of now, oldest first, from the
   * month of the first Active Day to the current one; none with the
   * `activeDaysCalendar` Feature Switch off. A change of the Active Days tells
   * the subscribers, so read it again then.
   */
  calendar(): readonly CalendarMonth[];
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Calls `listener` with the Streak each time today's Active Day makes it a
   * Streak day that is celebrated: 1 to 7, then 14, 30, 50, 100, 200 and 365.
   * Returns the call that stops it.
   */
  onStreakMilestone(listener: (streak: number) => void): () => void;
}

const sameState = (one: ProgressState, other: ProgressState) =>
  (Object.keys(one) as (keyof ProgressState)[]).every((key) => one[key] === other[key]);

/**
 * Opens Progress over the Active Days, which the day change records (ADR
 * 0022), for the Core composition. It follows them, History, Favorites,
 * Collections, the Knowledge Marks and the Game, so a change of any of them
 * changes the state at once.
 */
export function openProgress({
  edition,
  clock,
  activeDays,
  history,
  favorites,
  collections,
  game,
  knowledge,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  clock: Clock;
  activeDays: Pick<ActiveDays, 'days' | 'streak' | 'subscribe'>;
  history: History;
  favorites: Favorites;
  collections: Collections;
  game: Pick<Game, 'state' | 'subscribe'>;
  knowledge: Pick<Knowledge, 'state' | 'subscribe'>;
}): Progress {
  const subscribers = createSubscribers();
  const milestones = new Set<(streak: number) => void>();

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

  /** The state as of now, on today's local date in the clock's time zone. */
  function stateOf(): ProgressState {
    return {
      ...activeDays.streak,
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

  let state = stateOf();

  /** Makes the state again on today's local date, and tells the subscribers when a number changed. */
  function follow(): void {
    const next = stateOf();
    if (sameState(next, state)) return;
    const celebrated =
      next.streak > state.streak &&
      activeDays.days.has(todayKey(clock)) &&
      STREAK_MILESTONES.has(next.streak);
    state = next;
    subscribers.tell();
    if (celebrated) for (const listener of [...milestones]) listener(next.streak);
  }

  for (const source of [activeDays, history, favorites, collections, game, knowledge]) {
    source.subscribe(follow);
  }

  return {
    get state() {
      return state;
    },
    calendar: () =>
      edition.isFeatureEnabled('activeDaysCalendar')
        ? calendarMonths(activeDays.days, todayKey(clock))
        : [],
    subscribe: subscribers.subscribe,
    onStreakMilestone(listener) {
      milestones.add(listener);
      return () => {
        milestones.delete(listener);
      };
    },
  };
}
