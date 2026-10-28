import type { Edition } from '../edition/edition';
import type { Favorites } from '../saved/favorites';
import type { History } from '../saved/history';
import { dateKeyOf, isMonday, localDateAfter, localDayOf, type LocalDate } from '../local-date';
import type { Clock } from '../ports';
import type { Progress } from './progress';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** The numbers of the Weekly Recap («Ваш тиждень»): one local Monday–Sunday week and the Streak. */
export interface WeeklyRecapModel {
  /** The week's Monday. */
  readonly firstDay: LocalDate;
  /** The week's Sunday. */
  readonly lastDay: LocalDate;
  /** The Entries in History whose last Seen falls in the week. */
  readonly seen: number;
  /** The Favorites added in the week. */
  readonly saved: number;
  /**
   * The Known marks set in the week; a mark kept without its time counts in
   * no week. Absent with the `knowledge` Feature Switch off.
   */
  readonly known?: number;
  /** The current Streak. */
  readonly streak: number;
}

/**
 * The Weekly Recap: a Feed Notice on a local Monday about the week before it
 * (ADR 0054).
 */
export interface WeeklyRecap {
  /**
   * The Weekly Recap of the local day `day`: the numbers of the week before
   * it when it is a Monday, that week had an Active Day and the Edition has
   * `weeklyRecap` on; nothing otherwise.
   */
  of(day: LocalDate): Promise<WeeklyRecapModel | undefined>;
}

const { activeDays, knowledge } = userStateRecords;

/**
 * Creates the Weekly Recap over History, Favorites, the Knowledge Marks' times
 * and the Active Days in the user state, and Progress's Streak.
 */
export function createWeeklyRecap({
  edition,
  userState,
  clock,
  history,
  favorites,
  progress,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
  clock: Clock;
  history: Pick<History, 'list'>;
  favorites: Pick<Favorites, 'list'>;
  progress: Pick<Progress, 'state'>;
}): WeeklyRecap {
  return {
    async of(day) {
      if (!edition.isFeatureEnabled('weeklyRecap') || !isMonday(day)) return undefined;
      const week = new Set(
        Array.from({ length: 7 }, (_, index) => dateKeyOf(localDateAfter(day, index - 7))),
      );
      const days = await userState.list(activeDays);
      if (![...days.keys()].some((date) => week.has(date))) return undefined;
      /** Whether the instant fell in the week, in the clock's time zone. */
      const inWeek = (instant: Date) => week.has(dateKeyOf(localDayOf(instant, clock).date));
      /** The Known marks set in the week. */
      async function knownInWeek(): Promise<number> {
        const marks = await userState.list(knowledge);
        return [...marks.values()].filter(
          ({ mark, markedAt }) =>
            mark === 'known' && markedAt !== undefined && inWeek(new Date(markedAt)),
        ).length;
      }
      return {
        firstDay: localDateAfter(day, -7),
        lastDay: localDateAfter(day, -1),
        seen: history.list.filter(({ seenAt }) => inWeek(seenAt)).length,
        saved: favorites.list.filter(({ addedAt }) => inWeek(addedAt)).length,
        ...(edition.isFeatureEnabled('knowledge') ? { known: await knownInWeek() } : {}),
        streak: progress.state.streak,
      };
    },
  };
}
