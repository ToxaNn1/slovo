import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf, PluralLabelSchema, PluralSchema, templateOf } from './shared';

/** The texts of the Stats pill and the stats sheet it opens. */
export const StatsStringsSchema = z.strictObject({
  /** The sheet's name, for VoiceOver. */
  title: TextSchema,
  /** What VoiceOver reads for the Stats pill, e.g. «Статистика: серія 12 днів». Takes `{count}`, the Streak. */
  pillLabel: PluralSchema,
  /** What VoiceOver reads for the Stats pill while the reader hides the Streak, e.g. «Статистика». */
  pillLabelWithoutStreak: TextSchema,
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
  /** The words beside the best Game result, «13 / 15», picked by the best result, e.g. «найкраще у Грі». */
  gameBest: PluralLabelSchema,
  /**
   * What VoiceOver reads for the best Game result, e.g. «Найкраще у Грі: 13 з 15».
   * Takes `{count}`, the best result, which picks the form, and `{total}`, the Rounds of a Game.
   */
  gameBestLabel: pluralOf('total'),
  /**
   * The row of the Known Entries, e.g. «Знаю 120 слів · 12 Виправлень · 8 фразеологізмів».
   * Takes `{counts}`: the Known count of each kind of Entry shown, joined by `knownJoiner`.
   */
  known: templateOf('counts'),
  /** What joins the Known counts in the row of the Known Entries, e.g. « · ». */
  knownJoiner: TextSchema,
  /**
   * The Entries of each kind marked Known, in the row of the Known Entries, e.g. «12 слів»,
   * «3 Виправлення», «8 фразеологізмів» (Idioms with place names). Each takes `{count}`.
   */
  knownByKind: z.strictObject({
    word: PluralSchema,
    correction: PluralSchema,
    idiom: PluralSchema,
  }),
  /** The row of the Entries due for Review today, e.g. «На повторення сьогодні: 4». Takes `{count}`. */
  dueToday: templateOf('count'),
});
