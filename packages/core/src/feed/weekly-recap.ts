import type { ActiveDays } from '../progress/active-days';
import type { Edition } from '../edition/edition';
import type { Favorites } from '../saved/favorites';
import type { History } from '../saved/history';
import { dateKeyOf, isMonday, localDateAfter, localDayOf, type LocalDate } from '../local-date';
import type { Clock } from '../ports';
import type { Progress } from '../progress/progress';
import type { XpLog } from '../progress/xp-log';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

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
  /** The XP earned in the week. Absent with the `xpLog` Feature Switch off. */
  readonly xp?: number;
  /**
   * The days of the week that met their Daily Goal. Absent with the `xpLog`
   * or the `dailyGoal` Feature Switch off.
   */
  readonly goalDays?: number;
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

const { knowledge } = userStateRecords;

/**
 * Creates the Weekly Recap over History, Favorites, the Knowledge Marks' times
 * in the user state, the Active Days and Progress's Streak.
 */
export function createWeeklyRecap({
  edition,
  userState,
  clock,
  history,
  favorites,
  progress,
  activeDays,
  xpLog,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
  clock: Clock;
  history: Pick<History, 'list'>;
  favorites: Pick<Favorites, 'list'>;
  progress: Pick<Progress, 'state'>;
  activeDays: Pick<ActiveDays, 'days'>;
  xpLog: Pick<XpLog, 'dayOf'>;
}): WeeklyRecap {
  return {
    async of(day) {
      if (!edition.isFeatureEnabled('weeklyRecap') || !isMonday(day)) return undefined;
      const week = new Set(
        Array.from({ length: 7 }, (_, index) => dateKeyOf(localDateAfter(day, index - 7))),
      );
      if (![...activeDays.days].some((date) => week.has(date))) return undefined;
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
      /** The week's XP and goal days, each while its Feature Switch is on. */
      function xpOfWeek(dates: readonly string[]): Pick<WeeklyRecapModel, 'xp' | 'goalDays'> {
        if (!edition.isFeatureEnabled('xpLog')) return {};
        const days = dates.map((date) => xpLog.dayOf(date));
        const xp = days.reduce((sum, { xp: dayXp }) => sum + dayXp, 0);
        if (!edition.isFeatureEnabled('dailyGoal')) return { xp };
        return { xp, goalDays: days.filter(({ dailyGoal }) => dailyGoal?.met === true).length };
      }
      return {
        firstDay: localDateAfter(day, -7),
        lastDay: localDateAfter(day, -1),
        seen: history.list.filter(({ seenAt }) => inWeek(seenAt)).length,
        saved: favorites.list.filter(({ addedAt }) => inWeek(addedAt)).length,
        ...(edition.isFeatureEnabled('knowledge') ? { known: await knownInWeek() } : {}),
        streak: progress.state.streak,
        ...xpOfWeek([...week]),
      };
    },
  };
}
