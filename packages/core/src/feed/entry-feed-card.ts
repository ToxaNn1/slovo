import type { CorrectionCardModel } from '../entries/correction-card';
import type { IdiomCardModel } from '../entries/idiom-card';
import type { SynonymRowCardModel } from '../entries/synonym-row-card';
import type { TipCardModel } from '../entries/tip-card';
import type { WordCardModel } from '../entries/word-card';
import type { LocalDate } from '../local-date';

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
