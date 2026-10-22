import { z } from 'zod';

import type { ContentReport } from './report';

/**
 * The floor an Edition's content must reach before it ships, declared by the
 * Edition in `content/targets.json`. Every target is optional; a missing one
 * is not checked. The counts leave Retired Entries out, as the report does.
 */
export const ContentTargetsSchema = z.strictObject({
  minWords: z.int().nonnegative().optional(),
  minCorrections: z.int().nonnegative().optional(),
  minIdioms: z.int().nonnegative().optional(),
  minWordsPerCategory: z.int().nonnegative().optional(),
  /** A floor of Words for each named Category, taken over `minWordsPerCategory` for it. */
  minWordsByCategory: z.record(z.string(), z.int().nonnegative()).optional(),
  /** Every rarity, 1 to 5, has at least one Word. */
  everyRarity: z.boolean().optional(),
  /** Every Word has at least one Stress. */
  everyWordHasStress: z.boolean().optional(),
});

export type ContentTargets = z.infer<typeof ContentTargetsSchema>;

export type ContentTarget = keyof ContentTargets;

/** A target the content falls short of, and by how much. */
export interface MissedTarget {
  readonly target: ContentTarget;
  readonly message: string;
}

export function missedTargets(report: ContentReport, targets: ContentTargets): MissedTarget[] {
  const missed: MissedTarget[] = [];
  const {
    minWords,
    minCorrections,
    minIdioms,
    minWordsPerCategory,
    minWordsByCategory = {},
    everyRarity,
    everyWordHasStress,
  } = targets;

  if (minWords !== undefined && report.words < minWords) {
    missed.push({
      target: 'minWords',
      message: `${String(report.words)} Words, below the target of ${String(minWords)}`,
    });
  }
  if (minCorrections !== undefined && report.corrections < minCorrections) {
    missed.push({
      target: 'minCorrections',
      message: `${String(report.corrections)} Corrections, below the target of ${String(minCorrections)}`,
    });
  }
  if (minIdioms !== undefined && report.idioms < minIdioms) {
    missed.push({
      target: 'minIdioms',
      message: `${String(report.idioms)} Idioms, below the target of ${String(minIdioms)}`,
    });
  }
  for (const { categoryId, words } of report.wordsPerCategory) {
    const floor = minWordsByCategory[categoryId];
    const [target, min] =
      floor === undefined
        ? (['minWordsPerCategory', minWordsPerCategory] as const)
        : (['minWordsByCategory', floor] as const);
    if (min !== undefined && words < min) {
      missed.push({
        target,
        message: `Category "${categoryId}" has ${String(words)} Words, below the target of ${String(min)}`,
      });
    }
  }
  const categoryIds = new Set(report.wordsPerCategory.map(({ categoryId }) => categoryId));
  for (const categoryId of Object.keys(minWordsByCategory)) {
    if (!categoryIds.has(categoryId)) {
      missed.push({
        target: 'minWordsByCategory',
        message: `No Category "${categoryId}" in the Edition`,
      });
    }
  }
  if (everyRarity === true) {
    const empty = report.rarity.filter(({ words }) => words === 0).map(({ rarity }) => rarity);
    if (empty.length > 0) {
      missed.push({ target: 'everyRarity', message: `No Words of rarity ${empty.join(', ')}` });
    }
  }
  const unstressed = report.words - report.coverage.stress;
  if (everyWordHasStress === true && unstressed > 0) {
    missed.push({
      target: 'everyWordHasStress',
      message: `${String(unstressed)} of ${String(report.words)} Words have no Stress`,
    });
  }
  return missed;
}
