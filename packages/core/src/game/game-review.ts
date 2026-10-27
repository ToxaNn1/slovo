import type { Example } from '@slovo/contracts';

import type { PlayedRound, RoundAnswer } from './game-in-play';
import type { FixedChip, RoundOption } from './game-mode';
import { rowWordOption } from './guess-word';
import { renderStress, stressedVowelsOf } from '../entries/stress';

/** What an item of the Game Review expands into, by the kind of the Entry the Round asked about. */
export type GameReviewDetails =
  | {
      readonly kind: 'word' | 'idiom';
      /** The primary Definition. */
      readonly definition: string;
      readonly example: Example | undefined;
      readonly etymology: string | undefined;
    }
  | {
      readonly kind: 'correction';
      /** The standard form the Round's answer named. */
      readonly standardForm: string;
      readonly explanation: string;
    }
  | {
      readonly kind: 'synonymRow';
      /** Every member of the row, in its order, with its Stress. */
      readonly members: readonly RoundOption[];
    }
  | { readonly kind: 'tip'; readonly explanation: string };

/** The reader's answer instead of the right one, with the form it was given in. */
export type GameReviewAnswer = RoundOption & {
  /** How the reader gave it, such as `typed` for the text typed and `pick` for an option chosen. */
  readonly form: RoundAnswer['form'];
};

/**
 * A Round of the Game just over as the Game Review lists it, decided by the
 * Core. The first tap expands the item into its `details`; the second opens
 * the Entry `entryId` (spec #730).
 */
export interface GameReviewItem {
  /** Which Round of the Game it was. */
  readonly number: number;
  /** The Entry the Round asked about, which the second tap opens. */
  readonly entryId: string;
  /**
   * What the item leads with: a Word's Lemma, an idiom's expression, a
   * Correction's non-standard form, a Synonym Row's dominant, or a Tip's
   * title. A Correction's is the form the Round asked about, not the standard
   * equivalent its Entry row leads with; a row's is the Round's prompt.
   */
  readonly title: RoundOption;
  /**
   * The right answer beside the title, when it names something other than
   * the Entry: the origin language of the Word in «Звідки слово». Nothing
   * when the right answer is the Entry itself.
   */
  readonly answer: RoundOption | undefined;
  /** Whether the reader answered right. */
  readonly right: boolean;
  /**
   * The reader's answer instead of the right one, whatever the Round's form:
   * the option picked, the prompt stressed on the vowel tapped, the Definition
   * matched to a pair's Word, the chips tapped in order, or the text typed.
   * Nothing for a Round answered right.
   */
  readonly picked: GameReviewAnswer | undefined;
  readonly details: GameReviewDetails;
}

const plain = (text: string): RoundOption => ({ text, stressedVowels: [] });

function titleOf({ entry, answer }: PlayedRound): RoundOption {
  switch (entry.kind) {
    case 'word':
      return answer.sheet.asked ?? answer.sheet.answer;
    case 'idiom':
      return plain(entry.expression);
    case 'correction':
      return plain(entry.nonStandardForm);
    case 'synonymRow':
      return rowWordOption(entry.dominant);
    case 'tip':
      return plain(entry.title);
  }
}

function detailsOf({ entry, answer }: PlayedRound): GameReviewDetails {
  switch (entry.kind) {
    case 'word':
    case 'idiom':
      return {
        kind: entry.kind,
        definition: entry.primaryDefinition,
        example: entry.examples[0],
        etymology: entry.etymology,
      };
    case 'correction':
      return {
        kind: 'correction',
        standardForm: answer.sheet.answer.text,
        explanation: entry.explanation,
      };
    case 'synonymRow':
      return { kind: 'synonymRow', members: entry.members.map(rowWordOption) };
    case 'tip':
      return { kind: 'tip', explanation: entry.explanation };
  }
}

/** A chip that is one character, such as a letter of «Анаграми»; the words of «Склади вислів» are longer. */
const isLetter = (chip: string) => Array.from(chip).length === 1;

/** The letters tapped as one Word, each character that stays in place before the chip it precedes. */
const lettersJoined = (tapped: readonly string[], fixed: readonly FixedChip[] = []) =>
  tapped
    .map(
      (letter, place) =>
        fixed.flatMap(({ at, text }) => (at === place ? [text] : [])).join('') + letter,
    )
    .join('');

/**
 * The reader's answer instead of the right one, in the Round's form; nothing
 * on a right answer. Letter chips join into one Word, the characters that
 * stay in place among them, word chips with spaces.
 */
function pickedOf(round: PlayedRound): GameReviewAnswer | undefined {
  const option = pickedOptionOf(round);
  return option === undefined ? undefined : { ...option, form: round.answer.form };
}

function pickedOptionOf(round: PlayedRound): RoundOption | undefined {
  if (round.right) return undefined;
  const { answer } = round;
  switch (answer.form) {
    case 'pick':
      return round.form === 'pick' ? round.options[answer.chosen] : undefined;
    case 'vowel': {
      const tapped = { lemma: round.prompt, stress: [answer.chosen] };
      return { text: renderStress(tapped), stressedVowels: stressedVowelsOf(tapped) };
    }
    case 'pairs': {
      const cell = round.form === 'pairs' ? round.definitions[answer.definition] : undefined;
      return cell === undefined ? undefined : plain(cell.shown);
    }
    case 'chips': {
      if (round.form !== 'chips') return undefined;
      const tapped = answer.chosen.flatMap((place) => round.chips[place] ?? []);
      return plain(tapped.every(isLetter) ? lettersJoined(tapped, round.fixed) : tapped.join(' '));
    }
    case 'typed':
      return plain(answer.typed.trim());
  }
}

/** The Game Review of the Rounds played: one item for each, in their order. */
export function buildGameReview(rounds: readonly PlayedRound[]): GameReviewItem[] {
  return rounds.map((round) => ({
    number: round.number,
    entryId: round.entry.id,
    title: titleOf(round),
    answer: round.answer.sheet.asked === undefined ? undefined : round.answer.sheet.answer,
    right: round.right,
    picked: pickedOf(round),
    details: detailsOf(round),
  }));
}
