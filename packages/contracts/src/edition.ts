import { z } from 'zod';

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

export const LanguageTraitsSchema = z.strictObject({
  /** Whether the language marks Stress, so every Lemma must carry it. */
  marksStress: z.boolean(),
  /**
   * The lowercase letters of the alphabet in alphabetical order, authored as
   * one string separated by spaces (a letter may span several characters) and
   * parsed into a list.
   */
  alphabet: z
    .string()
    .transform((letters) => letters.split(' ').filter((letter) => letter !== ''))
    .pipe(
      z
        .array(z.string())
        .min(1, 'Expected at least one letter')
        .refine((letters) => new Set(letters).size === letters.length, 'Expected unique letters'),
    ),
  /** The language tag used to sort text in the Edition's language. */
  sortLocale: LanguageTagSchema,
  distractorRule: DistractorRuleSchema,
  /**
   * The lowercase vowel letters, the only letters Stress may fall on. The
   * Language Pack build requires them when the Edition marks Stress.
   */
  vowels: z.string().min(1).optional(),
});

export type LanguageTraits = z.infer<typeof LanguageTraitsSchema>;

/** Per-Edition on/off settings for Core features. */
export const FeatureSwitchesSchema = z.strictObject({
  game: z.boolean(),
  corrections: z.boolean(),
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

export const MixConfigSchema = z.strictObject({
  /** Either every Category of the Edition, or the listed Category ids. */
  categories: z.union([z.literal('all'), z.array(KebabCaseIdSchema)]),
  /** Whether Corrections, as a whole, are in the Mix. */
  corrections: z.boolean(),
});

export type MixConfig = z.infer<typeof MixConfigSchema>;

/** The settings a new user starts with. */
export const UserSettingDefaultsConfigSchema = z.strictObject({
  theme: ThemeSchema,
  fontSize: FontSizeSchema,
  notificationTimes: z
    .array(TimeOfDaySchema)
    .max(MAX_NOTIFICATION_TIMES)
    .refine((times) => new Set(times).size === times.length, 'Expected unique times'),
  mix: MixConfigSchema,
});

export type UserSettingDefaultsConfig = z.infer<typeof UserSettingDefaultsConfigSchema>;

/** Everything Edition-specific that the app and the Language Pack build need. */
export const EditionConfigSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Expected a lowercase id'),
    locale: LanguageTagSchema,
    displayName: z.string().min(1),
    bundleId: z
      .string()
      .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, 'Expected a reverse-DNS bundle id'),
    languageTraits: LanguageTraitsSchema,
    featureSwitches: FeatureSwitchesSchema,
    userSettingDefaults: UserSettingDefaultsConfigSchema,
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
