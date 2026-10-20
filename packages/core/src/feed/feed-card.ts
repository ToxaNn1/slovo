import type { Knowledge } from '../knowledge/knowledge';
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
  /** On the card of an Entry due for Review as the card was made, labelled «Повторення». */
  readonly review?: true;
}

/** The card of a Correction. */
export interface CorrectionFeedCard {
  readonly kind: 'correction';
  /** What the card shows, built by the Core. */
  readonly correctionCard: CorrectionCardModel;
  /** On the card of an Entry due for Review as the card was made, labelled «Повторення». */
  readonly review?: true;
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

/**
 * The card as a Review, labelled «Повторення», while the Entry's card shows
 * one: wherever it is shown, the Feed and every Entry screen (ADR 0043).
 */
export function asReviewIfDue<Card extends EntryFeedCard>(
  card: Card,
  knowledge: Pick<Knowledge, 'state'>,
): Card {
  return knowledge.state.shown.get(entryIdOf(card)) === 'review' ? { ...card, review: true } : card;
}
