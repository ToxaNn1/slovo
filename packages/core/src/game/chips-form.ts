import type { AnswerForm, AnswerSheet, RoundOption } from './answer-form';

/** What a chips Round's chips are: a Word's letters or an expression's words. */
export type ChipKind = 'letter' | 'word';

/** A character of a chips answer that stays in place and is no chip, such as an apostrophe. */
export interface FixedChip {
  /** How many chips the answer has before it. */
  readonly at: number;
  readonly text: string;
}

/** The content of a chips Round as a Game Mode builds it. */
export interface ChipsContent {
  readonly form: 'chips';
  /** What the chips are, a Word's letters or an expression's words. */
  readonly chipKind: ChipKind;
  /** The chips, in the order shown. */
  readonly chips: readonly string[];
  /** The chips in the right order; equal chips are interchangeable. */
  readonly expected: readonly string[];
  /** The characters of the answer that stay in place among the chips; none when left out. */
  readonly fixed?: readonly FixedChip[];
  readonly sheet: AnswerSheet;
}

/** A chips Round as the reader sees it. */
export interface ChipsRound {
  readonly form: 'chips';
  /** What the chips are, a Word's letters or an expression's words. */
  readonly chipKind: ChipKind;
  readonly chips: readonly string[];
  /** The characters of the answer that stay in place among the chips. */
  readonly fixed: readonly FixedChip[];
}

/** The chips the reader taps. */
export interface ChipsGiven {
  readonly form: 'chips';
  /** The places of the chips tapped, in the order tapped. */
  readonly chips: readonly number[];
}

/** Chips tapped, judged. */
export interface ChipsAnswer {
  readonly form: 'chips';
  /** The places of the chips tapped, in the order tapped. */
  readonly chosen: readonly number[];
  /** The chips in the right order. */
  readonly expected: readonly string[];
  readonly right: boolean;
  readonly sheet: AnswerSheet;
}

/** Whether the chips stand in the right order, equal chips interchangeable and case ignored. */
export const chipsMatch = (chips: readonly string[], right: readonly string[]): boolean =>
  chips.length === right.length &&
  chips.every((chip, place) => chip.toLowerCase() === right[place]?.toLowerCase());

/**
 * The chips of a shuffle, never in the right order: when the shuffle left
 * them so, they move one place on, which leaves chips of at least two
 * different texts out of order.
 */
export const outOfOrder = (
  right: readonly string[],
  chips: readonly string[],
): readonly string[] =>
  chipsMatch(chips, right) ? [...chips.slice(1), ...chips.slice(0, 1)] : chips;

/** A chip that is one character, such as a letter of «Анаграми»; the words of «Склади вислів» are longer. */
const isLetter = (chip: string) => Array.from(chip).length === 1;

/** The letters tapped as one Word, each character that stays in place before the chip it precedes. */
const lettersJoined = (tapped: readonly string[], fixed: readonly FixedChip[]) =>
  tapped
    .map(
      (letter, place) =>
        fixed.flatMap(({ at, text }) => (at === place ? [text] : [])).join('') + letter,
    )
    .join('');

/** The chips tapped in order: the answer's chips, reordered, are right. */
export const chipsForm: AnswerForm<ChipsContent, ChipsRound, ChipsGiven, ChipsAnswer> = {
  wellFormed: ({ chips, expected }) =>
    chips.length > 0 && [...chips].sort().join('\u0000') === [...expected].sort().join('\u0000'),
  roundsIn: () => 1,
  entriesIn: () => [],
  shown: ({ chipKind, chips, fixed = [] }) => ({ form: 'chips', chipKind, chips, fixed }),
  judge({ chips, expected, sheet }, _shown, { chips: chosen }) {
    const tapped: string[] = [];
    for (const place of chosen) {
      const chip = chips[place];
      if (chip === undefined) return undefined;
      tapped.push(chip);
    }
    return {
      answer: { form: 'chips', chosen, expected, right: chipsMatch(tapped, expected), sheet },
    };
  },
  reviewAnswer({ chips, fixed }, { chosen }): RoundOption {
    const tapped = chosen.flatMap((place) => chips[place] ?? []);
    const text = tapped.every(isLetter) ? lettersJoined(tapped, fixed) : tapped.join(' ');
    return { text, stressedVowels: [] };
  },
};
