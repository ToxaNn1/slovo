import type { FeatureSwitch } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { entryButtonsOf } from './entry-buttons';

/** An Edition with the given Feature Switches off and every other on. */
function editionWithout(...off: FeatureSwitch[]) {
  return { isFeatureEnabled: (feature: FeatureSwitch) => !off.includes(feature) };
}

describe('the buttons of an Entry card', () => {
  it('has the Share Card and Pronunciation buttons when both switches are on', () => {
    expect(entryButtonsOf(editionWithout())).toEqual({ shareCard: true, pronunciation: true });
  });

  it('has no Share Card button when Share Cards are off', () => {
    expect(entryButtonsOf(editionWithout('shareCards'))).toEqual({
      shareCard: false,
      pronunciation: true,
    });
  });

  it('has no Pronunciation button when Pronunciation is off', () => {
    expect(entryButtonsOf(editionWithout('pronunciation'))).toEqual({
      shareCard: true,
      pronunciation: false,
    });
  });
});
