import type { AnswerForm, AnswerSheet } from './answer-form';
import { typedAnswerMatches } from './typed-answer';

/** The content of a typed Round as a Game Mode builds it. */
export interface TypedContent {
  readonly form: 'typed';
  /** The text to type, compared the way `typedAnswerMatches` does. */
  readonly expected: string;
  /**
   * Whether the text shows as blanks, one per character, which «Відкрити
   * літеру» opens; the places of the characters that stay in place, such
   * as an apostrophe, show them from the start. No blanks when left out.
   */
  readonly blanks?: { readonly inPlace: readonly number[] };
  readonly sheet: AnswerSheet;
}

/**
 * One character of a typed Round's text shown as blanks: a mark that stays in
 * place, such as an apostrophe, a letter «Відкрити літеру» opened, or a blank
 * with no letter yet.
 */
export type RoundBlank = { readonly mark: string } | { readonly letter?: string };

/** A typed Round as the reader sees it. */
export interface TypedRound {
  readonly form: 'typed';
  /** The text to type as blanks, one per character; no blanks in a Round that shows none. */
  readonly blanks: readonly RoundBlank[] | undefined;
  /** Whether «Відкрити літеру» opens a letter: while more than one blank is left. */
  readonly canOpenLetter: boolean;
}

/** The text the reader types. */
export interface TypedGiven {
  readonly form: 'typed';
  readonly text: string;
}

/** Text typed, judged. */
export interface TypedAnswer {
  readonly form: 'typed';
  readonly typed: string;
  /** The text to type. */
  readonly expected: string;
  readonly right: boolean;
  readonly sheet: AnswerSheet;
}

/** Whether a blank shows no letter or mark yet. */
const isEmpty = (blank: RoundBlank) => !('mark' in blank) && blank.letter === undefined;

/** Whether more than one blank is left, so that «Відкрити літеру» may open one. */
const canOpenLetterIn = (blanks: readonly RoundBlank[] | undefined) =>
  blanks !== undefined && blanks.filter(isEmpty).length > 1;

/** The typed text: any text that compares as the answer is right. */
export const typedForm: AnswerForm<TypedContent, TypedRound, TypedGiven, TypedAnswer> & {
  /**
   * The Round with «Відкрити літеру»: its first blank opened, at no cost.
   * Nothing unless more than one blank is left.
   */
  openLetter(content: TypedContent, shown: TypedRound): TypedRound | undefined;
} = {
  wellFormed: ({ expected }) => expected.length > 0,
  roundsIn: () => 1,
  entriesIn: () => [],
  shown({ expected, blanks: shownAs }) {
    const inPlace = shownAs?.inPlace;
    const blanks =
      inPlace &&
      Array.from(expected, (character, place): RoundBlank =>
        inPlace.includes(place) ? { mark: character } : {},
      );
    return { form: 'typed', blanks, canOpenLetter: canOpenLetterIn(blanks) };
  },
  judge({ expected, sheet }, _shown, { text }) {
    return {
      answer: {
        form: 'typed',
        typed: text,
        expected,
        right: typedAnswerMatches(text, expected),
        sheet,
      },
    };
  },
  reviewAnswer: (_round, { typed }) => ({ text: typed.trim(), stressedVowels: [] }),
  openLetter({ expected }, shown) {
    if (!shown.canOpenLetter) return undefined;
    const letters = Array.from(expected);
    const first = shown.blanks?.findIndex(isEmpty) ?? -1;
    const opened = letters[first];
    const blanks = shown.blanks?.map((blank, place) =>
      place === first && opened !== undefined ? { letter: opened } : blank,
    );
    return { form: 'typed', blanks, canOpenLetter: canOpenLetterIn(blanks) };
  },
};
