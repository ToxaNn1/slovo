import { ContentTargetsSchema, type ContentTargets } from '@slovo/contracts';

import type { ContentReport } from './report';

export { ContentTargetsSchema, type ContentTargets };

export type ContentTarget = keyof ContentTargets;

/** A target the content falls short of, and by how much. */
export interface MissedTarget {
  readonly target: ContentTarget;
  readonly message: string;
}

/** The floor of Words a Category must reach, and the target that sets it; none when no target does. */
export function wordFloor(
  targets: ContentTargets,
  categoryId: string,
):
  | { readonly target: 'minWordsByCategory' | 'minWordsPerCategory'; readonly min: number }
  | undefined {
  const own = targets.minWordsByCategory?.[categoryId];
  if (own !== undefined) return { target: 'minWordsByCategory', min: own };
  const { minWordsPerCategory } = targets;
  return minWordsPerCategory === undefined
    ? undefined
    : { target: 'minWordsPerCategory', min: minWordsPerCategory };
}

/** The floor of Words each rarity must reach; none when no target sets one. */
export function rarityFloor(targets: ContentTargets): number | undefined {
  return targets.everyRarity === true ? 1 : undefined;
}

export function missedTargets(report: ContentReport, targets: ContentTargets): MissedTarget[] {
  const missed: MissedTarget[] = [];
  const {
    minWords,
    minCorrections,
    minIdioms,
    minWordsByCategory = {},
    minCorrectionsPerCategory,
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
    const floor = wordFloor(targets, categoryId);
    if (floor !== undefined && words < floor.min) {
      const { target, min } = floor;
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
  for (const { categoryId, corrections } of report.correctionsPerCategory) {
    if (minCorrectionsPerCategory !== undefined && corrections < minCorrectionsPerCategory) {
      missed.push({
        target: 'minCorrectionsPerCategory',
        message: `Category "${categoryId}" has ${String(corrections)} Corrections, below the target of ${String(minCorrectionsPerCategory)}`,
      });
    }
  }
  const perRarity = rarityFloor(targets);
  if (perRarity !== undefined) {
    const empty = report.rarity
      .filter(({ words }) => words < perRarity)
      .map(({ rarity }) => rarity);
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
