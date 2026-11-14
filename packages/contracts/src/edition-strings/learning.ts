import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf, PluralSchema, templateOf } from './shared';

/** The texts of the «Вчу» list: its card in the Saved tab, the list, its rows and its empty state. */
export const LearningStringsSchema = z.strictObject({
  /** The name of the list: its title and the Saved tab's card. */
  title: TextSchema,
  /** How many Entries the list holds, as VoiceOver reads the count. */
  count: PluralSchema,
  /** What VoiceOver reads for the list's card in the Saved tab. Takes `{count}`, the count in words. */
  cardLabel: templateOf('count'),
  /** The line under the list. */
  footer: TextSchema,
  /** When an Entry is next due for Review, on the right of its row. */
  reviewDay: z.strictObject({
    /** Due today or since an earlier day. */
    today: TextSchema,
    tomorrow: TextSchema,
    /** Two days or more from today. Takes `{count}`, the number of days. */
    inDays: PluralSchema,
  }),
  /** The empty list. */
  empty: z.strictObject({ title: TextSchema, message: TextSchema }),
  /** The Due Quiz «Перевір себе» over the Words due today: its card over the list, its sheet and its toast (ADR 0131). */
  dueQuiz: z.strictObject({
    /** The card's title and the sheet's title. */
    title: TextSchema,
    /** The card's line: how many Words the quiz asks today. */
    count: PluralSchema,
    /** The card's button that opens the sheet. */
    start: TextSchema,
    /** What VoiceOver reads for the card. Takes `{count}`, the `count` phrase. */
    cardLabel: templateOf('count'),
    /** The sheet's place in the quiz, «1 з 2». Takes `{index}` and `{count}`. */
    progress: templateOf('index', 'count'),
    /** The question under the Lemma. */
    question: TextSchema,
    /** The marks of the three meanings, in order. */
    options: z.strictObject({ first: TextSchema, second: TextSchema, third: TextSchema }),
    /** A meaning as VoiceOver reads it. Takes `{option}`, its mark, and `{meaning}`. */
    optionLabel: templateOf('option', 'meaning'),
    /** What VoiceOver announces after an answer. */
    answered: z.strictObject({ right: TextSchema, wrong: TextSchema }),
    /** The button to the next Word. */
    next: TextSchema,
    /** The button after the last Word, which closes the sheet with the toast. */
    done: TextSchema,
    /** The button that closes the sheet; the answers given stay. */
    cancel: TextSchema,
    /** The toast on «Готово». */
    result: z.strictObject({
      /** Every answer right: one Word, two Words, or `{count}` Words. */
      allRight: z.strictObject({ single: TextSchema, both: TextSchema, many: pluralOf() }),
      /** Some answers wrong. Takes `{known}`, the right ones, and `{count}`, the Words asked. */
      partial: templateOf('known', 'count'),
    }),
  }),
});
