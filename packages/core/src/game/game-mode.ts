import type { Example, LanguageTraits } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { AskableEntry, AskableKind, KindRefusal, ShownKind } from '../entries/entries';
import type { Random } from '../ports';

/** How many options a Round offers, exactly one of them correct. */
export const ROUND_OPTIONS = 4;

/** What the Game needs to know of the Edition: its Feature Switches and its Distractor rule. */
export type GameEdition = Pick<Edition, 'isFeatureEnabled'> & {
  readonly languageTraits: Pick<LanguageTraits, 'distractorRule'>;
};

/** One option of a Round, or the answer its sheet names. */
export interface RoundOption {
  /** The text as shown, such as a Lemma with its Stress marks. */
  readonly text: string;
  /** The stressed vowels of the text, in order, which VoiceOver names; empty without Stress. */
  readonly stressedVowels: readonly string[];
}

/**
 * What the sheet after an answer shows: the right answer, and an Example of
 * it or an explanation of why it is right, if any.
 */
export interface AnswerSheet {
  readonly answer: RoundOption;
  readonly example: Example | undefined;
  /** Why the answer is right, such as a Correction's explanation. */
  readonly explanation?: string;
}

/** A stretch of a text, from the character at `start` up to the one at `end`, which it leaves out. */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

/** A Word of a pairs grid with its Definition: one Round of the grid. */
export interface GridPair {
  /** The Entry the pair asks about, marked Unknown on a wrong match. */
  readonly entry: AskableEntry;
  readonly word: RoundOption;
  readonly definition: string;
  readonly sheet: AnswerSheet;
}

/**
 * The form of a Round's answer, which the Game Mode decides (ADR 0052): a
 * pick of options, a tap on a vowel, a pair in a pairs grid, chips tapped in
 * order, or typed text. Each form but the pairs grid carries the sheet shown
 * after the answer; a grid carries one per pair.
 */
export type RoundForm =
  | {
      readonly form: 'pick';
      /** The `ROUND_OPTIONS` options, in the order shown. */
      readonly options: readonly RoundOption[];
      /** The place of the right option among them. */
      readonly correct: number;
      readonly sheet: AnswerSheet;
    }
  | {
      readonly form: 'vowel';
      /** Where in the prompt each vowel to tap stands, in order. */
      readonly vowels: readonly number[];
      /** The vowels among them that are stressed, any of which is right. */
      readonly stressed: readonly number[];
      readonly sheet: AnswerSheet;
    }
  | {
      readonly form: 'pairs';
      /** Up to `ROUND_OPTIONS` pairs, each a Round of its own. */
      readonly pairs: readonly GridPair[];
      /** The places of the pairs whose Words show, in the order shown. */
      readonly wordOrder: readonly number[];
      /** The places of the pairs whose Definitions show, in the order shown. */
      readonly definitionOrder: readonly number[];
    }
  | {
      readonly form: 'chips';
      /** The chips, in the order shown. */
      readonly chips: readonly string[];
      /** The chips in the right order; equal chips are interchangeable. */
      readonly expected: readonly string[];
      readonly sheet: AnswerSheet;
    }
  | {
      readonly form: 'typed';
      /** The text to type, compared the way `typedAnswerMatches` does. */
      readonly expected: string;
      readonly sheet: AnswerSheet;
    };

/** A Round as a Game Mode builds it: one prompt with exactly one right answer, in the mode's answer form. */
export type RoundContent = RoundForm & {
  /** What the Round asks, such as a Definition; nothing for a pairs grid. */
  readonly prompt: string;
  /** The part of the prompt to mark, such as a non-standard form in a sentence; nothing to mark when left out. */
  readonly highlight?: TextRange;
};

/** How many Rounds the content holds: one, or one per pair of a pairs grid. */
export const roundsIn = (content: RoundContent): number =>
  content.form === 'pairs' ? content.pairs.length : 1;

/** The ids of the Entries a pairs grid asks about besides the Round's own; none in another form. */
export const entriesIn = (content: RoundContent): string[] =>
  content.form === 'pairs' ? content.pairs.map(({ entry }) => entry.id) : [];

/** What a Game Mode builds a Round from. */
export interface RoundInput {
  /** The Entry the Round asks about, of the mode's kind. */
  readonly answer: AskableEntry;
  /** Every eligible Entry of the kinds the mode asks about, the answer among them: where Distractors come from. */
  readonly eligible: readonly AskableEntry[];
  /**
   * The eligible Entries the Game would ask about after the answer, in
   * order, none of them asked yet: where a pairs grid takes its other pairs from.
   */
  readonly next: readonly AskableEntry[];
  /** How many Rounds the content may hold at most, such as the pairs of a grid: the Rounds the Game still plans. */
  readonly upTo: number;
  /** The source of every shuffle. */
  readonly random: Random;
  readonly edition: GameEdition;
}

/**
 * A Game Mode, registered through the Core's Extension Point (ADR 0006): the
 * Core's own modes and those an Edition adds are values of this one shape.
 */
export interface GameMode {
  /** Unique among the modes, such as `guess-word`. */
  readonly id: string;
  /** The kind of Entry its Rounds ask about, which its card names and whose refusal it gives. */
  readonly entryKind: ShownKind;
  /**
   * Other kinds of Entry its Rounds may ask about, such as idioms and
   * Synonym Rows in «Вгадай слово»; a kind with no eligible Entry, such as
   * Idioms out of the Mix, leaves the mode asking about the rest.
   */
  readonly alsoAsks?: readonly AskableKind[];
  /**
   * The Lives a Game in the mode starts with: `GAME_LIVES` when left out,
   * or none, so that a mistake never ends the Game.
   */
  readonly lives?: number | 'none';
  /**
   * How many Rounds a Game in the mode has, which it also needs eligible
   * Entries for: `GAME_ROUNDS` when left out, or none, so that the Game goes
   * on until its Lives run out or the mode has no Round left.
   */
  readonly roundLimit?: number | 'none';
  /** Whether the Edition turns the mode on; a mode that is off is never on offer. */
  isOn(edition: GameEdition): boolean;
  /**
   * The Round that asks about the answer, its options shuffled by the random
   * source; nothing when no fair Round can be made of the eligible Entries.
   */
  buildRound(input: RoundInput): RoundContent | undefined;
}

/**
 * Why a Game Mode can't start: too few eligible Entries of its kind to make 15
 * fair Rounds of, or why no Entry of its kind is eligible, such as Corrections
 * out of the Mix.
 */
export type GameModeRefusal = 'too-few-entries' | KindRefusal;

/** The items in an order drawn from the random source. */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const order = [...items];
  for (let last = order.length - 1; last > 0; last -= 1) {
    const other = Math.floor(random.next() * (last + 1));
    [order[last], order[other]] = [order[other] as T, order[last] as T];
  }
  return order;
}
