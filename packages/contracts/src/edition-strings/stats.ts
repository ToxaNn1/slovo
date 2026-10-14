import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralLabelSchema, PluralSchema, templateOf } from './shared';

/** The texts of the Stats pill and the stats sheet it opens. */
export const StatsStringsSchema = z.strictObject({
  /** The sheet's name, for VoiceOver. */
  title: TextSchema,
  /** What VoiceOver reads for the Stats pill, e.g. «Статистика: серія 12 днів». Takes `{count}`, the Streak. */
  pillLabel: PluralSchema,
  /** The word beside the big current Streak, e.g. «днів поспіль». */
  streak: PluralLabelSchema,
  /** The line under it: the Best Streak, e.g. «найкраща серія — 31». Takes `{count}`. */
  bestStreak: templateOf('count'),
  /** The word beside the count of Entries Seen today, e.g. «записів сьогодні». */
  seenToday: PluralLabelSchema,
  /** The label of the Favorites count. */
  favorites: TextSchema,
  /** The word beside the count of unique Entries in Collections, e.g. «запис у Колекціях». */
  inCollections: PluralLabelSchema,
});
