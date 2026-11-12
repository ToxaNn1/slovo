import { PREFETCH_CARDS, type FeedCard } from '@slovo/core';

/** A Feed card as the prefetch reads it: a Word's card names its Word, any other card none. */
export type CardAhead =
  | { readonly kind: 'word'; readonly model: { readonly wordId: string } }
  | { readonly kind: Exclude<FeedCard['kind'], 'word'> };

/**
 * The Words of the next Feed cards after the card at `onScreen`, as many
 * cards ahead as the prefetch downloads the media of (ADR 0099).
 */
export function wordIdsAhead(cards: readonly CardAhead[], onScreen: number): string[] {
  return cards
    .slice(onScreen + 1, onScreen + 1 + PREFETCH_CARDS)
    .flatMap((card) => (card.kind === 'word' ? [card.model.wordId] : []));
}
