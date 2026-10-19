import type { Edition } from '@slovo/core';

/** What the progress UI draws: the statistics screens, and the Streak within them. */
export interface ProgressShown {
  /** The Stats pill, the stats sheet and the setting that hides the Streak. */
  readonly statistics: boolean;
  /** The Streak and the Best Streak, wherever they are drawn. */
  readonly streak: boolean;
  /** The counts of the Knowledge Marks in the stats sheet. */
  readonly knowledge: boolean;
}

/**
 * The statistics show only while their Feature Switch is on in effect
 * (ADR 0040); the Streak is part of them, and the reader may hide it too.
 * The knowledge counts show while the `knowledge` switch is on as well.
 */
export function progressShownOf(
  edition: Pick<Edition, 'isFeatureEnabled'>,
  settings: { readonly hideStreak: boolean },
): ProgressShown {
  const statistics = edition.isFeatureEnabled('statistics');
  return {
    statistics,
    streak: statistics && !settings.hideStreak,
    knowledge: statistics && edition.isFeatureEnabled('knowledge'),
  };
}
