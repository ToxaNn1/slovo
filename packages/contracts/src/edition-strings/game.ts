import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf, PluralLabelSchema, PluralSchema, templateOf } from './shared';

/** The texts of the Game: the mode screen, a Round, its answer sheet and the result screen. */
export const GameStringsSchema = z.strictObject({
  /** The mode screen's title. */
  title: TextSchema,
  /** The line under it, e.g. «15 раундів, 5 життів.». Takes `{rounds}` and `{lives}`, the two counts in words. */
  rules: templateOf('rounds', 'lives'),
  /** A count of Rounds, e.g. «15 раундів». */
  rounds: PluralSchema,
  /** A count of Lives, e.g. «5 життів». */
  lives: PluralSchema,
  /**
   * The best result after the line above, e.g. «Найкраще — 13 / 15.». Takes
   * `{count}`, the best result, which picks the form, and `{total}`, the Rounds of a Game.
   */
  best: pluralOf('total'),
  /** What a mode card says when there are too few eligible Words to play its mode. */
  tooFewEntries: TextSchema,
  /** «Вгадай слово», the Definition → Word mode: its card and the label of its Round. */
  guessWord: z.strictObject({
    /** The card's overline, e.g. «ВИЗНАЧЕННЯ → СЛОВО». */
    overline: TextSchema,
    title: TextSchema,
    description: TextSchema,
    /** The card's sample: a Definition, and the Lemma with Stress it asks for. */
    sample: z.strictObject({ prompt: TextSchema, answer: TextSchema }),
    /** The label over a Round's Definition, e.g. «ВИЗНАЧЕННЯ». */
    prompt: TextSchema,
  }),
  /** «Обери правильне», the Correction mode: its card, the label of its Round and why it can't start. */
  correction: z.strictObject({
    /** The card's overline, e.g. «ВИПРАВЛЕННЯ». */
    overline: TextSchema,
    title: TextSchema,
    description: TextSchema,
    /** The card's sample: a non-standard form, drawn struck through, and its standard equivalent. */
    sample: z.strictObject({ prompt: TextSchema, answer: TextSchema }),
    /** The label over a Round's sentence, e.g. «ЯК СКАЗАТИ КРАЩЕ?». */
    prompt: TextSchema,
    /** What its card says while Corrections are out of the reader's Mix. */
    outOfMix: TextSchema,
    /** What its card says when there are too few eligible Corrections to play it. */
    tooFewEntries: TextSchema,
  }),
  /** A Round. */
  round: z.strictObject({
    /** The Rounds passed over the bar, e.g. «7 / 15». Takes `{passed}` and `{total}`. */
    progress: templateOf('passed', 'total'),
    /** What VoiceOver reads for it, e.g. «Пройдено раундів: 7 з 15». Takes `{passed}` and `{total}`. */
    progressLabel: templateOf('passed', 'total'),
    /** What VoiceOver reads for the Lives, e.g. «Життів: 4 з 5». Takes `{count}` and `{total}`. */
    lives: templateOf('count', 'total'),
    /**
     * What VoiceOver reads after the prompt for the part of it that is marked,
     * such as a non-standard form, e.g. «Виділено: на протязі». Takes `{text}`.
     */
    highlight: templateOf('text'),
    /** The tag of the right option once the Round is answered. */
    correct: TextSchema,
    /** The tag of the reader's wrong choice. */
    chosen: TextSchema,
  }),
  /** The ✕ that leaves a Game and its confirmation, a system alert. */
  exit: z.strictObject({
    /** The ✕ as VoiceOver reads it, e.g. «Вийти з гри». */
    label: TextSchema,
    title: TextSchema,
    message: TextSchema,
    /** The destructive button that drops the Game. */
    confirm: TextSchema,
    /** The button that goes back to the same Round. */
    cancel: TextSchema,
  }),
  /** The sheet after an answer, which only its button closes. */
  sheet: z.strictObject({
    /** Its title after a right answer, e.g. «Правильно!». */
    correct: TextSchema,
    /** Its title after a wrong one, e.g. «Не цього разу». */
    wrong: TextSchema,
    /** The button that goes on, e.g. «Далі». */
    next: TextSchema,
  }),
  /** The result screen. */
  result: z.strictObject({
    won: z.strictObject({
      title: TextSchema,
      /** The line under the title, e.g. «Усі 15 раундів пройдено.». Takes `{count}`, the Rounds of a Game. */
      line: PluralSchema,
    }),
    lost: z.strictObject({ title: TextSchema, line: TextSchema }),
    /** The word under the Rounds passed, «11 / 15», agreeing with the Rounds of a Game, e.g. «раундів». */
    rounds: PluralLabelSchema,
    /** The word under the Lives left, e.g. «життів». */
    lives: PluralLabelSchema,
    /** The word under the best result, the Game just over included, e.g. «рекорд». */
    record: PluralLabelSchema,
    /** The button that starts a new Game in the same mode. */
    again: TextSchema,
    /** The button that goes to the Feed. */
    home: TextSchema,
  }),
});
