import type { CorrectionCardModel } from '../entries/correction-card';
import type { LocalDate } from '../local-date';
import type { WordCardModel } from '../entries/word-card';

/** The card of a Word. */
export interface WordFeedCard {
  readonly kind: 'word';
  /** What the card shows, built by the Core. */
  readonly wordCard: WordCardModel;
  /** On the card of the Word of the Day: the local day it is the Word of. */
  readonly wordOfTheDay?: LocalDate;
}

/** The card of a Correction. */
export interface CorrectionFeedCard {
  readonly kind: 'correction';
  /** What the card shows, built by the Core. */
  readonly correctionCard: CorrectionCardModel;
}

/** The card of an Entry: a Word or a Correction. */
export type EntryFeedCard = WordFeedCard | CorrectionFeedCard;

/**
 * One card of the Feed: an Entry, or the end-of-Cycle card that tells the
 * reader every live Entry is Seen and the next card starts a new Cycle.
 */
export type FeedCard = EntryFeedCard | { readonly kind: 'end-of-cycle' };

/** The id of the Entry a card shows, if it shows one. */
export function entryIdOf(card: EntryFeedCard): string;
export function entryIdOf(card: FeedCard | undefined): string | undefined;
export function entryIdOf(card: FeedCard | undefined): string | undefined {
  if (card?.kind === 'word') return card.wordCard.wordId;
  return card?.kind === 'correction' ? card.correctionCard.correctionId : undefined;
}
