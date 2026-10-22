import { z } from 'zod';

import { NotificationSoundFileSchema } from './notification-sound';

const KebabCaseIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case id');

/** A BCP 47 language tag, e.g. `uk` or `uk-UA`. */
const LanguageTagSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Expected a BCP 47 tag such as uk-UA');

/** A thematic group of Words, with its display name in the Edition's language. */
export const CategorySchema = z.strictObject({
  id: KebabCaseIdSchema,
  displayName: z.string().min(1),
});

export type Category = z.infer<typeof CategorySchema>;

/** How the Game picks Distractors for a Round. */
export const DistractorRuleSchema = z.enum(['same-part-of-speech']);

export type DistractorRule = z.infer<typeof DistractorRuleSchema>;

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
  /** The Account (SLOVO ID): its Settings row, its screen and the backend's answers to it. */
  account: z.boolean(),
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
  /** Knowledge Marks: the Known / Unknown marks on Words and Corrections, and the Review they feed. */
  knowledge: z.boolean(),
  /** Self-check: the setting that hides a card's meaning until the reader reveals it. */
  selfCheck: z.boolean(),
  /** The Mix's Rarity Floor: the lowest rarity of the Words shown. */
  rarityFloor: z.boolean(),
  /** Game Review: the list of every Round on the Game's result. */
  gameReview: z.boolean(),
});

export type FeatureSwitches = z.infer<typeof FeatureSwitchesSchema>;

export type FeatureSwitch = keyof FeatureSwitches;

/** The user's light/dark choice. */
export const ThemeSchema = z.enum(['system', 'light', 'dark']);

export type Theme = z.infer<typeof ThemeSchema>;

export const FontSizeSchema = z.enum(['S', 'M', 'L', 'XL']);

export type FontSize = z.infer<typeof FontSizeSchema>;

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
  /** Whether Corrections, as a whole, are in the Mix. */
  corrections: z.boolean(),
  /** Whether Idioms, as a whole, are in the Mix. */
  idioms: z.boolean(),
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
  mix: MixConfigSchema,
});

export type UserSettingDefaultsConfig = z.infer<typeof UserSettingDefaultsConfigSchema>;

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
     * The Categories, in their order, as the Language Pack build writes them
     * into the pack. The app reads them from the pack only (ADR 0033).
     */
    categories: z.array(CategorySchema).min(1),
  })
  .superRefine(({ categories, userSettingDefaults }, context) => {
    const seen = new Set<string>();
    categories.forEach(({ id }, index) => {
      if (seen.has(id)) {
        context.addIssue({
          code: 'custom',
          path: ['categories', index, 'id'],
          message: `Duplicate Category id "${id}"`,
        });
      }
      seen.add(id);
    });

    const mixCategories = userSettingDefaults.mix.categories;
    if (mixCategories === 'all') return;
    mixCategories.forEach((id, index) => {
      if (!seen.has(id)) {
        context.addIssue({
          code: 'custom',
          path: ['userSettingDefaults', 'mix', 'categories', index],
          message: `Unknown Category id "${id}"`,
        });
      }
    });
  });

export type EditionConfig = z.infer<typeof EditionConfigSchema>;

/**
 * The App Group an Edition's app shares with its widget (ADR 0026), derived
 * from the bundle id, so each Edition's widget reads only its own app's data.
 */
export const editionAppGroup = (bundleId: string) => `group.${bundleId}`;
