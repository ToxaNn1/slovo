import { dateKeyOf, dayNumber, localDateAfter, parseLocalDate } from '../local-date';

/** The XP of learning actions a local date needs to be an Active Day (ADR 0066), apart from the Daily Goal. */
export const ACTIVE_DAY_XP = 5;

/** The freezes a new reader holds. */
const FREEZES_AT_START = 2;
/** The most freezes held at once. */
const FREEZES_HELD_AT_MOST = 2;
/** The Streak days that add one freeze. */
const STREAK_DAYS_PER_FREEZE = 7;

/** The Streak days that fire a celebration: 1 to 7, then 14, 30, 50, 100, 200 and 365. */
export const STREAK_MILESTONES: ReadonlySet<number> = new Set([
  1, 2, 3, 4, 5, 6, 7, 14, 30, 50, 100, 200, 365,
]);

/** The Streak as the reader sees it, derived and never stored. */
export interface StreakState {
  /**
   * The Active Days in a row up to today, or up to yesterday while today isn't
   * an Active Day yet; a day a freeze covers keeps it without adding to it.
   * 0 once a missed day breaks it.
   */
  readonly streak: number;
  /** The Best Streak: the longest Streak there has ever been. */
  readonly bestStreak: number;
  /** The Streak freezes held now; none with freezes off. */
  readonly freezesHeld: number;
}

/** The Streak, with what the day change makes of it. */
export interface DerivedStreak extends StreakState {
  /** The missed days up to yesterday held freezes cover, which no record covers yet. */
  readonly toFreeze: readonly string[];
  /** The last Streak a run of missed days up to yesterday broke: its last covered or Active Day and its length. */
  readonly broken: { readonly lastDay: string; readonly streak: number } | undefined;
}

/**
 * Derives the Streak by local date from the Active Days and the days freezes
 * covered, all `YYYY-MM-DD`, on the local date `today` (ADR 0066). From the
 * first Active Day the reader holds 2 freezes, gains one for every 7 Streak
 * days and holds at most 2. A missed day a freeze record covers keeps the
 * Streak. With `freezes` on, the missed days up to yesterday are covered by
 * held freezes when they all can be, and `toFreeze` names them; otherwise a
 * missed day resets the Streak, with no repair.
 */
export function deriveStreak({
  activeDays,
  frozen,
  today,
  freezes,
}: {
  activeDays: ReadonlySet<string>;
  frozen: ReadonlySet<string>;
  today: string;
  freezes: boolean;
}): DerivedStreak {
  const todayDate = parseLocalDate(today);
  const todayNumber = dayNumber(todayDate);
  const numberOf = (date: string) => dayNumber(parseLocalDate(date));
  const dateOf = (number: number) => dateKeyOf(localDateAfter(todayDate, number - todayNumber));
  const active = new Set([...activeDays].map(numberOf).filter(Number.isFinite));
  const covered = new Set([...frozen].map(numberOf).filter(Number.isFinite));

  let streak = 0;
  let bestStreak = 0;
  let held = FREEZES_AT_START;
  let lastKept = Number.NaN;
  const toFreeze: string[] = [];
  let broken: DerivedStreak['broken'];

  function activeDay(day: number): void {
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    lastKept = day;
    if (streak % STREAK_DAYS_PER_FREEZE === 0) held = Math.min(FREEZES_HELD_AT_MOST, held + 1);
  }

  const first = Math.min(...active);
  for (let day = first; day < todayNumber; day += 1) {
    if (active.has(day)) {
      activeDay(day);
    } else if (covered.has(day)) {
      held = Math.max(0, held - 1);
      lastKept = day;
    } else {
      let end = day;
      while (end + 1 < todayNumber && !active.has(end + 1) && !covered.has(end + 1)) end += 1;
      const missed = end - day + 1;
      const upToYesterday = end === todayNumber - 1;
      if (freezes && upToYesterday && streak > 0 && missed <= held) {
        for (let gap = day; gap <= end; gap += 1) toFreeze.push(dateOf(gap));
        held -= missed;
        lastKept = end;
      } else {
        if (upToYesterday && streak > 0) broken = { lastDay: dateOf(lastKept), streak };
        streak = 0;
      }
      day = end;
    }
  }
  if (active.has(todayNumber)) activeDay(todayNumber);

  return {
    streak,
    bestStreak,
    freezesHeld: freezes ? held : 0,
    toFreeze,
    broken,
  };
}
