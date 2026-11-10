import type { AnswerForm, AnswerSheet, RoundOption } from './answer-form';
import type { TextComparison } from '../text/text-comparison';

/** What a chips Round's chips are: a Word's letters or an expression's words. */
export type ChipKind = 'letter' | 'word';

/**
 * How a chips Round lays out its chips: in a line of places, one for each
 * chip, or as board 07's letter tiles in 4 columns under red slots, decoys
 * among them, one slot for each letter of the answer.
 */
export type ChipLayout = 'line' | 'tiles';

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
  /** The chips, in the order shown: the answer's, plus decoys for letter tiles. */
  readonly chips: readonly string[];
  /** The chips in the right order, drawn from the chips; equal chips are interchangeable. */
  readonly expected: readonly string[];
  /** How the chips are laid out: in a line when left out. */
  readonly layout?: ChipLayout;
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
  readonly layout: ChipLayout;
  /** How many chips the answer takes: every chip but the decoys. */
  readonly slots: number;
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

/**
 * Whether the chips stand in the right order, chips with the same Comparison
 * Key as a typed answer interchangeable.
 */
const chipsMatch = (
  chips: readonly string[],
  right: readonly string[],
  comparison: TextComparison,
): boolean =>
  chips.length === right.length &&
  chips.every(
    (chip, place) =>
      right[place] !== undefined && comparison.same(chip, right[place], 'typedAnswer'),
  );

/**
 * The chips of a shuffle, never starting in the right order: when the
 * shuffle left the first chips, as many as the answer has, so, every chip
 * moves one place on, which leaves chips of at least two different texts out
 * of order. Decoys after the answer's chips count as chips too.
 */
export const outOfOrder = (
  right: readonly string[],
  chips: readonly string[],
  comparison: TextComparison,
): readonly string[] =>
  chipsMatch(chips.slice(0, right.length), right, comparison)
    ? [...chips.slice(1), ...chips.slice(0, 1)]
    : chips;

/** Whether every chip of the answer is drawn from the chips, each chip at most once. */
const drawnFrom = (chips: readonly string[], expected: readonly string[]): boolean => {
  const left = [...chips];
  return expected.every((chip) => {
    const place = left.indexOf(chip);
    if (place < 0) return false;
    left.splice(place, 1);
    return true;
  });
};

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
  wellFormed: ({ chips, expected, layout = 'line' }) =>
    expected.length > 0 &&
    drawnFrom(chips, expected) &&
    (layout === 'tiles' || chips.length === expected.length),
  roundsIn: () => 1,
  entriesIn: () => [],
  shown: ({ chipKind, chips, expected, fixed = [], layout = 'line' }) => ({
    form: 'chips',
    chipKind,
    chips,
    fixed,
    layout,
    slots: expected.length,
  }),
  judge({ chips, expected, sheet }, _shown, { chips: chosen }, comparison) {
    const tapped: string[] = [];
    for (const place of chosen) {
      const chip = chips[place];
      if (chip === undefined) return undefined;
      tapped.push(chip);
    }
    return {
      answer: {
        form: 'chips',
        chosen,
        expected,
        right: chipsMatch(tapped, expected, comparison),
        sheet,
      },
    };
  },
  reviewAnswer({ chips, fixed }, { chosen }): RoundOption {
    const tapped = chosen.flatMap((place) => chips[place] ?? []);
    const text = tapped.every(isLetter) ? lettersJoined(tapped, fixed) : tapped.join(' ');
    return { text, stressedVowels: [] };
  },
};
