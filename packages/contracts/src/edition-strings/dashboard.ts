import { z } from 'zod';

import { CorrectionTypeSchema } from '../correction';
import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The Dashboard, the home behind «Стрічка» (ADR 0076). The hero's «Розкрити» is `wordOfTheDay.reveal`. */
export const DashboardStringsSchema = z.strictObject({
  /** The hero's link that opens the Feed on the Word of the Day card, «До картки →». */
  toCard: TextSchema,
  /** The Mood check-in block under the hero. */
  mood: z.strictObject({
    /** The question over the Mood chips, «Як настрій?». */
    question: TextSchema,
    /** The button that skips the check-in for today, «Не сьогодні». */
    skip: TextSchema,
    /** The collapsed line after a choice, «Сьогодні: {mood}». Takes `{mood}`, its emoji and name. */
    today: templateOf('mood'),
    /** The link that opens the chips again to change today's Mood, «змінити». */
    change: TextSchema,
  }),
  /** The block «Попередні слова» under the Mood check-in: the Word of the Day archive's newest days before today. */
  previousWords: z.strictObject({
    /** The block's title, «Попередні слова». */
    title: TextSchema,
  }),
  /** The Correction Types rail and each type's screen. */
  correctionTypes: z.strictObject({
    /** The rail's title, «Виправлення». */
    title: TextSchema,
    /** A tile's count, «Розібрано {x} з {n}». Takes `{x}`, the Corrections «розібрано», and `{n}`, all of the type. */
    workedThrough: templateOf('x', 'n'),
    /** The button that reveals a Correction's standard form and explanation in place, «Як правильно?». */
    reveal: TextSchema,
    /** Each Correction Type's tile name and screen title, in the plural, «Суржик». */
    tiles: z.record(CorrectionTypeSchema, TextSchema),
  }),
  /** The title over the Curated Collections rail, «Добірки». */
  curatedCollectionsTitle: TextSchema,
  /** The badge on a Curated Collection card not yet opened, «Нова». */
  curatedCollectionNew: TextSchema,
});
