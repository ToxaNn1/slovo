import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf, PluralLabelSchema, PluralSchema, templateOf } from './shared';

/**
 * The texts of one Game Mode, alike for every mode: its card on the mode
 * screen, the label of its Rounds and what its card says for each reason it
 * can't start.
 */
const GameModeStringsSchema = z.strictObject({
  /** The card's overline, e.g. «ВИЗНАЧЕННЯ → СЛОВО». */
  overline: TextSchema,
  title: TextSchema,
  description: TextSchema,
  /** The card's sample: a prompt and the answer it asks for, e.g. a Definition and a Lemma with Stress. */
  sample: z.strictObject({ prompt: TextSchema, answer: TextSchema }),
  /** The label over a Round's prompt, e.g. «ВИЗНАЧЕННЯ». */
  roundLabel: TextSchema,
  /** What the card says for each reason the Core gives that the mode can't start. */
  refusals: z.strictObject({
    /** Too few eligible Entries of the mode's kind to play it; any mode may meet it. */
    'too-few-entries': TextSchema,
    /** Corrections out of the reader's Mix; only a mode that asks about Corrections meets it. */
    'corrections-out-of-mix': TextSchema.optional(),
    /** Idioms out of the reader's Mix; only a mode that asks about Idioms meets it (0.8.8). */
    'idioms-out-of-mix': TextSchema.optional(),
    /** Synonym Rows out of the reader's Mix; only a mode that asks about Synonym Rows alone meets it. */
    'synonymRows-out-of-mix': TextSchema.optional(),
    /** Tips out of the reader's Mix; only a mode that asks about Tips alone meets it. */
    'tips-out-of-mix': TextSchema.optional(),
  }),
});

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
  /** The titles of the mode screen's groups of mode cards, e.g. «Слова». */
  groups: z.strictObject({
    /** The modes that ask about Words, e.g. «Слова». */
    words: TextSchema,
    /** The modes that ask about Corrections, e.g. «Виправлення». */
    corrections: TextSchema,
    /** The modes that ask about Idioms, e.g. «Вислови». */
    idioms: TextSchema,
    /** The modes with their own Lives, Round limit or time limit, e.g. «Виклик». */
    challenge: TextSchema,
  }),
  /** The Best result of a Game Mode on its card. */
  modeBest: z.strictObject({
    /** In a mode with a Round limit, e.g. «Найкраще: 12 з 15». Takes `{n}`, the Best result, and `{total}`, the Rounds of a Game. */
    outOf: templateOf('n', 'total'),
    /** In a mode without a Round limit, e.g. «Найкраще: 23». Takes `{n}`, the Best result. */
    count: templateOf('n'),
  }),
  /** The button that opens one letter of the answer, in a mode that has it and in the Daily Crossword. */
  openLetter: TextSchema,
  /** What VoiceOver reads for a letter in its place in a Word: a vowel button, a blank, a crossword cell. */
  letters: z.strictObject({
    /** A letter, e.g. «а, третя літера». Takes `{letter}` and `{place}`, one of the `ordinals`. */
    label: templateOf('letter', 'place'),
    /** A place with no letter yet, e.g. «третя літера, порожня». Takes `{place}`, one of the `ordinals`. */
    empty: templateOf('place'),
    /** Each place in a Word from the first, as the labels read it, e.g. «перша», «друга». */
    ordinals: z.array(TextSchema).min(1),
  }),
  /** The Daily Crossword's card on the mode screen and its screen; it is not a Game. */
  dailyCrossword: z.strictObject({
    /** Its name, e.g. «Кросворд дня». */
    title: TextSchema,
    /** Its name with the day on the card, e.g. «Кросворд дня · 26 жовтня». Takes `{date}`, the day and month. */
    dated: templateOf('date'),
    /** The card's button before any letter is in, e.g. «Почати». */
    start: TextSchema,
    /** The card's button once some letters are in, e.g. «Продовжити». */
    resume: TextSchema,
    /** The card's mark once today's is solved, e.g. «✓ Розв’язано». */
    solvedMark: TextSchema,
    /** The screen's line once it is solved, e.g. «Розв’язано!». */
    solved: TextSchema,
  }),
  /**
   * The texts of each Game Mode on offer, by its id: the Core's own and any
   * an Edition registers (ADR 0024).
   */
  modes: z.record(z.string(), GameModeStringsSchema),
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
    /**
     * A Synonym Row's Round, in any Game Mode that asks about rows: the label
     * over its question, e.g. «СИНОНІМИ», and the question, e.g. «Що є
     * синонімом до „іти“?». Takes `{dominant}`, the row's dominant with its Stress.
     */
    synonymRow: z.strictObject({ label: TextSchema, prompt: templateOf('dominant') }),
    /** A Tip's Round, which asks the Tip's own question: the label over it, e.g. «ПОРАДА». */
    tip: z.strictObject({ label: TextSchema }),
    /** What VoiceOver reads of the timer of a mode with a time limit, e.g. «лишилось 40 секунд». Takes `{count}`, the seconds left. */
    timer: PluralSchema,
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
  /** The Game Review under the result: a row per Round played. */
  review: z.strictObject({
    /** The heading over the rows, e.g. «Ваші раунди». */
    title: TextSchema,
    /** What VoiceOver reads for ✓, e.g. «правильно». */
    right: TextSchema,
    /** What VoiceOver reads for ✗, e.g. «помилка». */
    wrong: TextSchema,
    /** The reader's wrong pick under the row, e.g. «Ваш вибір: шпаркий». Takes `{text}`. */
    picked: templateOf('text'),
    /** What VoiceOver says a tap on a row does: expand it. */
    expandHint: TextSchema,
    /** What VoiceOver says a tap on an expanded row does: open the Entry. */
    openHint: TextSchema,
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
    best: PluralLabelSchema,
    /** The button that starts a new Game in the same mode. */
    again: TextSchema,
    /** The button that goes to the Feed. */
    home: TextSchema,
  }),
});
