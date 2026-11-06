import { z } from 'zod';

import { FontSizeSchema, ThemeSchema } from '../edition';
import { TextSchema } from '../shared';
import { PluralSchema, pluralOf, templateOf } from './shared';

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
    /** The ink tag on an earned Badge the reader has not opened yet, e.g. «НОВА» (ADR 0085). */
    newTag: TextSchema,
    /**
     * Each Badge's condition under its mark on the Badges screen, by the kind
     * of its condition (ADR 0085). `{modes}` is the names of its Game Modes,
     * joined by the list's commas.
     */
    conditions: z.strictObject({
      streak: PluralSchema,
      confirmedEntries: PluralSchema,
      gameWin: templateOf('modes'),
      dailyCrosswordRun: PluralSchema,
      rightAnswers: pluralOf('modes'),
      rightOnRarity: templateOf('rarity'),
      level: templateOf('level'),
      flawlessGame: templateOf('modes'),
      rightRun: pluralOf('modes'),
    }),
    /** The sheet a tap on any Badge opens (p3, p4). */
    sheet: z.strictObject({
      /** The kicker over the mark, e.g. «ВІДЗНАКА». */
      kicker: TextSchema,
      /** An unearned Badge's line, e.g. «Ще ні · 23 з 30 днів». Takes `{progress}`, one of the `progress` forms. */
      notYet: templateOf('progress'),
      /** The button that closes the sheet, e.g. «ГОТОВО». */
      done: TextSchema,
    }),
    /** The toast after a tap on an unearned Badge, e.g. ««Тиждень поспіль» ще не ваша. Поки що.» Takes `{name}`. */
    lockedToast: templateOf('name'),
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
    /** The Level card's title, e.g. «7 · Читач». Takes `{level}` and `{name}`, the Level's Edition name (ADR 0085). */
    level: templateOf('level', 'name'),
    /** The Level card's XP into the Level, e.g. «40 / 120 XP». */
    levelProgress: templateOf('progress', 'toNext'),
    /** The Level card's XP still to go, e.g. «ще 80 XP до рівня 8». Takes `{left}` and `{next}`, the next Level. */
    levelLeft: templateOf('left', 'next'),
    /** The Best Streak beside the Streak, e.g. «найдовша 12 днів». */
    bestStreak: PluralSchema,
    /** The Level ladder (10.8): one card per Level name (ADR 0085). */
    ladder: z.strictObject({
      /** A name's range of Levels, e.g. «Рівні 15–19». */
      range: templateOf('from', 'to'),
      /** The last name's range, which has no top, e.g. «Рівні 25+». */
      rangeFrom: templateOf('from'),
      /** A name already passed, e.g. «ПРОЙДЕНО». */
      passed: TextSchema,
      /** The current name, e.g. «ЗАРАЗ». */
      current: TextSchema,
      /** A name still ahead, e.g. «ПОПЕРЕДУ». */
      ahead: TextSchema,
      /** The bar over the cards, e.g. «РІВЕНЬ 7 · ЧИТАЧ». Takes `{level}` and `{name}`. */
      bar: templateOf('level', 'name'),
      /** The XP to the next name's first Level, e.g. «ДО ЗНАВЦЯ 340 XP». Takes `{name}` and `{xp}`. */
      toNext: templateOf('name', 'xp'),
    }),
    /** The new Level screen (p6); the Mascot says the Edition's `newLevel` line (ADR 0085). */
    newLevel: z.strictObject({
      /** The giant word the number is stamped into, e.g. «РІВЕНЬ». */
      kicker: TextSchema,
      /** The line under the number, e.g. «Рівень 8 — Читач». Takes `{level}` and `{name}`. */
      title: templateOf('level', 'name'),
      /** The button that closes the screen, e.g. «ГОТОВО». */
      done: TextSchema,
    }),
    /** The Break card while a Break runs (p1, ADR 0085). */
    breakCard: z.strictObject({
      /** The kicker, e.g. «ПЕРЕРВА». */
      kicker: TextSchema,
      /** The paused Streak, e.g. «Серія 12 на паузі». */
      paused: templateOf('count'),
      /** The Break's last day, e.g. «Перерва триває до 12 листопада включно.» */
      until: templateOf('date'),
      /** The first day the next Break may start, e.g. «Наступну перерву можна почати з 12 грудня.» */
      next: templateOf('date'),
    }),
    /** The Streak freeze card (p2, ADR 0085). */
    freezeCard: z.strictObject({
      title: TextSchema,
      /** The chip of the freezes held, e.g. «2 У ЗАПАСІ». */
      held: templateOf('count'),
      /** What a freeze does. */
      explanation: TextSchema,
      /** The Streak tile, e.g. «12 днів поспіль». */
      streakDays: PluralSchema,
      /** The days the freezes saved in the current Streak, e.g. «1 день врятовано». */
      saved: PluralSchema,
    }),
    /** An earned Badge stamped on red after a tap on its mark. */
    badgeStamp: z.strictObject({
      /** The giant cream word behind the mark, e.g. «ВІДЗНАКА» (10.7, ADR 0085). */
      kicker: TextSchema,
      /** The ribbon of the last frame, e.g. «ТЕПЕР ВАША». */
      ribbon: TextSchema,
      /** The button that closes the stamp, e.g. «ГОТОВО». */
      done: TextSchema,
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
