import type { Example, LanguageTraits } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { KindRefusal, ShownEntry, ShownKind } from '../entries/entries';
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

/** A Round as a Game Mode builds it: one prompt with four options, exactly one correct. */
export interface RoundContent {
  /** What the Round asks, such as a Definition. */
  readonly prompt: string;
  /** The part of the prompt to mark, such as a non-standard form in a sentence; nothing to mark when left out. */
  readonly highlight?: TextRange;
  /** The four options, in the order shown. */
  readonly options: readonly RoundOption[];
  /** The place of the right option among them. */
  readonly correct: number;
  readonly sheet: AnswerSheet;
}

/** What a Game Mode builds a Round from. */
export interface RoundInput {
  /** The Entry the Round asks about, of the mode's kind. */
  readonly answer: ShownEntry;
  /** Every eligible Entry of the kinds the mode asks about, the answer among them: where Distractors come from. */
  readonly eligible: readonly ShownEntry[];
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
   * Other kinds of Entry its Rounds may ask about, such as idioms in «Вгадай
   * слово»; a kind with no eligible Entry, such as Idioms out of the Mix,
   * leaves the mode asking about the rest.
   */
  readonly alsoAsks?: readonly ShownKind[];
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
