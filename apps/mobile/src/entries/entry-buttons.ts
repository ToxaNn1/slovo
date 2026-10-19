import type { Edition } from '@slovo/core';

/** Which switchable buttons an Entry card draws, wherever the card appears. */
export interface EntryButtons {
  /** The Share Card button of the action row. */
  readonly shareCard: boolean;
  /** The Pronunciation button of the Word card. */
  readonly pronunciation: boolean;
  /** The «Знаю» and «Не знаю» buttons of the action row. */
  readonly knowledge: boolean;
}

/** The buttons the Edition shows in effect: each only when its Feature Switch is on (ADR 0040). */
export function entryButtonsOf(edition: Pick<Edition, 'isFeatureEnabled'>): EntryButtons {
  return {
    shareCard: edition.isFeatureEnabled('shareCards'),
    pronunciation: edition.isFeatureEnabled('pronunciation'),
    knowledge: edition.isFeatureEnabled('knowledge'),
  };
}
