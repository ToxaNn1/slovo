import type { Example } from '@slovo/contracts';

import type { AskableEntry } from '../entries/entries';

/** How many options a Round offers, exactly one of them correct. */
export const ROUND_OPTIONS = 4;

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
  /**
   * The Entry the Round asked about, when the answer names something else:
   * the Word of «Звідки слово», whose origin language is the answer. Left out
   * when the answer is the Entry itself.
   */
  readonly asked?: RoundOption;
}

/** An answer judged: whether it is right, the sheet to show, and the Entry it is about when not the Round's own. */
export interface Judged<Answer> {
  readonly answer: Answer;
  /** The Entry the answer is about, such as the Word tapped in a pairs grid; the Round's own when left out. */
  readonly about?: AskableEntry;
}

/**
 * An Answer Form: one form a Round's answer takes, such as a pick of options
 * or a tap on a vowel. It owns the content a Game Mode builds in it, the Round
 * the reader sees, how a given answer is judged, what the Game Review shows of
 * a wrong answer and how many Rounds and Entries the content spans; the Game
 * keeps only its state machine.
 */
export interface AnswerForm<Content, Shown, Given, Answer> {
  /** Whether the content has exactly one right answer in the form. */
  wellFormed(content: Content): boolean;
  /** How many Rounds of the Game the content spans, such as one per pair of a grid. */
  roundsIn(content: Content): number;
  /** The ids of the Entries the content asks about besides the Round's own. */
  entriesIn(content: Content): readonly string[];
  /** The Round as the reader sees it, its right answer kept out, after the answers given in its earlier Rounds. */
  shown(content: Content, answered: readonly Answer[]): Shown;
  /** The answer judged; nothing when it names something the Round doesn't have. */
  judge(content: Content, shown: Shown, given: Given): Judged<Answer> | undefined;
  /** The reader's wrong answer as the Game Review shows it; nothing when it can't be shown. */
  reviewAnswer(round: Shown & { readonly prompt: string }, answer: Answer): RoundOption | undefined;
}
