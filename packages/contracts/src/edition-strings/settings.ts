import { z } from 'zod';

import { FontSizeSchema, ThemeSchema } from '../edition';
import { TextSchema } from '../shared';
import { pluralOf, templateOf } from './shared';

export const SettingsStringsSchema = z.strictObject({
  /** The Settings screen title. */
  title: TextSchema,
  /** The label over the Theme choice. */
  theme: TextSchema,
  /** The name of every Theme. */
  themes: z.record(ThemeSchema, TextSchema),
  /** The label over the font-size choice. */
  fontSize: TextSchema,
  /** The name of every font size. */
  fontSizes: z.record(FontSizeSchema, TextSchema),
  /** The sample Word the font-size preview shows. */
  fontSizePreview: z.strictObject({
    /** The sample Lemma, Stress marks included. */
    lemma: TextSchema,
    definition: TextSchema,
  }),
  /** The tag on a row that a later version brings. */
  soon: TextSchema,
  /** What VoiceOver reads for a row that a later version brings. Takes `{label}`. */
  soonAccessibilityLabel: templateOf('label'),
  /** The switch that hides the Streak everywhere it is drawn, while «Без лічильників» is switched off. */
  hideStreak: TextSchema,
  /** «Без лічильників»: the switch that hides every counter while counting goes on, and the explanation under it. */
  noCounters: z.strictObject({ title: TextSchema, explanation: TextSchema }),
  /** The switch that turns Self-check on. */
  selfCheck: TextSchema,
  /** The switch that makes the Decor follow the Season and the Holidays, and the explanation under it. */
  seasonalDecor: z.strictObject({ title: TextSchema, explanation: TextSchema }),
  /** The switch that shares the Community Counters, and the explanation under it. */
  anonymousStats: z.strictObject({ title: TextSchema, explanation: TextSchema }),
  /** The Daily Goal choice; its numbers of XP are drawn as they are. */
  dailyGoal: z.strictObject({ title: TextSchema }),
  /** The title over the widget's rows. */
  widgets: TextSchema,
  /** The row under «Віджети» that opens the widget guide. */
  howToAddWidget: TextSchema,
  /** The names of the rows under the Theme and the font size. */
  rows: z.strictObject({
    notifications: TextSchema,
    myMix: TextSchema,
    hidden: TextSchema,
    about: TextSchema,
    /** The row that opens the Break screen, e.g. «Перерва». */
    streakBreak: TextSchema,
    /** The row that opens the Badges screen, e.g. «Відзнаки». */
    badges: TextSchema,
    /** The row that retakes the questionnaire, e.g. «Пройти опитування ще раз». */
    questionnaire: TextSchema,
    /** The row that opens the Profile, e.g. «Профіль». */
    profile: TextSchema,
  }),
  /** The Badges screen: each Badge earned with its date, or its progress (ADR 0066). */
  badges: z.strictObject({
    title: TextSchema,
    /** An earned Badge. Takes `{date}`, the day it was earned, e.g. «20.10.2026». */
    earned: templateOf('date'),
    /** A Badge of one first time (a win, a right answer on a rarity) not earned yet. */
    notYet: TextSchema,
    /** The progress of an unearned Badge by its condition, `{current}` of `{count}`. */
    progress: z.strictObject({
      days: pluralOf('current'),
      entries: pluralOf('current'),
      rightAnswers: pluralOf('current'),
      level: pluralOf('current'),
    }),
  }),
  /** The Profile: the reader's whole progress, with its Badges as the Badges screen words them. */
  profile: z.strictObject({
    title: TextSchema,
    /** The Level and its name, e.g. «Рівень 3 · Читач». */
    level: templateOf('level', 'name'),
    /** The XP towards the next Level, e.g. «40 з 120 XP до наступного рівня». */
    toNext: templateOf('progress', 'toNext'),
    /** All XP ever earned, e.g. «Усього XP: 860». */
    totalXp: templateOf('count'),
    /** The Streak, e.g. «Серія: 12». */
    streak: templateOf('count'),
    /** The Best Streak, e.g. «Найкраща серія: 31». */
    bestStreak: templateOf('count'),
    /** The heading over the Active Days calendar. */
    activeDays: TextSchema,
    /** The heading over the confirmed Entries by rarity. */
    confirmed: TextSchema,
    /** The confirmed Entries of one rarity, e.g. «Рідкість 3: 14». */
    confirmedOfRarity: templateOf('rarity', 'count'),
    /** The heading over the Badges. */
    badges: TextSchema,
    /** The heading over each Game Mode's Best result. */
    gameBest: TextSchema,
    /** A Game Mode with no finished Game yet. */
    noGameBest: TextSchema,
    /** The button that shares the Level. */
    shareLevel: TextSchema,
    /** The text the Level is shared with, e.g. «Мій рівень — 3 · Читач». */
    shareMessage: templateOf('level', 'name'),
  }),
  /** The Break screen: what a Break does, its length and whether one can start today (ADR 0066). */
  streakBreak: z.strictObject({
    title: TextSchema,
    /** What a Break does and how often it can start. */
    explanation: TextSchema,
    /** The label over the length choice, in days. */
    length: TextSchema,
    /** The button that starts the Break of the length chosen. */
    start: TextSchema,
    /** While a Break runs. Takes `{date}`, its last day, e.g. «20.10». */
    running: templateOf('date'),
    /** While the next Break waits. Takes `{date}`, the first day it can start, e.g. «13.11». */
    waiting: templateOf('date'),
  }),
  /** The Sounds section and its Vibration row. */
  sounds: z.strictObject({
    section: TextSchema,
    vibration: TextSchema,
  }),
  /** The About screen. */
  about: z.strictObject({
    /** The Edition's line under its name. */
    editionLine: TextSchema,
    /** The installed build's line. Takes `{version}` and `{build}`. */
    versionLine: templateOf('version', 'build'),
    /** The OTA update the app runs (ADR 0062). Takes `{id}`. */
    updateLine: templateOf('id'),
    /** What SLOVO is. */
    description: TextSchema,
    /** Where the words come from. */
    sources: TextSchema,
    /** The label over the feedback rows. */
    feedback: TextSchema,
    suggestWord: z.strictObject({ title: TextSchema, subtitle: TextSchema }),
    reportError: z.strictObject({ title: TextSchema, subtitle: TextSchema }),
    /** The rows that open the Edition's legal pages in the browser. */
    privacyPolicy: TextSchema,
    terms: TextSchema,
  }),
});
