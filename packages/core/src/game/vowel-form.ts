import type { AnswerForm, AnswerSheet } from './answer-form';
import { renderStress, stressedVowelsOf } from '../entries/stress';

/** The content of a vowel Round as a Game Mode builds it. */
export interface VowelContent {
  readonly form: 'vowel';
  /** Where in the prompt each vowel to tap stands, in order. */
  readonly vowels: readonly number[];
  /** The vowels among them that are stressed, any of which is right. */
  readonly stressed: readonly number[];
  readonly sheet: AnswerSheet;
}

/** A vowel Round as the reader sees it. */
export interface VowelRound {
  readonly form: 'vowel';
  readonly vowels: readonly number[];
}

/** The vowel the reader taps. */
export interface VowelGiven {
  readonly form: 'vowel';
  /** Where in the prompt the vowel tapped stands. */
  readonly position: number;
}

/** A vowel tapped, judged. */
export interface VowelAnswer {
  readonly form: 'vowel';
  /** Where in the prompt the vowel tapped stands. */
  readonly chosen: number;
  /** Where the stressed vowels stand. */
  readonly stressed: readonly number[];
  readonly right: boolean;
  readonly sheet: AnswerSheet;
}

/** The tap on a vowel: any stressed vowel of the prompt is right. */
export const vowelForm: AnswerForm<VowelContent, VowelRound, VowelGiven, VowelAnswer> = {
  wellFormed: ({ vowels, stressed }) =>
    stressed.length > 0 && stressed.every((vowel) => vowels.includes(vowel)),
  roundsIn: () => 1,
  entriesIn: () => [],
  shown: ({ vowels }) => ({ form: 'vowel', vowels }),
  judge({ vowels, stressed, sheet }, _shown, { position: chosen }) {
    if (!vowels.includes(chosen)) return undefined;
    return {
      answer: { form: 'vowel', chosen, stressed, right: stressed.includes(chosen), sheet },
    };
  },
  reviewAnswer({ prompt }, { chosen }) {
    const tapped = { lemma: prompt, stress: [chosen] };
    return { text: renderStress(tapped), stressedVowels: stressedVowelsOf(tapped) };
  },
};
