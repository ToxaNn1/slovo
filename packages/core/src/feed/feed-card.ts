import type { Knowledge } from '../knowledge/knowledge';
import type { CorrectionCardModel } from '../entries/correction-card';
import type { FeedNoticeContent } from './feed-notices';
import type { IdiomCardModel } from '../entries/idiom-card';
import type { LocalDate } from '../local-date';
import type { SynonymRowCardModel } from '../entries/synonym-row-card';
import type { TipCardModel } from '../entries/tip-card';
import type { WordCardModel } from '../entries/word-card';

/** What every card of an Entry carries, whatever its kind. */
interface EntryFeedCardOf<Kind extends string, Model> {
  readonly kind: Kind;
  /** The id of the Entry the card shows. */
  readonly entryId: string;
  /** What the card shows, built by the Core. */
  readonly model: Model;
  /** On the card of an Entry due for Review as the card was made, labelled «Повторення». */
  readonly review?: true;
}

/** The card of a Word. */
export interface WordFeedCard extends EntryFeedCardOf<'word', WordCardModel> {
  /** On the card of the Word of the Day: the local day it is the Word of. */
  readonly wordOfTheDay?: LocalDate;
}

/** The card of a Correction. */
export type CorrectionFeedCard = EntryFeedCardOf<'correction', CorrectionCardModel>;

/** The card of an Idiom. */
export type IdiomFeedCard = EntryFeedCardOf<'idiom', IdiomCardModel>;

/** The card of an Entry of a kind the screens show: a Word, a Correction or an Idiom. */
export type EntryFeedCard = WordFeedCard | CorrectionFeedCard | IdiomFeedCard;

/** The card of a Synonym Row. */
export type SynonymRowFeedCard = EntryFeedCardOf<'synonymRow', SynonymRowCardModel>;

/** The card of a Tip. */
export type TipFeedCard = EntryFeedCardOf<'tip', TipCardModel>;

/**
 * The card of an Entry of any kind: those the screens show, a Synonym Row's
 * and a Tip's, which the Feed and the Entry screen a list opens show (spec #730).
 */
export type AnyEntryCard = EntryFeedCard | SynonymRowFeedCard | TipFeedCard;

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
