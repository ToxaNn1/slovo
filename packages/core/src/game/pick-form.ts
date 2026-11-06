import { ROUND_OPTIONS, type AnswerForm, type AnswerSheet, type RoundOption } from './answer-form';

/** The content of a pick Round as a Game Mode builds it. */
export interface PickContent {
  readonly form: 'pick';
  /** The `ROUND_OPTIONS` options, in the order shown. */
  readonly options: readonly RoundOption[];
  /** The place of the right option among them. */
  readonly correct: number;
  readonly sheet: AnswerSheet;
}

/** A pick Round as the reader sees it. */
export interface PickRound {
  readonly form: 'pick';
  readonly options: readonly RoundOption[];
}

/** The option the reader picks. */
export interface PickGiven {
  readonly form: 'pick';
  readonly option: number;
}

/** A pick answered, judged. */
export interface PickAnswer {
  readonly form: 'pick';
  /** The place of the option the reader chose. */
  readonly chosen: number;
  /** The place of the right option. */
  readonly correct: number;
  readonly right: boolean;
  readonly sheet: AnswerSheet;
}

/** The pick of options: one of `ROUND_OPTIONS` is right. */
export const pickForm: AnswerForm<PickContent, PickRound, PickGiven, PickAnswer> = {
  wellFormed: ({ options, correct }) =>
    options.length === ROUND_OPTIONS && options[correct] !== undefined,
  roundsIn: () => 1,
  entriesIn: () => [],
  shown: ({ options }) => ({ form: 'pick', options }),
  judge({ options, correct, sheet }, _shown, { option: chosen }) {
    if (options[chosen] === undefined) return undefined;
    return { answer: { form: 'pick', chosen, correct, right: chosen === correct, sheet } };
  },
  reviewAnswer: ({ options }, { chosen }) => options[chosen],
};
