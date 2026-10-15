import { describe, expect, it } from 'vitest';

import { tabsOf } from './tabs';

describe('the tabs', () => {
  it('shows the four tabs in their order when the Edition turns the Game on', () => {
    expect(tabsOf({ isFeatureEnabled: () => true })).toEqual(['home', 'settings', 'game', 'saved']);
  });

  it('has no Game tab when the Edition turns the Game off', () => {
    expect(tabsOf({ isFeatureEnabled: (feature) => feature !== 'game' })).toEqual([
      'home',
      'settings',
      'saved',
    ]);
  });
});
