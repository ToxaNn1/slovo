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
}

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
  const index = Math.min(Math.floor(level / 5), levels.names.length - 1);
  return levels.names[index] ?? '';
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
  return {
    level,
    name: nameOf(levels, level),
    progress: total - start,
    toNext: costOf(levels, level + 1),
  };
}

/** The total XP the Level `level` takes. */
export function totalFor(levels: Levels, level: number): number {
  let total = 0;
  for (let each = 1; each <= level; each += 1) total += costOf(levels, each);
  return total;
}
