import { z } from 'zod';

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
  /** The title over the Curated Collections rail, «Добірки». */
  curatedCollectionsTitle: TextSchema,
  /** The badge on a Curated Collection card not yet opened, «Нова». */
  curatedCollectionNew: TextSchema,
});
