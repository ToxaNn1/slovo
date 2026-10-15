import type { Edition } from '@slovo/core';

/** Every tab in its final order: Home, Settings, Game, Saved. */
const allTabs = ['home', 'settings', 'game', 'saved'] as const;

export type Tab = (typeof allTabs)[number];

/** The tabs the Edition shows, in order: the Game only when its Feature Switch is on. */
export function tabsOf(edition: Pick<Edition, 'isFeatureEnabled'>): readonly Tab[] {
  return allTabs.filter((tab) => tab !== 'game' || edition.isFeatureEnabled('game'));
}
