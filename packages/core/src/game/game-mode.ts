import type { LanguageTraits } from '@slovo/contracts';

import type { RoundForm } from './answer-forms';
import type { Edition } from '../edition/edition';
import type { AskableEntry, AskableKind, KindRefusal, ShownKind } from '../entries/entries';
import type { Random } from '../ports';

export { ROUND_OPTIONS, type AnswerSheet, type RoundOption } from './answer-form';
export type { ChipKind, ChipLayout, FixedChip } from './chips-form';

/**
 * What the Game needs to know of the Edition: its Feature Switches, whether
 * it marks Stress and on which vowels, the punctuation an Idiom's expression
 * may hold, its alphabet, where letter tiles' decoys come from, and the
 * languages Words come from; an Edition that leaves the last out has no
 * origin languages.
 */
export type GameEdition = Pick<Edition, 'isFeatureEnabled'> &
  Partial<Pick<Edition, 'originLanguages'>> & {
    readonly languageTraits: Pick<LanguageTraits, 'stress' | 'expressionPunctuation' | 'alphabet'>;
  };

/**
 * The groups of the mode screen, in their agreed order: what a mode trains,
 * then the modes with a Lives, Round or time challenge of their own.
 */
export const GAME_MODE_GROUPS = ['words', 'corrections', 'idioms', 'challenge'] as const;

/** The group of the mode screen a Game Mode's card stands in. */
export type GameModeGroup = (typeof GAME_MODE_GROUPS)[number];

/**
 * Which label a Round shows over its prompt: the Game Mode's, a Synonym
 * Row's question on its dominant, a Tip's, an Example's with a gap, or the
 * Game Mode's over an Entry's own text whose meaning it asks, which the
 * shell asks as the Edition's «{word}» — це… (spec #1674).
 */
export type RoundLabelKind = 'mode' | 'synonymRow' | 'tip' | 'gap' | 'meaning';

/** A stretch of a text, from the character at `start` up to the one at `end`, which it leaves out. */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

/**
 * The form of a Round's answer, which the Game Mode decides (ADR 0052): a
 * pick of options, a tap on a vowel, a pair in a pairs grid, chips tapped in
 * order, or typed text, each its own Answer Form. Each form but the pairs
 * grid carries the sheet shown after the answer; a grid carries one per pair.
 */
export type { RoundForm } from './answer-forms';
export type { GridPair } from './pairs-form';

/** A Round as a Game Mode builds it: one prompt with exactly one right answer, in the mode's answer form. */
export type RoundContent = RoundForm & {
  /** What the Round asks, such as a Definition; nothing for a pairs grid. */
  readonly prompt: string;
  /** The part of the prompt to mark, such as a non-standard form in a sentence; nothing to mark when left out. */
  readonly highlight?: TextRange;
  /**
   * The gap in the prompt: the highlight when it stands for the Lemma in an
   * Example, which the shell labels and reads aloud as a gap; none when left out.
   */
  readonly gap?: TextRange;
  /** Which label the Round shows over its prompt: the Game Mode's when left out. */
  readonly labelKind?: RoundLabelKind;
  /** The Definition shown under the prompt, such as a Word's in «Звідки слово»; none when left out. */
  readonly definition?: string;
};

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
  /** Which Round of the Game the content starts at, from 1, such as a stage of «Вгадай слово». */
  readonly round: number;
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
  /** The group of the mode screen its card stands in. */
  readonly group: GameModeGroup;
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
  /**
   * Whether its Rounds take turns between the kinds of Entry it asks about,
   * so each kind gets about an equal share however many of each are
   * eligible; when left out, the kinds come in no order of their own.
   */
  readonly takesTurns?: boolean;
  /**
   * How long a Game in the mode lasts, in milliseconds of play: it ends when
   * they run out, the time in the background left out. No time limit when
   * left out.
   */
  readonly timeLimit?: number;
  /**
   * Whether an answer moves on to the next Round at once, with no answer
   * sheet and no «Далі»; when left out, the Round waits for «Далі».
   */
  readonly movesOn?: boolean;
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
