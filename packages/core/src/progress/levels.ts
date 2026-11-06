import type { Levels } from '@slovo/contracts';

/** The Level as the reader sees it, derived from total XP and never stored (ADR 0066). */
export interface LevelState {
  /** The Level, 0 before the first. */
  readonly level: number;
  /** The Edition's name for the Level, one per five levels. */
  readonly name: string;
  /** The XP earned since the Level was reached. */
  readonly progress: number;
  /** The XP the next Level costs from this one. */
  readonly toNext: number;
  /** The Levels its name covers. */
  readonly band: LevelBand;
  /** The next name: its first Level and the XP left to it; none under the last name. */
  readonly next: NextName | undefined;
  /** Every name in order, as a ladder of rungs passed, current and ahead. */
  readonly ladder: readonly LadderRung[];
}

/** The Levels one name covers: from `first` to `last`, with no `last` for the last name. */
export interface LevelBand {
  readonly first: number;
  readonly last: number | undefined;
}

/** The name after the Level's own, its first Level and the XP left to reach it. */
export interface NextName {
  readonly name: string;
  readonly level: number;
  readonly xp: number;
}

/** One name on the Level ladder, its band, and where the reader stands on it. */
export interface LadderRung {
  readonly name: string;
  readonly band: LevelBand;
  readonly state: 'passed' | 'current' | 'ahead';
}

/** The Levels each name covers. */
const LEVELS_PER_NAME = 5;

/** The Levels whose reaching brings a Feed Notice, highest first. */
export const LEVEL_MILESTONES = [20, 10, 5] as const;

/** A Level whose reaching brings a Feed Notice. */
export type LevelMilestone = (typeof LEVEL_MILESTONES)[number];

/** What the Level `level` costs from the one before it, by the Edition's curve. */
function costOf(levels: Levels, level: number): number {
  return level <= levels.growingUntil
    ? Math.round(levels.first * (1 + levels.growth) ** (level - 1))
    : levels.later;
}

/** The Edition's name for the Level: one per five levels, the last kept for every level above. */
export function nameOf(levels: Levels, level: number): string {
  return levels.names[nameIndexOf(levels, level)] ?? '';
}

/** The index of the Edition's name for the Level. */
function nameIndexOf(levels: Levels, level: number): number {
  return Math.min(Math.floor(level / LEVELS_PER_NAME), levels.names.length - 1);
}

/** The band of the name at `index`: the last name has no last Level. */
function bandOf(levels: Levels, index: number): LevelBand {
  const first = index * LEVELS_PER_NAME;
  return {
    first,
    last: index < levels.names.length - 1 ? first + LEVELS_PER_NAME - 1 : undefined,
  };
}

/** The Level `total` XP reach, with its name and the progress to the next. */
export function levelOf(levels: Levels, total: number): LevelState {
  let level = 0;
  let start = 0;
  while (level < levels.growingUntil && total >= start + costOf(levels, level + 1)) {
    start += costOf(levels, level + 1);
    level += 1;
  }
  if (level === levels.growingUntil) {
    const past = Math.floor((total - start) / levels.later);
    level += past;
    start += past * levels.later;
  }
  const index = nameIndexOf(levels, level);
  const nextName = levels.names[index + 1];
  const nextLevel = (index + 1) * LEVELS_PER_NAME;
  return {
    level,
    name: nameOf(levels, level),
    progress: total - start,
    toNext: costOf(levels, level + 1),
    band: bandOf(levels, index),
    next:
      nextName === undefined
        ? undefined
        : { name: nextName, level: nextLevel, xp: totalFor(levels, nextLevel) - total },
    ladder: levels.names.map((name, each) => ({
      name,
      band: bandOf(levels, each),
      state: each < index ? 'passed' : each === index ? 'current' : 'ahead',
    })),
  };
}

/** The total XP the Level `level` takes. */
export function totalFor(levels: Levels, level: number): number {
  let total = 0;
  for (let each = 1; each <= level; each += 1) total += costOf(levels, each);
  return total;
}
