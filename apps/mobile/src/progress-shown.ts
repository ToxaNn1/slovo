import type { Edition } from '@slovo/core';

/** What the progress UI draws: the statistics screens, and the Streak within them. */
export interface ProgressShown {
  /** The Stats pill, the stats sheet and the setting that hides the Streak. */
  readonly statistics: boolean;
  /** The Streak and the Best Streak, wherever they are drawn. */
  readonly streak: boolean;
}

/**
 * The statistics show only while their Feature Switch is on in effect
 * (ADR 0040); the Streak is part of them, and the reader may hide it too.
 */
export function progressShownOf(
  edition: Pick<Edition, 'isFeatureEnabled'>,
  settings: { readonly hideStreak: boolean },
): ProgressShown {
  const statistics = edition.isFeatureEnabled('statistics');
  return { statistics, streak: statistics && !settings.hideStreak };
}
