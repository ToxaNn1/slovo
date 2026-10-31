import { dateKeyOf, dayNumber, localDateAfter, parseLocalDate } from '../local-date';

/** The XP of learning actions a local date needs to be an Active Day (ADR 0066), apart from the Daily Goal. */
export const ACTIVE_DAY_XP = 5;

/** The freezes a new reader holds. */
const FREEZES_AT_START = 2;
/** The most freezes held at once. */
const FREEZES_HELD_AT_MOST = 2;
/** The Streak days that add one freeze. */
const STREAK_DAYS_PER_FREEZE = 7;

/** The most days a Break lasts. */
export const BREAK_DAYS_AT_MOST = 7;
/** The days from the start of one Break to the first day the next one can start. */
const DAYS_BETWEEN_BREAKS = 30;

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

/**
 * Whether the reader can start a Break today (ADR 0066): `off` with its
 * Feature Switch off; `on` while a Break covers today, up to its last day;
 * `waiting` until the first day the next one can start, 30 days after the
 * last one started; otherwise `available`.
 */
export type BreakState =
  | { readonly kind: 'off' }
  | { readonly kind: 'available' }
  | { readonly kind: 'on'; readonly lastDay: string }
  | { readonly kind: 'waiting'; readonly from: string };

/** The Break started on a local date `YYYY-MM-DD` and the days it lasts, that day in. */
export interface StartedBreak {
  readonly date: string;
  readonly days: number;
}

/** The Break state on the local date `today`, from the Breaks started. */
export function breakStateOn(today: string, breaks: readonly StartedBreak[]): BreakState {
  const todayDate = parseLocalDate(today);
  const todayNumber = dayNumber(todayDate);
  const last = breaks
    .map(({ date, days }) => ({ start: dayNumber(parseLocalDate(date)), days }))
    .filter(({ start }) => Number.isFinite(start))
    .reduce<{ start: number; days: number } | undefined>(
      (latest, started) =>
        latest === undefined || started.start > latest.start ? started : latest,
      undefined,
    );
  if (last === undefined) return { kind: 'available' };
  const dateOf = (number: number) => dateKeyOf(localDateAfter(todayDate, number - todayNumber));
  const lastDay = last.start + last.days - 1;
  if (todayNumber >= last.start && todayNumber <= lastDay)
    return { kind: 'on', lastDay: dateOf(lastDay) };
  const from = last.start + DAYS_BETWEEN_BREAKS;
  if (todayNumber < from) return { kind: 'waiting', from: dateOf(from) };
  return { kind: 'available' };
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
 * days and holds at most 2. A missed day a freeze record covers, or a Break
 * started, keeps the Streak without adding to it. With `freezes` on, the missed days up to yesterday are covered by
 * held freezes when they all can be, and `toFreeze` names them; otherwise a
 * missed day resets the Streak, with no repair.
 */
export function deriveStreak({
  activeDays,
  frozen,
  breaks,
  today,
  freezes,
}: {
  activeDays: ReadonlySet<string>;
  frozen: ReadonlySet<string>;
  breaks: readonly StartedBreak[];
  today: string;
  freezes: boolean;
}): DerivedStreak {
  const todayDate = parseLocalDate(today);
  const todayNumber = dayNumber(todayDate);
  const numberOf = (date: string) => dayNumber(parseLocalDate(date));
  const dateOf = (number: number) => dateKeyOf(localDateAfter(todayDate, number - todayNumber));
  const active = new Set([...activeDays].map(numberOf).filter(Number.isFinite));
  const covered = new Set([...frozen].map(numberOf).filter(Number.isFinite));
  const bridged = new Set(
    breaks.flatMap(({ date, days }) =>
      Array.from({ length: days }, (_, index) => numberOf(date) + index),
    ),
  );

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
    } else if (bridged.has(day)) {
      lastKept = day;
    } else {
      let end = day;
      while (
        end + 1 < todayNumber &&
        !active.has(end + 1) &&
        !covered.has(end + 1) &&
        !bridged.has(end + 1)
      )
        end += 1;
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
