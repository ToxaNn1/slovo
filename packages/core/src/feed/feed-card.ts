import type { Knowledge } from '../knowledge/knowledge';
import type { AnyEntryCard } from './entry-feed-card';
import type { FeedNoticeContent } from './feed-notices';
import type { LocalDate } from '../local-date';

export type {
  AnyEntryCard,
  CorrectionFeedCard,
  EntryFeedCard,
  IdiomFeedCard,
  SynonymRowFeedCard,
  TipFeedCard,
  WordFeedCard,
} from './entry-feed-card';

/**
 * The card of a Feed Notice: a Feed card that is not an Entry. It counts in
 * no turn and no Review slot and makes nothing Seen; swiping past it closes
 * it for its local day (ADR 0054).
 */
export type FeedNoticeCard = FeedNoticeContent & {
  readonly kind: 'notice';
  /** The local day the Feed Notice is of. */
  readonly day: LocalDate;
  readonly entryId?: undefined;
  /** A Feed Notice is never a Review. */
  readonly review?: undefined;
};

/**
 * One card of the Feed: an Entry, the end-of-Cycle card that tells the
 * reader every live Entry is Seen and the next card starts a new Cycle, or a
 * Feed Notice. The end-of-Cycle card and a Feed Notice show no Entry, so any
 * card's `entryId` reads undefined there.
 */
export type FeedCard =
  AnyEntryCard | { readonly kind: 'end-of-cycle'; readonly entryId?: undefined } | FeedNoticeCard;

/**
 * The card as a Review, labelled «Повторення», while the Entry's card shows
 * one: wherever it is shown, the Feed and every Entry screen (ADR 0043).
 */
export function asReviewIfDue<Card extends AnyEntryCard>(
  card: Card,
  knowledge: Pick<Knowledge, 'state'>,
): Card {
  return knowledge.state.shown.get(card.entryId) === 'review' ? { ...card, review: true } : card;
}
