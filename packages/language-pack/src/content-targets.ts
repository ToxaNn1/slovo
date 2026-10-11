import { z } from 'zod';

import type { ContentReport } from './report';

/**
 * The floor an Edition's content must reach before it ships, declared by the
 * Edition in `content/targets.json`. Every target is optional; a missing one
 * is not checked. Word counts leave Retired Words out, as the report does.
 */
export const ContentTargetsSchema = z.strictObject({
  minWords: z.int().nonnegative().optional(),
  minCorrections: z.int().nonnegative().optional(),
  minWordsPerCategory: z.int().nonnegative().optional(),
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
  const { minWords, minCorrections, minWordsPerCategory, everyRarity, everyWordHasStress } =
    targets;

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
  if (minWordsPerCategory !== undefined) {
    for (const { categoryId, words } of report.wordsPerCategory) {
      if (words < minWordsPerCategory) {
        missed.push({
          target: 'minWordsPerCategory',
          message: `Category "${categoryId}" has ${String(words)} Words, below the target of ${String(minWordsPerCategory)}`,
        });
      }
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
