import { z } from 'zod';

import { FontSizeSchema, TextSizeSchema, ThemeSchema } from '../edition';
import { TextSchema } from '../shared';
import { PluralLabelSchema, PluralSchema, pluralOf, templateOf } from './shared';

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
  /** The Daily Goal choice, a goal of Words Seen in its plural form («25 слів»), and «Без цілі», which turns the Daily Goal off from today (ADR 0074). */
  dailyGoal: z.strictObject({
    title: TextSchema,
    /** A goal as its option and the Settings row name it, e.g. «25 слів». */
    goal: PluralSchema,
    none: TextSchema,
    /** The line under the Daily Goal screen's title. */
    subtitle: TextSchema,
    /** The explaining line under the big number, for each goal of Words Seen and for «Без цілі». */
    explanations: z.strictObject({
      '10': TextSchema,
      '25': TextSchema,
      '50': TextSchema,
      none: TextSchema,
    }),
  }),
  /**
   * «Рідкість», the Rarity Range (ADR 0156): its label, the line under it,
   * the segment of the top alone while the `rarityRange` switch is off, which
   * takes `{rarity}`, e.g. «до 3», and the picker's range, `{from}` to `{to}`,
   * e.g. «від 2 до 4», or one rarity, `{rarity}`, e.g. «лише 3».
   */
  rarity: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    ceiling: templateOf('rarity'),
    range: templateOf('from', 'to'),
    single: templateOf('rarity'),
    /** What a screen reader names one bar of the picker, `{rarity}`, e.g. «Рідкість 3». */
    bar: templateOf('rarity'),
    /** The line under the picker's bars that says how a range is picked. */
    hint: TextSchema,
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
    /** The row that retakes the questionnaire, e.g. «Анкета: підлаштувати Стрічку». */
    questionnaire: TextSchema,
    /** The row that shows the Feed's gestures hint once more, e.g. «Показати підказку жестів». */
    gesturesHint: TextSchema,
    /** The row that opens the Profile, e.g. «Профіль». */
    profile: TextSchema,
    /** The row that opens the text-size screen, e.g. «Шрифт і розмір». */
    textSize: TextSchema,
    /** The row that opens the Widgets screen, e.g. «Віджети». */
    widgets: TextSchema,
    /** The row that opens the Account screen, e.g. «Акаунт і синхронізація». */
    account: TextSchema,
    /** The row that opens the privacy screen, e.g. «Конфіденційність». */
    privacy: TextSchema,
  }),
  /** The line under each Settings row's title, as board 11 draws it; a row the board does not draw has one of its own. */
  rowSubtitles: z.strictObject({
    theme: TextSchema,
    sounds: TextSchema,
    vibration: TextSchema,
    notifications: TextSchema,
    widgets: TextSchema,
    textSize: TextSchema,
    dailyGoal: TextSchema,
    selfCheck: TextSchema,
    myMix: TextSchema,
    hidden: TextSchema,
    streakBreak: TextSchema,
    /** The Break row's line while a Break runs. Takes `{date}`, its last day. */
    streakBreakRunning: templateOf('date'),
    badges: TextSchema,
    questionnaire: TextSchema,
    gesturesHint: TextSchema,
    profile: TextSchema,
    privacy: TextSchema,
    /** The Account row while signed out. */
    signedOut: TextSchema,
    /** The Account row while signed in. */
    signedIn: TextSchema,
    /** The About row. Takes `{version}` and `{build}`, e.g. «Версія 1.0 (312)» (ADR 0044). */
    about: templateOf('version', 'build'),
  }),
  /** The three-step text size screen (ADR 0134): its title, the line under it, the sample and each step's name and explaining line. */
  textSize: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    sizes: z.record(TextSizeSchema, TextSchema),
    explanations: z.record(TextSizeSchema, TextSchema),
    /** The sample Word, drawn at the size chosen. */
    preview: z.strictObject({ lemma: TextSchema, definition: TextSchema }),
  }),
  /** The Widgets screen: its title, the line under it and the names of the view-only previews. */
  widgets: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    previews: z.strictObject({ small: TextSchema, medium: TextSchema, lockScreen: TextSchema }),
  }),
  /** The privacy screen «Конфіденційність» (ADR 0135): the one switch of ADR 0068 and the Data export. */
  privacy: z.strictObject({
    title: TextSchema,
    /** The switch that gates Analytics and the Community Counters; `anonymousStats.explanation` stays under it. */
    statsTitle: TextSchema,
    /** «Експортувати мої дані»: its row, the line under it, the title of the file handed to the share window, and a failure. */
    dataExport: z.strictObject({
      title: TextSchema,
      subtitle: TextSchema,
      fileTitle: TextSchema,
      failed: TextSchema,
    }),
  }),
  /** «Скинути прогрес» (ADR 0133): the button at the bottom of Settings, its sheet and the toast after it. */
  progressReset: z.strictObject({
    button: TextSchema,
    title: TextSchema,
    message: TextSchema,
    cancel: TextSchema,
    confirm: TextSchema,
    done: TextSchema,
  }),
  /** The Questionnaire retake screen: its title and the one button that applies the answers. */
  questionnaireRetake: z.strictObject({ title: TextSchema, done: TextSchema }),
  /** The Badges screen: the Badges in a grid by family, each earned with its date, or its progress (ADR 0066). */
  badges: z.strictObject({
    title: TextSchema,
    /** How many Badges of a family, or of all, are earned, e.g. «10 з 21». */
    earnedOf: templateOf('earned', 'total'),
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
    /** A card's status on the Badges screen, earned, e.g. «Отримано»; the date shows in the sheet (ADR 0145). */
    cardEarned: TextSchema,
    /** A card's status while not earned, e.g. «Ще ні · 77%». Takes `{percent}`, how far its condition has come. */
    cardNotYet: templateOf('percent'),
    /** The Badge families overview heading the Badges screen (ADR 0145). */
    families: z.strictObject({
      /** How many Badges a family holds, e.g. «5 відзнак». */
      count: PluralSchema,
      /** The label before a family's shape, e.g. «ФОРМА». */
      shape: TextSchema,
      /** The name of each Badge shape, e.g. «Шестикутник». */
      shapes: z.strictObject({
        hexagon: TextSchema,
        shield: TextSchema,
        circle: TextSchema,
        tile: TextSchema,
        wedge: TextSchema,
        diamond: TextSchema,
        checker: TextSchema,
      }),
    }),
    /** The ink tag on an earned Badge the reader has not opened yet, e.g. «НОВА» (ADR 0085). */
    newTag: TextSchema,
    /** The sheet a tap on any Badge opens (p3, p4). */
    sheet: z.strictObject({
      /** The kicker over the mark, e.g. «ВІДЗНАКА». */
      kicker: TextSchema,
      /** An unearned Badge's line, e.g. «Ще ні · 23 з 30 днів». Takes `{progress}`, one of the `progress` forms. */
      notYet: templateOf('progress'),
      /** The button that closes the sheet, e.g. «ГОТОВО». */
      done: TextSchema,
    }),
  }),
  /** The Profile: the reader's whole progress, with its Badges as the Badges screen words them. */
  profile: z.strictObject({
    title: TextSchema,
    /** The header's line under the name. Takes `{level}` and `{name}`, e.g. «Рівень 3 — Знавець». */
    headerLevel: templateOf('level', 'name'),
    /** The reader's name (ADR 0136): its row, the row's value without a name, the sheet, and the line when it is too long. */
    readerName: z.strictObject({
      row: TextSchema,
      empty: TextSchema,
      title: TextSchema,
      placeholder: TextSchema,
      save: TextSchema,
      /** Takes `{count}` and `{max}`, e.g. «5 / 24». */
      counter: templateOf('count', 'max'),
      /** Takes `{max}`. */
      tooLong: templateOf('max'),
    }),
    /** The word under the Level's number in its ring, e.g. «Рівень». */
    levelLabel: TextSchema,
    /** The word under the XP in the ring before the first Level, e.g. «XP» (ADR 0188). */
    xpLabel: TextSchema,
    /**
     * The line under the Active Days calendar while today waits for its Daily Goal (ADR 0188), by the goal's
     * plural form: `{seen}` Words Seen today of `{count}`, e.g. «Сьогодні зарахується, коли виконаєш ціль: 3 з 10 слів».
     */
    todayPending: pluralOf('seen'),
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
    /** The word under the Best Streak's number in its tile beside the Streak, e.g. «рекорд». */
    record: TextSchema,
    /** The Best Streak beside the Streak as VoiceOver reads its tile, e.g. «найдовша 12 днів». */
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
      /** The paused Streak, e.g. «Серія на паузі: 12». */
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
      /** The caption under the Streak tile's big number, e.g. «днів поспіль». */
      streakDays: PluralLabelSchema,
      /** The caption under the big number of days the freezes saved, e.g. «заморозка врятувала день». */
      saved: PluralLabelSchema,
    }),
    /** An earned Badge stamped on red (board 10.7). */
    badgeStamp: z.strictObject({
      /** The giant cream word behind the mark, e.g. «ВІДЗНАКА» (10.7, ADR 0085). */
      kicker: TextSchema,
      /** The ribbon of the last frame, e.g. «ТЕПЕР ТВОЯ». */
      ribbon: TextSchema,
      /** The button that closes the stamp, e.g. «ГОТОВО». */
      done: TextSchema,
      /** The line under the Badge's name, also on the in-Game toast, e.g. «Нова відзнака — тепер вона твоя назавжди.». */
      line: TextSchema,
    }),
  }),
  /** The Break screen: what a Break does, its length, whether one can start today and how one ends early (ADR 0066, 0180). */
  streakBreak: z.strictObject({
    title: TextSchema,
    /** What a Break does and how often it can start. */
    explanation: TextSchema,
    /** The label over the length choice, in days. */
    length: TextSchema,
    /** The button that starts the Break of the length chosen. */
    start: TextSchema,
    /** What VoiceOver reads for the stepper's − and + buttons. */
    fewerDays: TextSchema,
    moreDays: TextSchema,
    /** Under the stepper at 7, the longest a Break can be (ADR 0066). */
    most: TextSchema,
    /** Under the stepper at the Break days left in the 30 days, fewer than 7 (ADR 0180). */
    mostLeft: PluralSchema,
    /** While a Break runs, its days from today to its last day, both included. */
    daysLeft: PluralSchema,
    /** While a Break runs. Takes `{date}`, its last day, e.g. «20.10». */
    running: templateOf('date'),
    /** The button that ends the running Break today (ADR 0180). */
    end: TextSchema,
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
    /** The same line without a build number of the app's own, under Expo Go. Takes `{version}`. */
    versionAlone: templateOf('version'),
    /** The Update channel the build listens to, `beta` or `production` (ADR 0167). Takes `{channel}`. */
    channelLine: templateOf('channel'),
    /** The day the update the build runs was made, e.g. «Оновлення від 18 листопада». Takes `{day}` and `{month}`, one of `dates.months`. */
    updateLine: templateOf('day', 'month'),
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
