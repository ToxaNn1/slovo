import { z } from 'zod';

import { NotificationSoundFileSchema } from './notification-sound';
import { HexColorSchema, RaritySchema, TextSchema, WordIdSchema } from './shared';

const KebabCaseIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case id');

/** A BCP 47 language tag, e.g. `uk` or `uk-UA`. */
const LanguageTagSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Expected a BCP 47 tag such as uk-UA');

const categoryFields = {
  id: KebabCaseIdSchema,
  displayName: z.string().min(1),
  /** One line under the name on the Category's screen, in the Edition's language. */
  description: z.string().min(1),
};

/**
 * A thematic group of Words, or of Corrections, with its display name and
 * one-line description in the Edition's language, and its tone: a `loud`
 * Category is shown in full, a `quiet` one held back (spec #1604). The Words
 * and the Corrections each have their own list (ADR 0033).
 */
export const CategorySchema = z.discriminatedUnion('tone', [
  z.strictObject({ ...categoryFields, tone: z.literal('loud') }),
  z.strictObject({ ...categoryFields, tone: z.literal('quiet') }),
]);

export type Category = z.infer<typeof CategorySchema>;

/**
 * A language Words come from, for a Word's `origin` and «Звідки слово»
 * (ADR 0052). The code is an ISO 639 code where one fits the language, e.g.
 * `la` or `trk`, otherwise a lowercase English word, e.g. `proto-slavic` or
 * `other`; the name is in the Edition's language.
 */
export const OriginLanguageSchema = z.strictObject({
  code: KebabCaseIdSchema,
  name: z.string().min(1),
});

export type OriginLanguage = z.infer<typeof OriginLanguageSchema>;

/** The kinds of Entry beside Words, each with a Mix kind weight. */
export const WeightedKindSchema = z.enum(['correction', 'idiom', 'synonymRow', 'tip']);

export type WeightedKind = z.infer<typeof WeightedKindSchema>;

/**
 * The band of rarities a Mood puts first in the Feed (ADR 0076): `upper` is
 * the Rarity Ceiling's rarity and the one below it, `lower` rarities 1 and 2,
 * `whole` every rarity; the bands clip to the Ceiling.
 */
export const RarityBandSchema = z.enum(['upper', 'lower', 'whole']);

export type RarityBand = z.infer<typeof RarityBandSchema>;

/**
 * How a Mood shifts the reader's Mix kind weight of a kind (ADR 0076): one
 * step towards «Менше», none, or one step towards «Більше», clamped to the
 * weights; a kind turned off in the Mix stays off.
 */
export const MoodShiftSchema = z.enum(['less', 'same', 'more']);

export type MoodShift = z.infer<typeof MoodShiftSchema>;

/**
 * A Mood («настрій») the Edition lists: its id, its name in the Edition's
 * language, its emoji, the reply the Dashboard's Mood check-in answers it
 * with, in the Edition's language, and its Feed parameters (ADR 0076): the
 * rarity band put first and a shift per kind. A mood that names neither
 * leaves the Feed as it is.
 */
export const MoodSchema = z.strictObject({
  id: KebabCaseIdSchema,
  name: z.string().min(1),
  emoji: z.string().min(1),
  reply: TextSchema,
  rarityBand: RarityBandSchema.default('whole'),
  shifts: z.partialRecord(WeightedKindSchema, MoodShiftSchema).default({}),
});

export type Mood = z.infer<typeof MoodSchema>;

/** How the Game picks Distractors for a Round. */
export const DistractorRuleSchema = z.enum(['same-part-of-speech']);

export type DistractorRule = z.infer<typeof DistractorRuleSchema>;

/** One lower-case letter. */
const LowerCaseLetterSchema = z.string().regex(/^\p{Ll}$/u, 'Expected one lower-case letter');

/**
 * Letters authored as one string separated by spaces (a letter may span
 * several characters) and parsed into a list of unique letters.
 */

const LetterListSchema = z
  .string()
  .transform((letters) => letters.split(' ').filter((letter) => letter !== ''))
  .pipe(
    z
      .array(z.string())
      .min(1, 'Expected at least one letter')
      .refine((letters) => new Set(letters).size === letters.length, 'Expected unique letters'),
  );

export const LanguageTraitsSchema = z
  .strictObject({
    /** Whether the language marks Stress, so every Lemma must carry it. */
    marksStress: z.boolean(),
    /** The lowercase letters of the alphabet in alphabetical order. */
    alphabet: LetterListSchema,
    /**
     * The characters besides letters that a Lemma may hold, such as an
     * apostrophe or a hyphen. None when left out.
     */
    lemmaPunctuation: LetterListSchema.optional(),
    /**
     * The characters besides letters and a Lemma's punctuation that an
     * Idiom's expression may hold, such as the comma and dash of a proverb.
     * None when left out.
     */
    expressionPunctuation: LetterListSchema.optional(),
    /** The language tag used to sort text in the Edition's language. */
    sortLocale: LanguageTagSchema,
    distractorRule: DistractorRuleSchema,
    /**
     * The lowercase vowels, each a letter of the alphabet: the only letters
     * Stress may fall on. Required when the Edition marks Stress.
     */
    vowels: LetterListSchema.optional(),
    /**
     * The rows of the on-screen keyboard of the Daily Crossword, top to
     * bottom: every letter of the alphabet once. The alphabet in rows when
     * left out.
     */
    keyboard: z.array(LetterListSchema).min(1).optional(),
  })
  .superRefine(({ marksStress, alphabet, vowels, keyboard }, context) => {
    if (keyboard !== undefined) {
      const keys = keyboard.flat();
      keyboard.forEach((row, rowIndex) => {
        row.forEach((key, index) => {
          if (!alphabet.includes(key))
            context.addIssue({
              code: 'custom',
              path: ['keyboard', rowIndex, index],
              message: `"${key}" is not a letter of the alphabet`,
            });
        });
      });
      alphabet.forEach((letter) => {
        const count = keys.filter((key) => key === letter).length;
        if (count !== 1)
          context.addIssue({
            code: 'custom',
            path: ['keyboard'],
            message: `Expected "${letter}" once on the keyboard, found ${String(count)}`,
          });
      });
    }
    if (vowels === undefined) {
      if (marksStress) {
        context.addIssue({
          code: 'custom',
          path: ['vowels'],
          message: 'Required when the Edition marks Stress',
        });
      }
      return;
    }
    vowels.forEach((vowel, index) => {
      if (!alphabet.includes(vowel)) {
        context.addIssue({
          code: 'custom',
          path: ['vowels', index],
          message: `"${vowel}" is not a letter of the alphabet`,
        });
      }
    });
  });

export type LanguageTraits = z.infer<typeof LanguageTraitsSchema>;

/** One of the Edition's recorded voices that read Words; the reader picks one. */
export const NarratorVoiceSchema = z.strictObject({
  id: KebabCaseIdSchema,
  /** What the reader calls the voice, such as «Оксана». */
  name: z.string().min(1),
  /** What the voice sounds like, such as «Жіночий · спокійний». */
  description: z.string().min(1),
});

export type NarratorVoice = z.infer<typeof NarratorVoiceSchema>;

/**
 * The Word the voice screen reads in every Narrator Voice, by its Recording,
 * as the screen shows it: its syllables, the one that takes the Stress and
 * the caption under them, such as «за-гра́-ва · ім., ж. р.».
 */
export const NarratorVoiceSampleSchema = z
  .strictObject({
    word: WordIdSchema,
    syllables: z.array(z.string().min(1)).min(1),
    /** The index of the stressed syllable. */
    stressed: z.number().int().nonnegative(),
    caption: z.string().min(1),
  })
  .refine(({ syllables, stressed }) => stressed < syllables.length, {
    path: ['stressed'],
    message: 'Expected the stressed syllable to be one of the syllables',
  });

export type NarratorVoiceSample = z.infer<typeof NarratorVoiceSampleSchema>;

/**
 * The Edition's Narrator Voices, in their order, each id once, and the one
 * that reads without the reader's choice (ADR 0083).
 */
export const NarratorVoicesSchema = z
  .strictObject({
    default: KebabCaseIdSchema,
    voices: z.array(NarratorVoiceSchema).min(1),
    sample: NarratorVoiceSampleSchema,
  })
  .superRefine(({ default: chosen, voices }, context) => {
    const ids = new Set<string>();
    voices.forEach(({ id }, index) => {
      if (ids.has(id))
        context.addIssue({
          code: 'custom',
          path: ['voices', index, 'id'],
          message: `Expected each Narrator Voice id once, got ${id} again`,
        });
      ids.add(id);
    });
    if (!ids.has(chosen))
      context.addIssue({
        code: 'custom',
        path: ['default'],
        message: `Expected one of the Narrator Voices, got ${chosen}`,
      });
  });

/**
 * The states an Edition declares a Feature Switch in (ADR 0089): `on`, in
 * effect unless a Rule turns it off; `off`, shipped and ready, off until a
 * Rule turns it on; `unavailable`, the Edition has no content or assets for
 * it, and nothing turns it on.
 */
export const FeatureSwitchStateSchema = z.enum(['on', 'off', 'unavailable']);

export type FeatureSwitchState = z.infer<typeof FeatureSwitchStateSchema>;

/** The Edition's state of every Core feature's Feature Switch (ADR 0089). */
export const FeatureSwitchesSchema = z.strictObject({
  game: FeatureSwitchStateSchema,
  corrections: FeatureSwitchStateSchema,
  /** Idioms: the third kind of Entry, idioms and place names (ADR 0046). */
  idioms: FeatureSwitchStateSchema,
  /** Synonym Rows: the fourth kind of Entry, a dominant word and a row of its synonyms (ADR 0051). */
  synonymRows: FeatureSwitchStateSchema,
  /** Tips: the fifth kind of Entry, rules of good speech (ADR 0051). */
  tips: FeatureSwitchStateSchema,
  /** The Account, under the Edition's `accountName`: its Settings row, its screen and the backend's answers to it. */
  account: FeatureSwitchStateSchema,
  /** Sign in with Google: the second Sign-in method, its button and the backend's procedure for it (ADR 0047). */
  googleSignIn: FeatureSwitchStateSchema,
  /** Sign in with Apple: the third Sign-in method, its button on iOS and the backend's procedure for it. */
  signInWithApple: FeatureSwitchStateSchema,
  /** Sync: the background exchange of the reader's words with their Account. Apart from `account`, so Sync can stop while sign-in keeps working. */
  sync: FeatureSwitchStateSchema,
  /** Content updates: the app's daily check for a newer Language Pack. */
  contentUpdates: FeatureSwitchStateSchema,
  /** Notifications: the daily reminders the Core plans (ADR 0021). */
  notifications: FeatureSwitchStateSchema,
  /** The home-screen widget: the Widget Snapshot and the widget it feeds. */
  widget: FeatureSwitchStateSchema,
  /** The widget goal ring: today's Daily Goal progress and the Streak on the medium widget, in the Widget Snapshot. */
  widgetGoalRing: FeatureSwitchStateSchema,
  /** The lock-screen widget: its families in the widget extension and its content in the Widget Snapshot. */
  lockScreenWidget: FeatureSwitchStateSchema,
  /** Share Cards: the buttons that make and share an image of an Entry. */
  shareCards: FeatureSwitchStateSchema,
  /** Pronunciation: the buttons that play a Word's audio. */
  pronunciation: FeatureSwitchStateSchema,
  /** «Голос диктора»: the reader's choice of the Narrator Voice that reads; off while `pronunciation` is, and off the default voice reads (ADR 0083). */
  narratorVoice: FeatureSwitchStateSchema,
  /** The Word of the Day: its pick, its notification and its widget. */
  wordOfTheDay: FeatureSwitchStateSchema,
  /** The statistics screens and the Streak. */
  statistics: FeatureSwitchStateSchema,
  /** Knowledge Marks: the Known / Unknown marks on Words, Corrections and Idioms, and the Review they feed. */
  knowledge: FeatureSwitchStateSchema,
  /** The confirmed-Entry counts the Profile and the Badges show; with it off they are hidden and nothing is confirmed, while Review goes on under `knowledge` (ADR 0043). */
  confirmedEntries: FeatureSwitchStateSchema,
  /** Self-check: the setting that hides a card's meaning until the reader reveals it. */
  selfCheck: FeatureSwitchStateSchema,
  /** The Rarity Ceiling: the one «Рідкість» setting every surface obeys. Off, every Word up to rarity 5 is in, as before 1.0. */
  rarityCeiling: FeatureSwitchStateSchema,
  /** Game Review: the list of every Round on the Game's result. */
  gameReview: FeatureSwitchStateSchema,
  /** The Game Mode «Вгадай слово» (`guess-word`); off while `game` is (ADR 0052). */
  gameGuessWord: FeatureSwitchStateSchema,
  /** The Game Mode «Обери правильне» (`correction`); off while `game` is (ADR 0052). */
  gameCorrection: FeatureSwitchStateSchema,
  /** The Game Mode «Наголос» (`stress`); off while `game` is (ADR 0052). */
  gameStress: FeatureSwitchStateSchema,
  /** The Game Mode «Пари» (`pairs`); off while `game` is (ADR 0052). */
  gamePairs: FeatureSwitchStateSchema,
  /** The Game Mode «Виживання» (`survival`); off while `game` is (ADR 0052). */
  gameSurvival: FeatureSwitchStateSchema,
  /** The Game Mode «На час» (`timed`); off while `game` is (ADR 0052). */
  gameTimed: FeatureSwitchStateSchema,
  /** The Game Mode «Фразеологізми» (`idiom-meaning`); off while `game` is (ADR 0052). */
  gameIdiomMeaning: FeatureSwitchStateSchema,
  /** The Game Mode «Англіцизми» (`anglicism`); off while `game` is (ADR 0052). */
  gameAnglicism: FeatureSwitchStateSchema,
  /** The Game Mode «Склади вислів» (`build-idiom`); off while `game` is (ADR 0052). */
  gameBuildIdiom: FeatureSwitchStateSchema,
  /** The Game Mode «Впиши слово» (`type-word`); off while `game` is (ADR 0052). */
  gameTypeWord: FeatureSwitchStateSchema,
  /** The Game Mode «Анаграми» (`anagram`); off while `game` is (ADR 0052). */
  gameAnagram: FeatureSwitchStateSchema,
  /** The Game Mode «За буквами» (`by-letters`); off while `game` is (ADR 0052). */
  gameByLetters: FeatureSwitchStateSchema,
  /** The Game Mode «Звідки слово» (`origin`); off while `game` is (ADR 0052). */
  gameOrigin: FeatureSwitchStateSchema,
  /** The Daily Crossword; off while `game` is (ADR 0052). */
  dailyCrossword: FeatureSwitchStateSchema,
  /** Search: its header button and screen over every non-Retired, non-Hidden Entry (ADR 0054). */
  search: FeatureSwitchStateSchema,
  /** The Rarity Test: the short test that sets the Rarity Ceiling (ADR 0054, 0072). */
  rarityTest: FeatureSwitchStateSchema,
  /** The Weekly Recap «Твій тиждень»: the Monday Feed Notice about the week before (ADR 0054). */
  weeklyRecap: FeatureSwitchStateSchema,
  /** Yesterday: the Feed Notice «Пам'ятаєш вчорашнє слово?» (ADR 0054). */
  yesterday: FeatureSwitchStateSchema,
  /** The Word of the Day archive «Слова дня» in Saved (ADR 0054). */
  wordOfTheDayArchive: FeatureSwitchStateSchema,
  /** The Active Days calendar on the statistics screen (ADR 0054). */
  activeDaysCalendar: FeatureSwitchStateSchema,
  /** The polite pause: the notification plan stops 14 days after the last open, with the Edition's farewell (ADR 0054). */
  politePause: FeatureSwitchStateSchema,
  /** The first week: one intro Feed Notice on each of a new reader's first 7 Active Days (ADR 0054). */
  firstWeek: FeatureSwitchStateSchema,
  /** The widget hint: the sheet after the first finished Game and the guide to adding the widget (ADR 0054). */
  widgetHint: FeatureSwitchStateSchema,
  /** «Сезонний декор»: the Decor motif of the local date's Holiday or Season, and its setting (ADR 0055). */
  seasonalDecor: FeatureSwitchStateSchema,
  /** The falling Stress: the Stress mark of a Word card's Lemma falls onto its vowel (ADR 0055). */
  stressAnimation: FeatureSwitchStateSchema,
  /** Illustrations: the Illustration a Word may carry above its Definition (ADR 0055). */
  illustrations: FeatureSwitchStateSchema,
  /** Mistake Reports: the Entry card's menu item, its sheet and the queue that sends them (ADR 0056). */
  mistakeReports: FeatureSwitchStateSchema,
  /** Community Counters: the line under the mark buttons and the changes the device sends (ADR 0060). */
  communityCounters: FeatureSwitchStateSchema,
  /** The Community Word «Слово тижня спільноти»: its Monday Feed Notice (ADR 0060). */
  communityWord: FeatureSwitchStateSchema,
  /** Analytics: the product events sent through the Core's port while the reader shares anonymous statistics (ADR 0068). */
  analytics: FeatureSwitchStateSchema,
  /** The calligraphic Lemma: the Lemma on the Word of the Day card in the Feed set in the Edition's calligraphic font. */
  calligraphy: FeatureSwitchStateSchema,
  /** Spotlight: the Spotlight Snapshot the app writes into the system search; off, the snapshot is empty (ADR 0057). */
  spotlight: FeatureSwitchStateSchema,
  /** App Intents: «Слово дня» and «Відкрити гру» open the Word of the Day card and the Game; off, they open the app's start (ADR 0057). */
  appIntents: FeatureSwitchStateSchema,
  /** Collection Links: «Поділитися посиланням» on a Collection and the `c/<id>` links that open its copy (ADR 0058). */
  collectionLinks: FeatureSwitchStateSchema,
  /** A Word from the widget's link takes the place of the open Entry, so «Назад» returns to the Feed. */
  replaceOpenEntry: FeatureSwitchStateSchema,
  /** The Mix kind weights: «Менше», «Звичайно» or «Більше» for each kind beside Words, which space its Feed turns; off, every kind keeps its turn of 0.9. */
  mixKindWeights: FeatureSwitchStateSchema,
  /** The XP log: XP for Game learning actions, kept per Edition, and the XP bar on the Feed (ADR 0066). */
  xpLog: FeatureSwitchStateSchema,
  /** Streak freezes: a held freeze covers a missed day automatically, 2 at the start, one more per 7 Streak days, at most 2 held (ADR 0066). */
  streakFreezes: FeatureSwitchStateSchema,
  /** The Break: the reader pauses the Streak for up to 7 days, once every 30 days, free; its days keep the Streak and add nothing (ADR 0066). */
  streakBreak: FeatureSwitchStateSchema,
  /** The Quick Question: every Nth Feed card asks one Round from an enabled Game Mode over an Eligible Entry; off, the Feed of 0.9. */
  quickQuestion: FeatureSwitchStateSchema,
  /** The onboarding step «ГРАЙ!» after the first Word, which shows the Games; off while `game` is (ADR 0067). */
  playStep: FeatureSwitchStateSchema,
  /** Levels: the Level derived from total XP, its Edition name and the level-milestone Feed Notices (ADR 0066). */
  levels: FeatureSwitchStateSchema,
  /** «Без лічильників»: the setting hides XP, Level, Streak, celebrations, level milestones and in-Game XP feedback while counting goes on; off, «Приховати Серію» of 0.9, which hides only the Streak (ADR 0066). */
  noCounters: FeatureSwitchStateSchema,
  /** The Daily Goal: its Settings row, its progress on the XP bar and its celebration trigger (ADR 0066). */
  dailyGoal: FeatureSwitchStateSchema,
  /** The Seen-Word XP: 1 XP for each Word Seen for the first time, up to the day's Daily Goal; off, viewing earns nothing. */
  seenWordXp: FeatureSwitchStateSchema,
  /** The Feed Notice «Може, на сьогодні досить?» once a local day after 50 distinct Seen Entries (ADR 0066). */
  enoughForToday: FeatureSwitchStateSchema,
  /** The onboarding questions «Як добре ти знаєш мову?» and «Навіщо», their Feed settings and their anonymous counters (ADR 0067, 0068). */
  questionnaire: FeatureSwitchStateSchema,
  /** Badges: kept milestones from the Core's catalogue of conditions, chosen and named by the Edition (ADR 0066). */
  badges: FeatureSwitchStateSchema,
  /** The Level ladder of the Profile: one card per Level name with its range of Levels, and the bar to the next name (spec #1641, ADR 0085); off while `xpLog` is. */
  levelLadder: FeatureSwitchStateSchema,
  /** The new Level screen: the full red ground with the Level stamped in, at every new Level, in place of the Mascot celebration (ADR 0085); off while `xpLog` is. */
  newLevelScreen: FeatureSwitchStateSchema,
  /** The Badge sheet: a tap on any Badge opens its name, date or progress, and an unearned one answers with a toast (ADR 0085); off while `xpLog` or `badges` is. */
  badgeSheet: FeatureSwitchStateSchema,
  /** The Badge toast: a Badge earned during a Game shows a toast in place of the stamp (ADR 0085); off while `xpLog` or `badges` is. */
  badgeToast: FeatureSwitchStateSchema,
  /** The Streak freeze card of the Profile: the freezes held, the last 7 days and the days saved (ADR 0085); off while `xpLog` is. */
  streakFreezeCard: FeatureSwitchStateSchema,
  /** The Break card of the Profile while a Break runs: its dates, a 14-day strip and the next Break's date (ADR 0085); off while `xpLog` is. */
  breakCard: FeatureSwitchStateSchema,
  /** The Active Days calendar's day lines: a tap on a day tells what happened on it (ADR 0085); off while `xpLog` is. */
  calendarDayLines: FeatureSwitchStateSchema,
  /** The Share Cards of a Level reached, a Badge earned and a Streak milestone; off while `shareCards` or `xpLog` is. */
  progressShareCards: FeatureSwitchStateSchema,
  /** The Share Card of a solved Daily Crossword, its grid with no letters; off while `shareCards` or `dailyCrossword` is. */
  dailyCrosswordShare: FeatureSwitchStateSchema,
  /** The traced Daily Crossword: a 5 × 5 grid full of letters whose hidden Words the reader traces; off, the typed one (ADR 0073). Off while `dailyCrossword` is. */
  tracedCrossword: FeatureSwitchStateSchema,
  /** The crossing Daily Crossword: a 5 × 5 crossword with blocks, numbered cells and pre-filled letters, played one clue at a time on the Letter Wheel (ADR 0087); off, the traced one stays. Off while `dailyCrossword` is. */
  crossingCrossword: FeatureSwitchStateSchema,
  /** «Підказка»: the Crossword Hint, which fills one letter of the current Word, costs nothing and marks the day as hinted (ADR 0087); off while `crossingCrossword` is. */
  crosswordHint: FeatureSwitchStateSchema,
  /** The Solve time: the on-screen seconds of the Daily Crossword, kept with its XP log record and shown on the solved card (ADR 0087); off while `crossingCrossword` is. */
  crosswordSolveTime: FeatureSwitchStateSchema,
  /** The solved screen of the Daily Crossword, «Розгадано!» with its share buttons (ADR 0087); off while `crossingCrossword` is. */
  crosswordSolvedScreen: FeatureSwitchStateSchema,
  /** The full-screen Badge stamp after a solved Daily Crossword that earns a Badge (ADR 0087); off while `crossingCrossword` or `badges` is. */
  crosswordBadgeStamp: FeatureSwitchStateSchema,
  /** The inline answer card of a Game Round, in place of the bottom sheet (spec #1674); off while `game` is. */
  gameAnswerCard: FeatureSwitchStateSchema,
  /** The letter tiles of «За буквами»: tiles with decoys tapped into the slots, in place of the text field (spec #1674); off while `gameByLetters` is. */
  letterTiles: FeatureSwitchStateSchema,
  /** The streak counter of «Виживання»: the right answers in a row and the record (spec #1674); off while `gameSurvival` is. */
  survivalStreak: FeatureSwitchStateSchema,
  /** The «Фініш» poster at the end of a Game and a time-up (spec #1674); off while `game` is. */
  finishPoster: FeatureSwitchStateSchema,
  /** The evening notification: at most 2 a day, the morning Word of the Day and one evening slot with the Streak warning or the unmet Daily Goal, or nothing; off, a Word at every Notification time. */
  eveningNotification: FeatureSwitchStateSchema,
  /** The farewell: the polite pause ends with the Edition's farewell on the 14th day without an open; off, it ends in silence. */
  notificationFarewell: FeatureSwitchStateSchema,
  /** The notification explainer: the sheet before the system permission prompt, after the first met Daily Goal or on day 3, and its one re-ask Feed Notice 7 days after a refusal. */
  notificationExplainer: FeatureSwitchStateSchema,
  /** «Коли нагадати?»: the onboarding step after the Daily Goal that sets the one Notification time or none; off while `notifications` is. */
  notificationTimeStep: FeatureSwitchStateSchema,
  /** The later questions through Feed Notices (the interests, the self-rating, the Mix review, the Rarity Test offer and, for an existing reader, the Daily Goal) and the questionnaire retake in Settings (ADR 0067). */
  laterQuestions: FeatureSwitchStateSchema,
  /** The Profile: the screen of the reader's whole progress and the save-progress Feed Notice (ADR 0066). */
  profile: FeatureSwitchStateSchema,
  /** The Mascot: the Edition's silent figure with its short lines (CONTEXT.md, Mascot). */
  mascot: FeatureSwitchStateSchema,
  /** The Interface sounds (a shout, a right answer, a wrong answer, a tap) and the «Звуки» setting (ADR 0070). */
  sounds: FeatureSwitchStateSchema,
  /** «Менше руху»: the Settings switch that turns every animation into its calmer variant, as the system's Reduce Motion does (ADR 0055). */
  reduceMotion: FeatureSwitchStateSchema,
  /** The fast reveal: in one visit to the Feed the first Entry card plays the full reveal and every next card a fast one; off, every card plays the full reveal. */
  fastReveal: FeatureSwitchStateSchema,
  /** The Dashboard: the home behind the «Стрічка» tab, with the Word of the Day hero; off, the Feed is the home (ADR 0076). Off while `wordOfTheDay` is. */
  dashboard: FeatureSwitchStateSchema,
  /** The Mood check-in: the Dashboard block that asks «Як настрій?» once a day (ADR 0076). Off while `dashboard` is. */
  mood: FeatureSwitchStateSchema,
  /** «Попередні слова»: the Dashboard block with the three newest Word of the Day archive days before today (ADR 0076). Off while `dashboard` or `wordOfTheDayArchive` is. */
  previousWords: FeatureSwitchStateSchema,
  /** The Correction Types rail: the Dashboard's tile per Correction Type with its screen (ADR 0076). Off while `dashboard` or `corrections` is. */
  correctionTypes: FeatureSwitchStateSchema,
  /** Curated Collections: the Dashboard's «Добірки» rail of editorial Entry sets from the Language Pack (ADR 0076). Off while `dashboard` is. */
  curatedCollections: FeatureSwitchStateSchema,
  /** Swipe marks: the reader swipes an Entry card right for Known and left for Unknown, with an undo; off, the card's mark buttons stay. Off while `knowledge` is. */
  swipeMarks: FeatureSwitchStateSchema,
  /** Word tabs: every Entry card in a fixed-height frame (ADR 0091), the Word of the Day's once it is open, with tabs under its head: a Word's «Суть», «Приклад», «Зв’язки» and «Історія», a Correction's «Як краще», «Чому» and «Приклади», an Idiom's «Суть», «Звідки» and «Приклад», a Tip's «Суть» and «Приклад»; a Synonym Row's in the same frame. Content too tall for the frame shrinks a font size at a time, then is clamped under «Детальніше», which opens it whole. The Word of the Day card is the red card while Self-check keeps it closed; the Feed's header draws no XP bar. Off, the cards are one column, the Word's with «Детальніше». */
  wordTabs: FeatureSwitchStateSchema,
  /** The Search button of the Feed's header, which opens the Search screen; Search itself stays under `search`. Off while `search` is. */
  searchButton: FeatureSwitchStateSchema,
  /** The Feed header's wordmark as a button that opens the Dashboard (ADR 0079). Off while `dashboard` is. */
  dashboardWordmark: FeatureSwitchStateSchema,
  /** The «Стрічка» tab opens the Feed, not the Dashboard, which stays the home at launch (ADR 0093). Off while `dashboard` is. */
  feedTab: FeatureSwitchStateSchema,
  /** Category screens: the Dashboard's «Категорії» rail of Categories of Words, their grid and each one's screen (ADR 0081). Off while `dashboard` is. */
  categoryScreens: FeatureSwitchStateSchema,
  /** The grid of the Categories of Corrections behind the «Виправлення» rail header and each one's screen (ADR 0081); off, the header is a plain title. Off while `dashboard` or `corrections` is. */
  correctionCategoryScreens: FeatureSwitchStateSchema,
  /** Quiet Categories: the quiet variant of a Category screen and the muted tile for a Category whose tone is `quiet` (ADR 0081); off, a quiet Category draws loud. Off while `categoryScreens` is. */
  quietCategories: FeatureSwitchStateSchema,
  /** The board style of the Collections: their list as the Category grid and a Collection's screen as a Category screen (ADR 0082); off, today's list and screen. */
  collectionBoardStyle: FeatureSwitchStateSchema,
  /** The Profile's confirmed Entries by rarity («Підтверджені записи за рідкістю»); off while `profile` or `confirmedEntries` is. */
  profileConfirmedByRarity: FeatureSwitchStateSchema,
  /** The Profile's Best result of each Game Mode («Найкраще в грі»); off while `profile` or `game` is. */
  profileGameBest: FeatureSwitchStateSchema,
});

/** A whole number of XP, which an Edition may set to 0 for an action that earns none. */
const XpAmountSchema = z.number().int().nonnegative();

/**
 * The XP table (ADR 0066): what each learning action earns. The amounts come
 * from the Edition config, so they change with an update and not with a Core
 * release; UA Edition: Round 1, finished Game +5, new Best result +5, the
 * Daily Crossword 15, a Review answer 1 with at most 10 a day, a Quick
 * Question 2.
 */
export const XpTableSchema = z.strictObject({
  /** A Round answered right. */
  round: XpAmountSchema,
  /** A finished Game with at least `finishedGameShare` of its answers right. */
  finishedGame: XpAmountSchema,
  /** The share of right answers a finished Game needs for its XP, 0.5 for «at least half». */
  finishedGameShare: z.number().min(0).max(1),
  /** A new Best result in a Game Mode. */
  bestResult: XpAmountSchema,
  /** The solved Daily Crossword, once a day. */
  dailyCrossword: XpAmountSchema,
  /** A Review answer, Known or Unknown. */
  reviewAnswer: XpAmountSchema,
  /** The most XP Review answers earn on one local day. */
  reviewDailyCap: XpAmountSchema,
  /** A Quick Question answered right in the Feed. */
  quickQuestion: XpAmountSchema,
  /** A Word Seen for the first time, up to the day's Daily Goal. */
  seenWord: XpAmountSchema,
});

export type XpTable = z.infer<typeof XpTableSchema>;

/** A whole number of XP above 0, which a Level costs. */
const LevelCostSchema = z.number().int().positive();

/**
 * The Level curve and the Level names (ADR 0066): level 1 costs `first` XP,
 * each level up to `growingUntil` costs `growth` more than the one before
 * (0.1 for 10%), rounded to whole XP, and every later level costs `later`,
 * with no top. `names` holds one name per five levels, from level 0; the
 * last name stays for every level above. UA Edition: 50, 10% up to 10, 120.
 */
export const LevelsSchema = z.strictObject({
  first: LevelCostSchema,
  growth: z.number().nonnegative(),
  growingUntil: z.number().int().positive(),
  later: LevelCostSchema,
  names: z.array(TextSchema).min(1),
});

export type Levels = z.infer<typeof LevelsSchema>;

/** A threshold above 0 a Badge condition reaches. */
const BadgeThresholdSchema = z.number().int().positive();

/** The Game Mode ids a Badge condition counts in, at least one. */
const BadgeModesSchema = z.array(KebabCaseIdSchema).min(1);

/**
 * A condition from the Core's catalogue of Badge conditions (ADR 0066, 0085),
 * with its parameters: the Streak reaching `days`, `entries` confirmed
 * Entries, the first win (a finished Game with at least half right) in one
 * of `modes`, `days` Daily Crosswords in a row, `count` right Game answers in
 * `modes`, the first right Game answer on a Word of `rarity`, `level`, a
 * finished Game in one of `modes` with every Round right, and `count` right
 * answers in a row in `modes`, which a wrong answer in them breaks.
 */
export const BadgeConditionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('streak'), days: BadgeThresholdSchema }),
  z.strictObject({ kind: z.literal('confirmedEntries'), entries: BadgeThresholdSchema }),
  z.strictObject({ kind: z.literal('gameWin'), modes: BadgeModesSchema }),
  z.strictObject({ kind: z.literal('dailyCrosswordRun'), days: BadgeThresholdSchema }),
  z.strictObject({
    kind: z.literal('rightAnswers'),
    modes: BadgeModesSchema,
    count: BadgeThresholdSchema,
  }),
  z.strictObject({ kind: z.literal('rightOnRarity'), rarity: RaritySchema }),
  z.strictObject({ kind: z.literal('level'), level: BadgeThresholdSchema }),
  z.strictObject({ kind: z.literal('flawlessGame'), modes: BadgeModesSchema }),
  z.strictObject({
    kind: z.literal('rightRun'),
    modes: BadgeModesSchema,
    count: BadgeThresholdSchema,
  }),
]);

export type BadgeCondition = z.infer<typeof BadgeConditionSchema>;

/** The shape of a Badge family's mark (ADR 0085; `checker`, ADR 0087). */
export const BadgeShapeSchema = z.enum([
  'hexagon',
  'shield',
  'circle',
  'tile',
  'wedge',
  'diamond',
  'checker',
]);

export type BadgeShape = z.infer<typeof BadgeShapeSchema>;

/** The tone a Badge family's earned mark is drawn in (ADR 0085). */
export const BadgeToneSchema = z.enum(['red', 'ink', 'cream']);

export type BadgeTone = z.infer<typeof BadgeToneSchema>;

/**
 * A Badge family the Edition declares (ADR 0085): its id, the name over its
 * Badges, the line that says what its Badges count, its mark's shape and
 * the tone an earned mark is drawn in.
 */
export const BadgeFamilySchema = z.strictObject({
  id: KebabCaseIdSchema,
  name: TextSchema,
  description: TextSchema,
  shape: BadgeShapeSchema,
  tone: BadgeToneSchema,
});

export type BadgeFamily = z.infer<typeof BadgeFamilySchema>;

/**
 * A Badge the Edition chooses (ADR 0066): its id, its name, the short symbol
 * its mark shows (at most three characters), the id of its Badge family
 * (ADR 0085), its condition from the catalogue and, optionally, its stamp's
 * kicker (ADR 0087).
 */
export const BadgeSchema = z.strictObject({
  id: KebabCaseIdSchema,
  name: TextSchema,
  symbol: TextSchema.max(3),
  family: KebabCaseIdSchema,
  condition: BadgeConditionSchema,
  /** The line over the Badge's name on its full-screen stamp, e.g. «7 ПОСПІЛЬ»; left out, none (ADR 0087). */
  stampKicker: TextSchema.optional(),
});

export type Badge = z.infer<typeof BadgeSchema>;

/**
 * The Mascot's short line for each moment it shows in: the onboarding, the
 * celebrations of a new Level, a Badge, the Daily Goal and a Streak
 * milestone, a right and a wrong Game answer, the Game's end, and an empty
 * state.
 */
export const MascotLinesSchema = z.strictObject({
  onboarding: TextSchema,
  newLevel: TextSchema,
  badge: TextSchema,
  dailyGoal: TextSchema,
  streakMilestone: TextSchema,
  gameRight: TextSchema,
  gameWrong: TextSchema,
  gameEnd: TextSchema,
  empty: TextSchema,
});

export type MascotLines = z.infer<typeof MascotLinesSchema>;

/** A moment the Mascot shows in, which picks its state and its line. */
export type MascotMoment = keyof MascotLines;

export type FeatureSwitches = z.infer<typeof FeatureSwitchesSchema>;

export type FeatureSwitch = keyof FeatureSwitches;

/** The user's light/dark choice. */
export const ThemeSchema = z.enum(['system', 'light', 'dark']);

/** A Mix kind weight: «Менше», «Звичайно» or «Більше» for a kind of Entry beside Words. */
export const MixKindWeightSchema = z.enum(['less', 'normal', 'more']);

export type MixKindWeight = z.infer<typeof MixKindWeightSchema>;

/** How often the Feed asks a Quick Question, a Mix setting: off, or every 20th, 10th or 6th card. */
export const QuickQuestionEverySchema = z.union([
  z.literal('off'),
  z.literal(20),
  z.literal(10),
  z.literal(6),
]);

export type QuickQuestionEvery = z.infer<typeof QuickQuestionEverySchema>;

export type Theme = z.infer<typeof ThemeSchema>;

export const FontSizeSchema = z.enum(['S', 'M', 'L', 'XL']);

export type FontSize = z.infer<typeof FontSizeSchema>;

/**
 * The Daily Goal (ADR 0074): the Words the reader aims to see on a local day.
 * It replaces the Daily Limit of ADR 0054.
 */
export const DailyGoalSchema = z.int().positive();

export type DailyGoal = z.infer<typeof DailyGoalSchema>;

/** The Daily Goals the reader chooses from, in rising order, and the one highlighted (ADR 0074). */
export const DailyGoalsSchema = z
  .strictObject({
    options: z
      .array(DailyGoalSchema)
      .min(1)
      .refine(
        (options) =>
          options.every((goal, index) => index === 0 || goal > (options[index - 1] ?? 0)),
        'Expected the Daily Goals in rising order, each once',
      ),
    highlighted: DailyGoalSchema,
  })
  .refine(({ options, highlighted }) => options.includes(highlighted), {
    path: ['highlighted'],
    message: 'Expected the highlighted Daily Goal among the options',
  });

export type DailyGoals = z.infer<typeof DailyGoalsSchema>;

/** A local time of day, `HH:MM` on a 24-hour clock. */
export const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a 24-hour time such as 09:00');

/**
 * The three Notification times «Коли нагадати?» offers, one for each bucket
 * it is counted in, in time order (ADR 0067).
 */
export const OnboardingNotificationTimesSchema = z
  .strictObject({ morning: TimeOfDaySchema, midday: TimeOfDaySchema, evening: TimeOfDaySchema })
  .refine(
    ({ morning, midday, evening }) => morning < midday && midday < evening,
    'Expected the morning, midday and evening times in time order',
  );

export type OnboardingNotificationTimes = z.infer<typeof OnboardingNotificationTimesSchema>;

/** The most notification times a user may have. */
export const MAX_NOTIFICATION_TIMES = 10;

/**
 * A user's notification times: valid, no two equal and at most
 * `MAX_NOTIFICATION_TIMES`. The order is not checked here: the Edition's
 * defaults are sorted when the config is read, and the user's list is kept in
 * time order by whoever writes it.
 */
export const NotificationTimesSchema = z
  .array(TimeOfDaySchema)
  .max(MAX_NOTIFICATION_TIMES)
  .refine((times) => new Set(times).size === times.length, 'Expected unique times');

export const MixConfigSchema = z.strictObject({
  /** Either every Category of the Language Pack, also one a content update adds, or the listed Category ids. */
  categories: z.union([
    z.literal('all'),
    // At least one Category always stays in the Mix (ADR 0019).
    z.array(KebabCaseIdSchema).min(1, 'Expected at least one Category'),
  ]),
  /**
   * The Categories of Corrections in the Mix (ADR 0033): every one of the
   * Language Pack, or the listed ids. They sit under Corrections as a whole.
   */
  correctionCategories: z.union([
    z.literal('all'),
    // At least one Category of Corrections always stays in the Mix, as of Words (ADR 0019).
    z.array(KebabCaseIdSchema).min(1, 'Expected at least one Category of Corrections'),
  ]),
  /** Whether Corrections, as a whole, are in the Mix. */
  corrections: z.boolean(),
  /** Whether Idioms, as a whole, are in the Mix. */
  idioms: z.boolean(),
  /** Whether Synonym Rows, as a whole, are in the Mix (ADR 0051). */
  synonymRows: z.boolean(),
  /** Whether Tips, as a whole, are in the Mix (ADR 0051). */
  tips: z.boolean(),
});

export type MixConfig = z.infer<typeof MixConfigSchema>;

/** The settings a new user starts with. */
export const UserSettingDefaultsConfigSchema = z.strictObject({
  theme: ThemeSchema,
  fontSize: FontSizeSchema,
  /** Whether haptics are on for a new user. */
  vibration: z.boolean(),
  /** The default notification times, kept in time order. */
  notificationTimes: NotificationTimesSchema.transform((times) => [...times].sort()),
  /** The Rarity Ceiling a new user starts with, «до 1» to «до 5» (ADR 0072). */
  rarityCeiling: RaritySchema,
  mix: MixConfigSchema,
});

export type UserSettingDefaultsConfig = z.infer<typeof UserSettingDefaultsConfigSchema>;

/** The file name of a font among an Edition's fonts, in its `assets/fonts/` folder. */
const FontFileSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*\.(ttf|otf)$/,
    'Expected a plain file name ending in .ttf or .otf',
  );

/** The relative luminance of a `#RRGGBB` colour, as WCAG 2 defines it. */
function relativeLuminance(color: string): number {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The WCAG 2 contrast ratio of two `#RRGGBB` colours, from 1 to 21. */
function contrastRatio(first: string, second: string): number {
  const [lighter = 0, darker = 0] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** The least contrast of text with its background, WCAG AA for body text. */
const MINIMUM_CONTRAST = 4.5;

/** A background of the widget and the colour of its text, at least 4.5:1 apart (WCAG AA). */
const WidgetBackgroundSchema = z
  .strictObject({ background: HexColorSchema, text: HexColorSchema })
  .refine(({ background, text }) => contrastRatio(background, text) >= MINIMUM_CONTRAST, {
    path: ['text'],
    message: `Expected text at least ${String(MINIMUM_CONTRAST)}:1 in contrast with its background (WCAG AA)`,
  });

/**
 * The widget palette: the colours of the widget's Пергамент and Синій
 * backgrounds (ADR 0026). Світлий and Темний take the Edition's light and
 * dark colour tokens.
 */
const WidgetPaletteSchema = z.strictObject({
  parchment: WidgetBackgroundSchema,
  blue: WidgetBackgroundSchema,
});

/** The id of an Edition, e.g. `uk`. */
export const EditionIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, 'Expected a lowercase id');

/**
 * The steps of the onboarding, in order (ADR 0067): the one place that has
 * them, so a step that joins changes the count everywhere. The first Word
 * comes only with a Word of the Day, «ГРАЙ!» only with `playStep`, the two
 * questions only with the `questionnaire` Feature Switch, the Daily Goal only
 * with `dailyGoal`, «Коли нагадати?» only with `notificationTimeStep`.
 */
export const ONBOARDING_STEPS = [
  'welcome',
  'firstWord',
  'playStep',
  'level',
  'why',
  'dailyGoal',
  'notificationTime',
] as const;

/** A step of the onboarding. */
export type OnboardingStepKind = (typeof ONBOARDING_STEPS)[number];

/** The questions the onboarding asks (ADR 0067): «Як добре ти знаєш мову?» and «Навіщо». */
export const QuestionnaireQuestionSchema = z.enum(['level', 'why']);

export type QuestionnaireQuestion = z.infer<typeof QuestionnaireQuestionSchema>;

/** The id of an option of a questionnaire question, e.g. `studying`. */
export const QuestionnaireAnswerIdSchema = KebabCaseIdSchema;

/**
 * The Edition's questionnaire (ADR 0067): the options of the level
 * question, each setting the Rarity Ceiling or opening the Rarity Test, of
 * «Навіщо», each setting the Mix kind weights it names (the others stay), and
 * of the self-rating. Ids are unique within a question.
 */
export const QuestionnaireSchema = z.strictObject({
  level: z
    .array(
      z.union([
        z.strictObject({
          id: QuestionnaireAnswerIdSchema,
          label: TextSchema,
          rarityCeiling: RaritySchema,
        }),
        /** «Не знаю»: the onboarding opens the Rarity Test, whose result sets the Rarity Ceiling. */
        z.strictObject({
          id: QuestionnaireAnswerIdSchema,
          label: TextSchema,
          rarityTest: z.literal(true),
        }),
      ]),
    )
    .min(1),
  why: z
    .array(
      z.strictObject({
        id: QuestionnaireAnswerIdSchema,
        label: TextSchema,
        kindWeights: z.partialRecord(WeightedKindSchema, MixKindWeightSchema),
      }),
    )
    .min(1),
  /**
   * The vocabulary self-rating, asked later through a Feed Notice: each
   * option only says whether to offer the Rarity Test (ADR 0072).
   */
  selfRating: z
    .array(
      z.strictObject({
        id: QuestionnaireAnswerIdSchema,
        label: TextSchema,
        offerRarityTest: z.boolean(),
      }),
    )
    .min(1),
});

export type Questionnaire = z.infer<typeof QuestionnaireSchema>;

/** Everything Edition-specific that the app and the Language Pack build need. */
export const EditionConfigSchema = z
  .strictObject({
    id: EditionIdSchema,
    locale: LanguageTagSchema,
    displayName: z.string().min(1),
    /** What the Account is called on every screen and in the Sign-in code email, never «SLOVO ID» by default. */
    accountName: TextSchema,
    languageTraits: LanguageTraitsSchema,
    featureSwitches: FeatureSwitchesSchema,
    userSettingDefaults: UserSettingDefaultsConfigSchema,
    /**
     * The file in the Edition's `assets/` folder that notifications play. The
     * app config checks the file itself; an Edition without one gets the
     * system default sound.
     */
    notificationSound: NotificationSoundFileSchema.optional(),
    /**
     * The font file, among the Edition's fonts, that sets the Lemma on the
     * Word of the Day card. The Edition check refuses a font without a glyph
     * for a letter of the alphabet, in either case, for the punctuation a
     * Lemma may hold, or for the Stress mark.
     */
    wordOfTheDayFont: FontFileSchema,
    /** The colours of the widget's Пергамент and Синій backgrounds (ADR 0026). */
    widgetPalette: WidgetPaletteSchema,
    /**
     * The Categories, in their order, as the Language Pack build writes them
     * into the pack. The app reads them from the pack only (ADR 0033).
     */
    categories: z.array(CategorySchema).min(1),
    /**
     * The Categories of Corrections, a list of their own beside the Words'
     * (ADR 0033), in their order, as the Language Pack build writes them into
     * the pack.
     */
    correctionCategories: z.array(CategorySchema).min(1),
    /**
     * The ids of the Categories whose Words must carry their history; the
     * Language Pack build refuses a Word in one of them without it. Empty
     * when no Category requires it.
     */
    categoriesRequiringHistory: z.array(KebabCaseIdSchema),
    /**
     * The languages Words come from, in their order (ADR 0052): the Edition
     * owns the list, so the Core stays language-agnostic. Empty when the
     * Edition gives no Word an origin.
     */
    originLanguages: z.array(OriginLanguageSchema),
    /**
     * The moods, in their order (ADR 0054): the Edition owns the list, so the
     * Core stays language-agnostic. It lists at least the four `dashboardMoods` name.
     */
    moods: z.array(MoodSchema),
    /**
     * The four moods the Dashboard's Mood check-in offers, by id among
     * `moods`, in display order (ADR 0076): exactly four.
     */
    dashboardMoods: z
      .array(KebabCaseIdSchema)
      .length(4, { message: 'The Dashboard lists exactly four moods' }),
    /**
     * The letters Search reads as another (ADR 0054), each lower-case letter
     * to the one it reads as, such as ґ to г: the Edition owns them, so the
     * Core stays language-agnostic. Empty when Search reads each letter as
     * itself.
     */
    searchLetters: z.record(LowerCaseLetterSchema, LowerCaseLetterSchema),
    /** The Narrator Voices that read Words (ADR 0083). */
    narratorVoices: NarratorVoicesSchema,
    /** The XP table: what each Game learning action earns (ADR 0066). */
    xp: XpTableSchema,
    /** The Level curve and the Level names (ADR 0066). */
    levels: LevelsSchema,
    /** The Daily Goals in Words the reader chooses from (ADR 0074). */
    dailyGoals: DailyGoalsSchema,
    /** The Notification times «Коли нагадати?» offers (ADR 0067). */
    onboardingNotificationTimes: OnboardingNotificationTimesSchema,
    /** The onboarding questions, their options and what each sets (ADR 0067). */
    questionnaire: QuestionnaireSchema,
    /** The Badge families, in their order, each id once (ADR 0085). */
    badgeFamilies: z
      .array(BadgeFamilySchema)
      .min(1)
      .refine(
        (families) => new Set(families.map(({ id }) => id)).size === families.length,
        'Expected each Badge family id once',
      ),
    /** The Badges, in their order, each id once, each of a declared family (ADR 0066, 0085). */
    badges: z
      .array(BadgeSchema)
      .refine(
        (badges) => new Set(badges.map(({ id }) => id)).size === badges.length,
        'Expected each Badge id once',
      ),
    /** The Mascot's line for each moment it shows in. */
    mascot: MascotLinesSchema,
  })
  .superRefine(
    (
      {
        categories,
        correctionCategories,
        categoriesRequiringHistory,
        originLanguages,
        moods,
        dashboardMoods,
        userSettingDefaults,
        questionnaire,
        badgeFamilies,
        badges,
      },
      context,
    ) => {
      const familyIds = new Set(badgeFamilies.map(({ id }) => id));
      badges.forEach(({ family }, index) => {
        if (!familyIds.has(family))
          context.addIssue({
            code: 'custom',
            path: ['badges', index, 'family'],
            message: `Unknown Badge family "${family}"`,
          });
      });
      for (const question of [...QuestionnaireQuestionSchema.options, 'selfRating'] as const) {
        const optionIds = new Set<string>();
        questionnaire[question].forEach(({ id }, index) => {
          if (optionIds.has(id)) {
            context.addIssue({
              code: 'custom',
              path: ['questionnaire', question, index, 'id'],
              message: `Duplicate option id "${id}"`,
            });
          }
          optionIds.add(id);
        });
      }
      const idsOf = (list: readonly Category[], field: 'categories' | 'correctionCategories') => {
        const ids = new Set<string>();
        list.forEach(({ id }, index) => {
          if (ids.has(id)) {
            context.addIssue({
              code: 'custom',
              path: [field, index, 'id'],
              message: `Duplicate Category id "${id}"`,
            });
          }
          ids.add(id);
        });
        return ids;
      };
      const known = {
        categories: idsOf(categories, 'categories'),
        correctionCategories: idsOf(correctionCategories, 'correctionCategories'),
      };
      categoriesRequiringHistory.forEach((id, index) => {
        if (!known.categories.has(id)) {
          context.addIssue({
            code: 'custom',
            path: ['categoriesRequiringHistory', index],
            message: `Unknown Category id "${id}"`,
          });
        }
      });
      const codes = new Set<string>();
      originLanguages.forEach(({ code }, index) => {
        if (codes.has(code)) {
          context.addIssue({
            code: 'custom',
            path: ['originLanguages', index, 'code'],
            message: `Duplicate origin language code "${code}"`,
          });
        }
        codes.add(code);
      });
      const moodIds = new Set<string>();
      moods.forEach(({ id }, index) => {
        if (moodIds.has(id)) {
          context.addIssue({
            code: 'custom',
            path: ['moods', index, 'id'],
            message: `Duplicate mood id "${id}"`,
          });
        }
        moodIds.add(id);
      });
      const dashboardMoodIds = new Set<string>();
      dashboardMoods.forEach((id, index) => {
        if (!moodIds.has(id) || dashboardMoodIds.has(id)) {
          context.addIssue({
            code: 'custom',
            path: ['dashboardMoods', index],
            message: moodIds.has(id) ? `Duplicate mood id "${id}"` : `Unknown mood id "${id}"`,
          });
        }
        dashboardMoodIds.add(id);
      });
      for (const field of ['categories', 'correctionCategories'] as const) {
        const inMix = userSettingDefaults.mix[field];
        if (inMix === 'all') continue;
        inMix.forEach((id, index) => {
          if (!known[field].has(id)) {
            context.addIssue({
              code: 'custom',
              path: ['userSettingDefaults', 'mix', field, index],
              message: `Unknown Category id "${id}"`,
            });
          }
        });
      }
    },
  );

export type EditionConfig = z.infer<typeof EditionConfigSchema>;
