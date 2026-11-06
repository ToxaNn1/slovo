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
  /** «Менше руху»: the switch that calms every animation, and the explanation under it. */
  reduceMotion: z.strictObject({ title: TextSchema, explanation: TextSchema }),
  /** The switch that shares the Community Counters, and the explanation under it. */
  anonymousStats: z.strictObject({ title: TextSchema, explanation: TextSchema }),
  /** The Daily Goal choice, its numbers of Words drawn as they are, and «Без цілі», which turns the Daily Goal off from today (ADR 0074). */
  dailyGoal: z.strictObject({ title: TextSchema, none: TextSchema }),
  /**
   * «Рідкість», the Rarity Ceiling row (ADR 0072): its label, the line under
   * it, and a ceiling's segment, which takes `{rarity}`, e.g. «до 3».
   */
  rarity: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    ceiling: templateOf('rarity'),
  }),
  /** The heads of the Settings groups, as the board names them. */
  groups: z.strictObject({
    /** The Theme, motion, Seasonal Decor and the font size. */
    look: TextSchema,
    /** Sounds, vibration, the Notifications and the widgets. */
    sound: TextSchema,
    /** The Daily Goal, My Mix and the rows of learning. */
    learning: TextSchema,
    /** The Account, the anonymous statistics and About. */
    account: TextSchema,
  }),
  /** The row that opens the widget guide. */
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
  /** The Badges screen: the Badges in a grid by family, each earned with its date, or its progress (ADR 0066). */
  badges: z.strictObject({
    title: TextSchema,
    /** How many Badges of a family, or of all, are earned, e.g. «10 з 21». */
    earnedOf: templateOf('earned', 'total'),
    /** The name over each Badge family's row. */
    families: z.strictObject({
      streak: TextSchema,
      games: TextSchema,
      entries: TextSchema,
      levels: TextSchema,
    }),
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
    /** The word under the Level's number in its ring, e.g. «Рівень». */
    levelLabel: TextSchema,
    /** The XP towards the next Level, e.g. «40 з 120 XP до наступного рівня». */
    toNext: templateOf('progress', 'toNext'),
    /** All XP ever earned, e.g. «Усього XP: 860». */
    totalXp: templateOf('count'),
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
    /** An earned Badge stamped on red after a tap on its mark. */
    badgeStamp: z.strictObject({
      /** The cry under the mark, e.g. «Твій!». */
      title: TextSchema,
      /** The button that closes the stamp, e.g. «Забрати». */
      take: TextSchema,
    }),
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
  /** The «Звуки» row and the Vibration row. */
  sounds: z.strictObject({
    sounds: TextSchema,
    vibration: TextSchema,
  }),
  /** The «Голос диктора» row and the Narrator Voice screen (ADR 0083). */
  narratorVoice: z.strictObject({
    /** The row's title. */
    row: TextSchema,
    /** The row's line under the title. */
    rowSub: TextSchema,
    /** The screen's title. */
    title: TextSchema,
    /** The line under the title. */
    lead: TextSchema,
    /** Over the sample Word. Takes `{name}`, the voice that reads it, in capitals. */
    reading: templateOf('name'),
    /** The label over the voices. */
    choose: TextSchema,
    /** The button that reads the sample Word in the chosen voice. */
    play: TextSchema,
    /** The same button while the voice reads. */
    pause: TextSchema,
  }),
  /** The About screen. */
  about: z.strictObject({
    /** The giant letter on the red panel. */
    glyph: TextSchema,
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
