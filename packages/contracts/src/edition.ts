import { z } from 'zod';

import { NotificationSoundFileSchema } from './notification-sound';
import { HexColorSchema } from './shared';

const KebabCaseIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case id');

/** A BCP 47 language tag, e.g. `uk` or `uk-UA`. */
const LanguageTagSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Expected a BCP 47 tag such as uk-UA');

/**
 * A thematic group of Words, or of Corrections, with its display name in the
 * Edition's language. The Words and the Corrections each have their own list
 * (ADR 0050).
 */
export const CategorySchema = z.strictObject({
  id: KebabCaseIdSchema,
  displayName: z.string().min(1),
});

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

/**
 * A Mood («настрій») a Word may carry (ADR 0054): its id, its name in the
 * Edition's language and its emoji.
 */
export const MoodSchema = z.strictObject({
  id: KebabCaseIdSchema,
  name: z.string().min(1),
  emoji: z.string().min(1),
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
  })
  .superRefine(({ marksStress, alphabet, vowels }, context) => {
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

/** Per-Edition on/off settings for Core features. */
export const FeatureSwitchesSchema = z.strictObject({
  game: z.boolean(),
  corrections: z.boolean(),
  /** Idioms: the third kind of Entry, idioms and place names (ADR 0046). */
  idioms: z.boolean(),
  /** Synonym Rows: the fourth kind of Entry, a dominant word and a row of its synonyms (ADR 0051). */
  synonymRows: z.boolean(),
  /** Tips: the fifth kind of Entry, rules of good speech (ADR 0051). */
  tips: z.boolean(),
  /** The Account (SLOVO ID): its Settings row, its screen and the backend's answers to it. */
  account: z.boolean(),
  /** Sign in with Google: the second Sign-in method, its button and the backend's procedure for it (ADR 0047). */
  googleSignIn: z.boolean(),
  /** Sync: the background exchange of the reader's words with their Account. Apart from `account`, so Sync can stop while sign-in keeps working. */
  sync: z.boolean(),
  /** Content updates: the app's daily check for a newer Language Pack. */
  contentUpdates: z.boolean(),
  /** Notifications: the daily reminders the Core plans (ADR 0021). */
  notifications: z.boolean(),
  /** The home-screen widget: the Widget Snapshot and the widget it feeds. */
  widget: z.boolean(),
  /** Share Cards: the buttons that make and share an image of an Entry. */
  shareCards: z.boolean(),
  /** Pronunciation: the buttons that play a Word's audio. */
  pronunciation: z.boolean(),
  /** The Word of the Day: its pick, its notification and its widget. */
  wordOfTheDay: z.boolean(),
  /** The statistics screens and the Streak. */
  statistics: z.boolean(),
  /** Knowledge Marks: the Known / Unknown marks on Words, Corrections and Idioms, and the Review they feed. */
  knowledge: z.boolean(),
  /** Self-check: the setting that hides a card's meaning until the reader reveals it. */
  selfCheck: z.boolean(),
  /** The Mix's Rarity Floor: the lowest rarity of the Words shown. */
  rarityFloor: z.boolean(),
  /** Game Review: the list of every Round on the Game's result. */
  gameReview: z.boolean(),
  /** The Game Mode «Вгадай слово» (`guess-word`); off while `game` is (ADR 0052). */
  gameGuessWord: z.boolean(),
  /** The Game Mode «Обери правильне» (`correction`); off while `game` is (ADR 0052). */
  gameCorrection: z.boolean(),
  /** The Game Mode «Наголос» (`stress`); off while `game` is (ADR 0052). */
  gameStress: z.boolean(),
  /** The Game Mode «Пари» (`pairs`); off while `game` is (ADR 0052). */
  gamePairs: z.boolean(),
  /** The Game Mode «Виживання» (`survival`); off while `game` is (ADR 0052). */
  gameSurvival: z.boolean(),
  /** The Game Mode «На час» (`timed`); off while `game` is (ADR 0052). */
  gameTimed: z.boolean(),
  /** The Game Mode «Фразеологізми» (`idiom-meaning`); off while `game` is (ADR 0052). */
  gameIdiomMeaning: z.boolean(),
  /** The Game Mode «Англіцизми» (`anglicism`); off while `game` is (ADR 0052). */
  gameAnglicism: z.boolean(),
  /** The Game Mode «Склади вислів» (`build-idiom`); off while `game` is (ADR 0052). */
  gameBuildIdiom: z.boolean(),
  /** The Game Mode «Впиши слово» (`type-word`); off while `game` is (ADR 0052). */
  gameTypeWord: z.boolean(),
  /** The Game Mode «Анаграми» (`anagram`); off while `game` is (ADR 0052). */
  gameAnagram: z.boolean(),
  /** The Game Mode «За буквами» (`by-letters`); off while `game` is (ADR 0052). */
  gameByLetters: z.boolean(),
  /** The Game Mode «Звідки слово» (`origin`); off while `game` is (ADR 0052). */
  gameOrigin: z.boolean(),
  /** The Daily Crossword; off while `game` is (ADR 0052). */
  dailyCrossword: z.boolean(),
  /** Search: its header button and screen over every non-Retired, non-Hidden Entry (ADR 0054). */
  search: z.boolean(),
  /** The Rarity Test: the short test that sets the Rarity Floor (ADR 0054). */
  rarityTest: z.boolean(),
  /** The Weekly Recap «Ваш тиждень»: the Monday Feed Notice about the week before (ADR 0054). */
  weeklyRecap: z.boolean(),
  /** Yesterday: the Feed Notice «Пам'ятаєте вчорашнє слово?» (ADR 0054). */
  yesterday: z.boolean(),
  /** The Word of the Day archive «Слова дня» in Saved (ADR 0054). */
  wordOfTheDayArchive: z.boolean(),
  /** The Active Days calendar on the statistics screen (ADR 0054). */
  activeDaysCalendar: z.boolean(),
  /** The Daily Limit: its setting and its Feed Notice (ADR 0054). */
  dailyLimit: z.boolean(),
  /** The polite pause: the notification plan stops 14 days after the last open, with the Edition's farewell (ADR 0054). */
  politePause: z.boolean(),
  /** The first week: one intro Feed Notice on each of a new reader's first 7 Active Days (ADR 0054). */
  firstWeek: z.boolean(),
  /** The widget hint: the sheet after the first finished Game and the guide to adding the widget (ADR 0054). */
  widgetHint: z.boolean(),
  /** Mood: the moods a Word may carry and «Слово під настрій» (ADR 0054). */
  moods: z.boolean(),
  /** «Сезонний декор»: the Decor motif of the local date's Holiday or Season, and its setting (ADR 0055). */
  seasonalDecor: z.boolean(),
  /** The falling Stress: the Stress mark of a Word card's Lemma falls onto its vowel (ADR 0055). */
  stressAnimation: z.boolean(),
  /** Illustrations: the Illustration a Word may carry above its Definition (ADR 0055). */
  illustrations: z.boolean(),
  /** Mistake Reports: the Entry card's menu item, its sheet and the queue that sends them (ADR 0056). */
  mistakeReports: z.boolean(),
  /** Community Counters: the line under the mark buttons and the changes the device sends (ADR 0060). */
  communityCounters: z.boolean(),
  /** The Community Word «Слово тижня спільноти»: its Monday Feed Notice (ADR 0060). */
  communityWord: z.boolean(),
  /** The calligraphic Lemma: the Lemma on the Word of the Day card in the Feed set in the Edition's calligraphic font. */
  calligraphy: z.boolean(),
  /** Spotlight: the Spotlight Snapshot the app writes into the system search; off, the snapshot is empty (ADR 0057). */
  spotlight: z.boolean(),
  /** App Intents: «Слово дня» and «Відкрити гру» open the Word of the Day card and the Game; off, they open the app's start (ADR 0057). */
  appIntents: z.boolean(),
  /** Collection Links: «Поділитися посиланням» on a Collection and the `c/<id>` links that open its copy (ADR 0058). */
  collectionLinks: z.boolean(),
});

export type FeatureSwitches = z.infer<typeof FeatureSwitchesSchema>;

export type FeatureSwitch = keyof FeatureSwitches;

/** The user's light/dark choice. */
export const ThemeSchema = z.enum(['system', 'light', 'dark']);

export type Theme = z.infer<typeof ThemeSchema>;

export const FontSizeSchema = z.enum(['S', 'M', 'L', 'XL']);

export type FontSize = z.infer<typeof FontSizeSchema>;

/**
 * The Daily Limit (ADR 0054): off, or the distinct Entries Seen on a local day
 * after which the Feed says «enough for today».
 */
export const DailyLimitSchema = z.union([
  z.literal('off'),
  z.literal(10),
  z.literal(20),
  z.literal(30),
]);

export type DailyLimit = z.infer<typeof DailyLimitSchema>;

/** A local time of day, `HH:MM` on a 24-hour clock. */
export const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a 24-hour time such as 09:00');

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
   * The Categories of Corrections in the Mix (ADR 0050): every one of the
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
  /** The Daily Limit a new user starts with. */
  dailyLimit: DailyLimitSchema,
  /** The default notification times, kept in time order. */
  notificationTimes: NotificationTimesSchema.transform((times) => [...times].sort()),
  mix: MixConfigSchema,
});

export type UserSettingDefaultsConfig = z.infer<typeof UserSettingDefaultsConfigSchema>;

/**
 * A domain such as `slovo.example`: dot-separated lower-case labels of letters,
 * digits and inner hyphens, ending in a top-level domain of letters.
 */
const DomainSchema = z
  .string()
  .regex(
    /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/,
    'Expected a lower-case domain such as slovo.example',
  );

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

/** Everything Edition-specific that the app and the Language Pack build need. */
export const EditionConfigSchema = z
  .strictObject({
    id: EditionIdSchema,
    locale: LanguageTagSchema,
    displayName: z.string().min(1),
    bundleId: z
      .string()
      .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, 'Expected a reverse-DNS bundle id'),
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
     * The domain of the Edition's Collection Links, `https://<linkDomain>/c/<id>`
     * (ADR 0058): the backend builds each link's URL from it, and the app config
     * turns it into the associated domains entitlement.
     */
    linkDomain: DomainSchema,
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
     * (ADR 0050), in their order, as the Language Pack build writes them into
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
     * Core stays language-agnostic. Empty when the Edition has no moods.
     */
    moods: z.array(MoodSchema),
    /**
     * The letters Search reads as another (ADR 0054), each lower-case letter
     * to the one it reads as, such as ґ to г: the Edition owns them, so the
     * Core stays language-agnostic. Empty when Search reads each letter as
     * itself.
     */
    searchLetters: z.record(LowerCaseLetterSchema, LowerCaseLetterSchema),
  })
  .superRefine(
    (
      {
        categories,
        correctionCategories,
        categoriesRequiringHistory,
        originLanguages,
        moods,
        userSettingDefaults,
      },
      context,
    ) => {
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

/**
 * The App Group an Edition's app shares with its widget (ADR 0026), derived
 * from the bundle id, so each Edition's widget reads only its own app's data.
 */
export const editionAppGroup = (bundleId: string) => `group.${bundleId}`;
