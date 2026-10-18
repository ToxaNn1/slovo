import type { FeatureSwitch } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { progressShownOf } from './progress-shown';

/** An Edition with the given Feature Switches off and every other on. */
function editionWithout(...off: FeatureSwitch[]) {
  return { isFeatureEnabled: (feature: FeatureSwitch) => !off.includes(feature) };
}

describe('what the statistics show', () => {
  it('shows the statistics and the Streak when the switch is on and the reader does not hide it', () => {
    expect(progressShownOf(editionWithout(), { hideStreak: false })).toEqual({
      statistics: true,
      streak: true,
    });
  });

  it('hides only the Streak when the reader hides it', () => {
    expect(progressShownOf(editionWithout(), { hideStreak: true })).toEqual({
      statistics: true,
      streak: false,
    });
  });

  it('hides the statistics and the Streak when statistics are off', () => {
    expect(progressShownOf(editionWithout('statistics'), { hideStreak: false })).toEqual({
      statistics: false,
      streak: false,
    });
  });
});
