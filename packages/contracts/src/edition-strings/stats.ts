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
   * The row of the Known Entries, e.g. «знаю 120 слів · 12 виправлень · 8 фразеологізмів ·
   * 5 синонімічних рядів · 3 поради».
   * Takes `{counts}`: the Known count of each kind of Entry shown, joined by `knownJoiner`.
   */
  known: templateOf('counts'),
  /** What joins the Known counts in the row of the Known Entries, e.g. « · ». */
  knownJoiner: TextSchema,
  /**
   * The Entries of each kind marked Known, in the row of the Known Entries, e.g. «12 слів»,
   * «3 виправлення», «8 фразеологізмів» (Idioms with place names), «5 синонімічних рядів»,
   * «3 поради». Each takes `{count}`.
   */
  knownByKind: z.strictObject({
    word: PluralSchema,
    correction: PluralSchema,
    idiom: PluralSchema,
    synonymRow: PluralSchema,
    tip: PluralSchema,
  }),
  /** The row of the Entries due for Review today, e.g. «На повторення сьогодні: 4». Takes `{count}`. */
  dueToday: templateOf('count'),
  /** The XP bar's text, today's XP from the XP log, e.g. «12 XP». Takes `{count}`. */
  xpToday: templateOf('count'),
  /** What VoiceOver reads for the XP bar, e.g. «Досвід: сьогодні 12 XP». Takes `{count}`. */
  xpBarLabel: templateOf('count'),
  /** What VoiceOver reads after the XP bar: that a tap opens the Game, e.g. «Відкриває Гру». */
  xpBarHint: TextSchema,
  /** The Active Days calendar under the counts. */
  calendar: z.strictObject({
    /** What VoiceOver reads for the month control, e.g. «Активні дні». */
    label: TextSchema,
    /** The name of the month shown, e.g. «Жовтень 2026». Takes `{month}` and `{year}`. */
    title: templateOf('month', 'year'),
    /** The month names as the title takes them, January first. */
    months: z.array(TextSchema).length(12),
    /** The short weekday names over the grid, Monday first. */
    weekdays: z.array(TextSchema).length(7),
    /** What VoiceOver reads after the month control: how to change the month. */
    hint: TextSchema,
    /**
     * What VoiceOver reads for each day, e.g. «27 жовтня, активний день». Each takes `{day}`
     * and `{month}`: an Active Day, a day missed, today before and after it is an Active Day,
     * and a day still to come.
     */
    days: z.strictObject({
      active: templateOf('day', 'month'),
      missed: templateOf('day', 'month'),
      today: templateOf('day', 'month'),
      todayActive: templateOf('day', 'month'),
      future: templateOf('day', 'month'),
    }),
  }),
});
