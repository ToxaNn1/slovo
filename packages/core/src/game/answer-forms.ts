import type { AskableEntry } from '../entries/entries';
import type { TextComparison } from '../text/text-comparison';
import type { AnswerForm, Judged, RoundOption } from './answer-form';
import {
  chipsForm,
  type ChipsAnswer,
  type ChipsContent,
  type ChipsGiven,
  type ChipsRound,
} from './chips-form';
import {
  pairsForm,
  type PairsAnswer,
  type PairsContent,
  type PairsGiven,
  type PairsRound,
} from './pairs-form';
import {
  pickForm,
  type PickAnswer,
  type PickContent,
  type PickGiven,
  type PickRound,
} from './pick-form';
import {
  typedForm,
  type TypedAnswer,
  type TypedContent,
  type TypedGiven,
  type TypedRound,
} from './typed-form';
import {
  vowelForm,
  type VowelAnswer,
  type VowelContent,
  type VowelGiven,
  type VowelRound,
} from './vowel-form';

/** The parts of each Answer Form, by its name: its content, its Round as shown, the answer given and the answer judged. */
interface FormParts {
  pick: { content: PickContent; shown: PickRound; given: PickGiven; answer: PickAnswer };
  vowel: { content: VowelContent; shown: VowelRound; given: VowelGiven; answer: VowelAnswer };
  pairs: { content: PairsContent; shown: PairsRound; given: PairsGiven; answer: PairsAnswer };
  chips: { content: ChipsContent; shown: ChipsRound; given: ChipsGiven; answer: ChipsAnswer };
  typed: { content: TypedContent; shown: TypedRound; given: TypedGiven; answer: TypedAnswer };
}

/** The name of an Answer Form, which its content, Round and answers carry as `form`. */
type FormName = keyof FormParts;

type FormOf<F extends FormName> = AnswerForm<
  FormParts[F]['content'],
  FormParts[F]['shown'],
  FormParts[F]['given'],
  FormParts[F]['answer']
>;

/** Every Answer Form, by its name. */
const answerForms: { [F in FormName]: FormOf<F> } = {
  pick: pickForm,
  vowel: vowelForm,
  pairs: pairsForm,
  chips: chipsForm,
  typed: typedForm,
};

const formOf = <F extends FormName>(name: F): FormOf<F> => answerForms[name];

/** The content of a Round as a Game Mode builds it, in any Answer Form. */
export type RoundForm = FormParts[FormName]['content'];
/** A Round as the reader sees it, in any Answer Form. */
export type ShownRound = FormParts[FormName]['shown'];
/** The answer the reader gives a Round, in the Round's form. */
export type GivenAnswer = FormParts[FormName]['given'];
/** The answer given to a Round, judged: whether it is right, and the sheet to show. */
export type RoundAnswer = FormParts[FormName]['answer'];

/** Whether the Round as a Game Mode built it has exactly one right answer in its form. */
export const wellFormed = (content: RoundForm): boolean => formOf(content.form).wellFormed(content);

/** How many Rounds the content holds: one, or one per pair of a pairs grid. */
export const roundsIn = (content: RoundForm): number => formOf(content.form).roundsIn(content);

/** The ids of the Entries the content asks about besides the Round's own, such as a grid's pairs. */
export const entriesIn = (content: RoundForm): readonly string[] =>
  formOf(content.form).entriesIn(content);

/** The Round as the reader sees it, its right answer kept out, after the answers given in its earlier Rounds. */
export function shownRound(content: RoundForm, answered: readonly RoundAnswer[]): ShownRound {
  const { form } = content;
  return formOf(form).shown(
    content,
    answered.filter((answer) => answer.form === form),
  );
}

/**
 * The answer judged against the Round's content, with the Entry it asked
 * about: the Round's own unless the form names another. Nothing when the
 * Round or the answer is of another form, or the answer names something the
 * Round doesn't have, such as a pair already gone.
 */
export function judge(
  content: RoundForm,
  shown: ShownRound,
  given: GivenAnswer,
  own: AskableEntry,
  comparison: TextComparison,
): { answer: RoundAnswer; entry: AskableEntry } | undefined {
  if (shown.form !== content.form || given.form !== content.form) return undefined;
  const judgement: Judged<RoundAnswer> | undefined = formOf(content.form).judge(
    content,
    shown,
    given,
    comparison,
  );
  return judgement && { answer: judgement.answer, entry: judgement.about ?? own };
}

/** The reader's answer as the Game Review shows it; nothing when the Round is of another form or it can't be shown. */
export function reviewAnswer(
  round: ShownRound & { readonly prompt: string },
  answer: RoundAnswer,
): RoundOption | undefined {
  if (round.form !== answer.form) return undefined;
  return formOf(round.form).reviewAnswer(round, answer);
}
