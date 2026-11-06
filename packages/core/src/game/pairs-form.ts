import type { AskableEntry } from '../entries/entries';
import { ROUND_OPTIONS, type AnswerForm, type AnswerSheet, type RoundOption } from './answer-form';

/** A Word of a pairs grid with its Definition: one Round of the grid. */
export interface GridPair {
  /** The Entry the pair asks about, marked Unknown on a wrong match. */
  readonly entry: AskableEntry;
  readonly word: RoundOption;
  readonly definition: string;
  readonly sheet: AnswerSheet;
}

/** The content of a pairs grid as a Game Mode builds it; it carries one sheet per pair. */
export interface PairsContent {
  readonly form: 'pairs';
  /** Up to `ROUND_OPTIONS` pairs, each a Round of its own. */
  readonly pairs: readonly GridPair[];
  /** The places of the pairs whose Words show, in the order shown. */
  readonly wordOrder: readonly number[];
  /** The places of the pairs whose Definitions show, in the order shown. */
  readonly definitionOrder: readonly number[];
}

/** A cell of a pairs grid as the reader sees it: a Word or a Definition; one of a pair answered is gone. */
export interface GridCell<T> {
  readonly shown: T;
  readonly gone: boolean;
}

/** A pairs grid as the reader sees it. */
export interface PairsRound {
  readonly form: 'pairs';
  /** The grid's Words in the order shown, then its Definitions; a pair answered is gone from both. */
  readonly words: readonly GridCell<RoundOption>[];
  readonly definitions: readonly GridCell<string>[];
}

/** The Word and the Definition the reader taps. */
export interface PairsGiven {
  readonly form: 'pairs';
  /** The place of the Word tapped among the grid's Words, then of the Definition among its Definitions. */
  readonly word: number;
  readonly definition: number;
}

/** A Word and a Definition tapped, judged. */
export interface PairsAnswer {
  readonly form: 'pairs';
  /** The place of the Word tapped among the grid's Words, then of the Definition among its Definitions. */
  readonly word: number;
  readonly definition: number;
  /** The place of the Word's own Definition. */
  readonly correct: number;
  readonly right: boolean;
  readonly sheet: AnswerSheet;
}

/** The places of the pairs, sorted, as an order of them names them. */
const sortedPlaces = (order: readonly number[]) => [...order].sort().join();

/**
 * A Word matched with a Definition in a grid of pairs: each pair is a Round
 * of its own, the Word tapped the Entry it is about, and a pair answered,
 * right or wrong, is gone from the grid.
 */
export const pairsForm: AnswerForm<PairsContent, PairsRound, PairsGiven, PairsAnswer> = {
  wellFormed({ pairs, wordOrder, definitionOrder }) {
    const places = sortedPlaces(pairs.map((_, place) => place));
    return (
      pairs.length > 0 &&
      pairs.length <= ROUND_OPTIONS &&
      sortedPlaces(wordOrder) === places &&
      sortedPlaces(definitionOrder) === places
    );
  },
  roundsIn: ({ pairs }) => pairs.length,
  entriesIn: ({ pairs }) => pairs.map(({ entry }) => entry.id),
  shown({ pairs, wordOrder, definitionOrder }, answered) {
    const goneWords = new Set(answered.map(({ word }) => word));
    const goneDefinitions = new Set(answered.map(({ correct }) => correct));
    const pairAt = (place: number) => {
      const pair = pairs[place];
      if (pair === undefined) throw new Error(`The pairs grid has no pair at ${String(place)}`);
      return pair;
    };
    return {
      form: 'pairs',
      words: wordOrder.map((pair, place) => ({
        shown: pairAt(pair).word,
        gone: goneWords.has(place),
      })),
      definitions: definitionOrder.map((pair, place) => ({
        shown: pairAt(pair).definition,
        gone: goneDefinitions.has(place),
      })),
    };
  },
  judge({ pairs, wordOrder, definitionOrder }, { words, definitions }, { word, definition }) {
    const wordCell = words[word];
    const definitionCell = definitions[definition];
    if (wordCell === undefined || definitionCell === undefined) return undefined;
    if (wordCell.gone || definitionCell.gone) return undefined;
    const pairPlace = wordOrder[word];
    const pair = pairPlace === undefined ? undefined : pairs[pairPlace];
    if (pairPlace === undefined || pair === undefined) return undefined;
    const correct = definitionOrder.indexOf(pairPlace);
    return {
      about: pair.entry,
      answer: {
        form: 'pairs',
        word,
        definition,
        correct,
        right: definition === correct,
        sheet: pair.sheet,
      },
    };
  },
  reviewAnswer({ definitions }, { definition }) {
    const cell = definitions[definition];
    return cell === undefined ? undefined : { text: cell.shown, stressedVowels: [] };
  },
};
