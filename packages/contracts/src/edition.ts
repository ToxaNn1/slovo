import { z } from 'zod';

import { FEATURE_SWITCHES } from './feature-switch-catalogue';
import { ContentTargetsSchema } from './content-targets';
import { MixKindSchema } from './entry';
import { NotificationSoundFileSchema } from './notification-sound';
import { OriginLanguageSchema } from './origin-language';
import {
  hasNoRepeats,
  HexColorSchema,
  KebabCaseIdSchema,
  RaritySchema,
  TextSchema,
  WordIdSchema,
} from './shared';

/** A BCP 47 language tag, e.g. `uk` or `uk-UA`. */
const LanguageTagSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Expected a BCP 47 tag such as uk-UA');

/**
 * Adds an issue at each id seen before in the list and returns the ids seen,
 * for the checks that follow.
 */
function reportRepeats(
  context: z.RefinementCtx,
  ids: readonly string[],
  pathOf: (index: number) => PropertyKey[],
  messageOf: (id: string) => string,
): Set<string> {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id))
      context.addIssue({ code: 'custom', path: pathOf(index), message: messageOf(id) });
    seen.add(id);
  });
  return seen;
}

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
 * and the Corrections each have their own list.
 */
export const CategorySchema = z.discriminatedUnion('tone', [
  z.strictObject({ ...categoryFields, tone: z.literal('loud') }),
  z.strictObject({ ...categoryFields, tone: z.literal('quiet') }),
]);

export type Category = z.infer<typeof CategorySchema>;

/** A named group of Categories of Words, as the Mix screen shows them, by id in their order. */
export const CategoryGroupSchema = z.strictObject({
  /** The group's heading, in the Edition's language. */
  name: z.string().min(1),
  categories: z.array(KebabCaseIdSchema).min(1),
});

export type CategoryGroup = z.infer<typeof CategoryGroupSchema>;

/**
 * The band of rarities a Mood puts first in the Feed: `upper` is
 * the top of the Rarity Range and the one below it, `lower` its bottom and
 * the one above it, `whole` every rarity; the bands clip to the range.
 */
export const RarityBandSchema = z.enum(['upper', 'lower', 'whole']);

export type RarityBand = z.infer<typeof RarityBandSchema>;

/**
 * How a Mood shifts the reader's Mix kind weight of a kind: one
 * step towards «Менше», none, or one step towards «Більше», clamped to the
 * weights; a kind turned off in the Mix stays off.
 */
export const MoodShiftSchema = z.enum(['less', 'same', 'more']);

export type MoodShift = z.infer<typeof MoodShiftSchema>;

/**
 * A Mood («настрій») the Edition lists: its id, its name in the Edition's
 * language, its emoji, the reply the Dashboard's Mood check-in answers it
 * with, in the Edition's language, and its Feed parameters: the
 * rarity band put first and a shift per kind. A mood that names neither
 * leaves the Feed as it is. `effect` is the short line under the check-in
 * that says what the Mood changed in the Feed: every Mood the
 * Dashboard lists has one.
 */
export const MoodSchema = z.strictObject({
  id: KebabCaseIdSchema,
  name: z.string().min(1),
  emoji: z.string().min(1),
  reply: TextSchema,
  effect: TextSchema.optional(),
  rarityBand: RarityBandSchema.default('whole'),
  shifts: z.partialRecord(MixKindSchema, MoodShiftSchema).default({}),
});

export type Mood = z.infer<typeof MoodSchema>;

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
      .refine(hasNoRepeats, 'Expected unique letters'),
  );

/**
 * Whether the language marks Stress. One that does, so that every Lemma
 * carries it, names its lowercase vowels, each a letter of the alphabet: the
 * only letters Stress may fall on.
 */
const StressTraitSchema = z.discriminatedUnion('marked', [
  z.strictObject({ marked: z.literal(false) }),
  z.strictObject({ marked: z.literal(true), vowels: LetterListSchema }),
]);

export const LanguageTraitsSchema = z
  .strictObject({
    stress: StressTraitSchema,
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
    /**
     * The characters read as one apostrophe when text is compared, such as
     * the ones a reader's keyboard may type; a Comparison Key writes each as
     * the first. None when left out.
     */
    apostrophes: LetterListSchema.optional(),
    /** The language tag used to sort text and fold its case in the Edition's language. */
    sortLocale: LanguageTagSchema,
    /**
     * The rows of the on-screen keyboard of the Daily Crossword, top to
     * bottom: every letter of the alphabet once. The alphabet in rows when
     * left out.
     */
    keyboard: z.array(LetterListSchema).min(1).optional(),
  })
  .superRefine(({ stress, alphabet, keyboard }, context) => {
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
    if (!stress.marked) return;
    stress.vowels.forEach((vowel, index) => {
      if (!alphabet.includes(vowel)) {
        context.addIssue({
          code: 'custom',
          path: ['stress', 'vowels', index],
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
 * that reads without the reader's choice.
 */
export const NarratorVoicesSchema = z
  .strictObject({
    default: KebabCaseIdSchema,
    voices: z.array(NarratorVoiceSchema).min(1),
    sample: NarratorVoiceSampleSchema,
  })
  .superRefine(({ default: chosen, voices }, context) => {
    const ids = reportRepeats(
      context,
      voices.map(({ id }) => id),
      (index) => ['voices', index, 'id'],
      (id) => `Expected each Narrator Voice id once, got ${id} again`,
    );
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

/** A shape holding `value` under every key of `record`; each key keeps its JSDoc there. */
function everyKeyOf<Record extends object, Value>(
  record: Record,
  value: Value,
): { readonly [Key in keyof Record]: Value } {
  const shape: object = Object.fromEntries(Object.keys(record).map((key) => [key, value]));
  if (!holdsEveryKey(shape, record, value)) throw new Error('a key of the record is missing');
  return shape;
}

/** Whether the shape holds `value` under every key of `record`. */
function holdsEveryKey<Record extends object, Value>(
  shape: object,
  record: Record,
  value: Value,
): shape is { readonly [Key in keyof Record]: Value } {
  return Object.keys(record).every(
    (key) => Object.getOwnPropertyDescriptor(shape, key)?.value === value,
  );
}

/**
 * The Edition's state of every Core feature's Feature Switch (ADR 0089): one
 * key per switch of the catalogue (ADR 0199), each required.
 */
export const FeatureSwitchesSchema = z.strictObject(
  everyKeyOf(FEATURE_SWITCHES, FeatureSwitchStateSchema),
);

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
 * A condition from the Core's catalogue of Badge conditions (ADR 0066),
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

/** The shape of a Badge family's mark (`checker`). */
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

/** The tone a Badge family's earned mark is drawn in. */
export const BadgeToneSchema = z.enum(['red', 'ink', 'cream']);

export type BadgeTone = z.infer<typeof BadgeToneSchema>;

/**
 * A Badge family the Edition declares: its id, the name over its
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
 * its mark shows (at most three characters), the id of its Badge family,
 * its condition from the catalogue, the short line that words
 * that condition for the reader and, optionally, its stamp's kicker.
 */
export const BadgeSchema = z.strictObject({
  id: KebabCaseIdSchema,
  name: TextSchema,
  symbol: TextSchema.max(3),
  family: KebabCaseIdSchema,
  condition: BadgeConditionSchema,
  /** What its condition asks, in a few words under its mark and in its sheet, e.g. «Виграй «Наголос»». */
  conditionText: TextSchema,
  /** The line over the Badge's name on its full-screen stamp, e.g. «7 ПОСПІЛЬ»; left out, none. */
  stampKicker: TextSchema.optional(),
});

export type Badge = z.infer<typeof BadgeSchema>;

/**
 * The Mascot's short line for each moment it shows in: the onboarding, the
 * celebrations of a new Level, the Daily Goal and a Streak
 * milestone, a right and a wrong Game answer, the Game's end, and an empty
 * state.
 */
export const MascotLinesSchema = z.strictObject({
  onboarding: TextSchema,
  newLevel: TextSchema,
  dailyGoal: TextSchema,
  streakMilestone: TextSchema,
  gameRight: TextSchema,
  gameWrong: TextSchema,
  empty: TextSchema,
});

export type MascotLines = z.infer<typeof MascotLinesSchema>;

/** A moment the Mascot shows in, which picks its state and its line. */
export type MascotMoment = keyof MascotLines;

export type FeatureSwitches = z.infer<typeof FeatureSwitchesSchema>;

export type FeatureSwitch = keyof FeatureSwitches;

/**
 * The states of a test or fixture Edition: every Feature Switch `on` but the
 * ones it states (ADR 0199). The real Edition declares every switch itself.
 */
export function featureSwitchStates(stated: Partial<FeatureSwitches> = {}): FeatureSwitches {
  return FeatureSwitchesSchema.parse({
    ...Object.fromEntries(Object.keys(FEATURE_SWITCHES).map((feature) => [feature, 'on'])),
    ...stated,
  });
}

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

/** The three-step text size, in ladder order: «Як у системі», «Більший», «Найбільший». */
export const TextSizeSchema = z.enum(['system', 'larger', 'largest']);

export type TextSize = z.infer<typeof TextSizeSchema>;

/**
 * The Daily Goal: the Words the reader aims to see on a local day.
 * It replaces the old Daily Limit.
 */
export const DailyGoalSchema = z.int().positive();

export type DailyGoal = z.infer<typeof DailyGoalSchema>;

/** The Daily Goals the reader chooses from, in rising order, and the one highlighted. */
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
 * it is counted in, in time order.
 */
export const OnboardingNotificationTimesSchema = z
  .strictObject({ morning: TimeOfDaySchema, midday: TimeOfDaySchema, evening: TimeOfDaySchema })
  .refine(
    ({ morning, midday, evening }) => morning < midday && midday < evening,
    'Expected the morning, midday and evening times in time order',
  );

export type OnboardingNotificationTimes = z.infer<typeof OnboardingNotificationTimesSchema>;

/**
 * The most notification times a stored list may hold: a list kept before ADR
 * 0200 holds up to 10; since then it holds the Word's time and the Reminder's.
 */
const MAX_STORED_NOTIFICATION_TIMES = 10;

/**
 * A list of notification times: valid and no two equal. The Core reads its
 * first time as the Word's and its last as the Reminder's (ADR 0200), so a
 * list kept before then with more times still reads. The order is not checked
 * here: the Edition's defaults are sorted when the config is read, and the
 * user's list is kept in time order by whoever writes it.
 */
export const NotificationTimesSchema = z
  .array(TimeOfDaySchema)
  .max(MAX_STORED_NOTIFICATION_TIMES)
  .refine(hasNoRepeats, 'Expected unique times');

export const MixConfigSchema = z.strictObject({
  /** Either every Category of the Language Pack, also one a content update adds, or the listed Category ids. */
  categories: z.union([
    z.literal('all'),
    // At least one Category always stays in the Mix.
    z.array(KebabCaseIdSchema).min(1, 'Expected at least one Category'),
  ]),
  /**
   * The Categories of Corrections in the Mix: every one of the
   * Language Pack, or the listed ids. They sit under Corrections as a whole.
   */
  correctionCategories: z.union([
    z.literal('all'),
    // At least one Category of Corrections always stays in the Mix, as of Words.
    z.array(KebabCaseIdSchema).min(1, 'Expected at least one Category of Corrections'),
  ]),
  /**
   * Whether each kind of Entry beside Words is in the Mix as a whole: the same map of Entry kinds as the Mix state in the Core.
   */
  kinds: z.record(MixKindSchema, z.boolean()),
});

export type MixConfig = z.infer<typeof MixConfigSchema>;

/** The settings a new user starts with. */
export const UserSettingDefaultsConfigSchema = z.strictObject({
  theme: ThemeSchema,
  /** The three-step text size. */
  textSize: TextSizeSchema,
  /** Whether haptics are on for a new user. */
  vibration: z.boolean(),
  /**
   * The default notification times, kept in time order: the Word's first, the
   * Reminder's last (ADR 0200). At least the Word's: turning the notifications
   * on writes the defaults, and none would leave them off.
   */
  notificationTimes: NotificationTimesSchema.min(1).transform((times) => [...times].sort()),
  /** The top of the Rarity Range a new user starts with, «до 1» to «до 5» (ADR 0156). */
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
 * backgrounds. Світлий and Темний take the Edition's light and
 * dark colour tokens.
 */
const WidgetPaletteSchema = z.strictObject({
  parchment: WidgetBackgroundSchema,
  blue: WidgetBackgroundSchema,
});

/** The id of an Edition, e.g. `uk`. */
export const EditionIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, 'Expected a lowercase id');

/**
 * The steps of the onboarding, in order: the one place that has
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

/** The questions the onboarding asks: «Як добре ти знаєш мову?» and «Навіщо». */
export const QuestionnaireQuestionSchema = z.enum(['level', 'why']);

export type QuestionnaireQuestion = z.infer<typeof QuestionnaireQuestionSchema>;

/** The id of an option of a questionnaire question, e.g. `studying`. */
export const QuestionnaireAnswerIdSchema = KebabCaseIdSchema;

/**
 * The Edition's questionnaire: the options of the level
 * question, which set nothing but for the one opening the Rarity Test, of
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
          /** No longer read: «Рівень» sets no Rarity Range. Kept so Edition configs written before stay valid. */
          rarityCeiling: RaritySchema,
        }),
        /** «Не знаю»: the onboarding opens the Rarity Test, whose result sets the top of the Rarity Range. */
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
        kindWeights: z.partialRecord(MixKindSchema, MixKindWeightSchema),
      }),
    )
    .min(1),
  /**
   * The vocabulary self-rating, asked later through a Feed Notice: each
   * option only says whether to offer the Rarity Test.
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
    /** The colours of the widget's Пергамент and Синій backgrounds. */
    widgetPalette: WidgetPaletteSchema,
    /**
     * The Categories, in their order, as the Language Pack build writes them
     * into the pack. The app reads them from the pack only.
     */
    categories: z.array(CategorySchema).min(1),
    /**
     * The Categories of Corrections, a list of their own beside the Words',
     * in their order, as the Language Pack build writes them into
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
     * The groups the Mix screen shows the Categories of Words in, in their
     * order, each Category in exactly one; unset, the Categories show as one
     * list.
     */
    categoryGroups: z.array(CategoryGroupSchema).min(1).optional(),
    /**
     * The id of the Category or Correction Category whose pictogram a Curated
     * Collection's tile draws when the collection names none;
     * unset, such a tile draws no pictogram.
     */
    curatedCollectionPictogram: KebabCaseIdSchema.optional(),
    /**
     * The languages Words come from, in their order: the Edition
     * owns the list, so the Core stays language-agnostic. Empty when the
     * Edition gives no Word an origin.
     */
    originLanguages: z.array(OriginLanguageSchema),
    /**
     * The moods, in their order: the Edition owns the list, so the
     * Core stays language-agnostic. It lists every one `dashboardMoods` names,
     * and keeps a Mood the Dashboard hides so a saved one still reads.
     */
    moods: z.array(MoodSchema),
    /**
     * The moods the Dashboard's Mood check-in offers, by id among `moods`, in
     * display order: three to five.
     */
    dashboardMoods: z
      .array(KebabCaseIdSchema)
      .min(3, { message: 'The Dashboard lists three to five moods' })
      .max(5, { message: 'The Dashboard lists three to five moods' }),
    /**
     * The letters Search reads as another, each lower-case letter
     * to the one it reads as, such as ґ to г: the Edition owns them, so the
     * Core stays language-agnostic. Empty when Search reads each letter as
     * itself.
     */
    searchLetters: z.record(LowerCaseLetterSchema, LowerCaseLetterSchema),
    /** The Narrator Voices that read Words. */
    narratorVoices: NarratorVoicesSchema,
    /** The XP table: what each Game learning action earns (ADR 0066). */
    xp: XpTableSchema,
    /** The Level curve and the Level names (ADR 0066). */
    levels: LevelsSchema,
    /** The Daily Goals in Words the reader chooses from. */
    dailyGoals: DailyGoalsSchema,
    /** The Notification times «Коли нагадати?» offers. */
    onboardingNotificationTimes: OnboardingNotificationTimesSchema,
    /** The onboarding questions, their options and what each sets. */
    questionnaire: QuestionnaireSchema,
    /** The Badge families, in their order, each id once. */
    badgeFamilies: z
      .array(BadgeFamilySchema)
      .min(1)
      .refine(
        (families) => hasNoRepeats(families.map(({ id }) => id)),
        'Expected each Badge family id once',
      ),
    /** The Badges, in their order, each id once, each of a declared family (ADR 0066). */
    badges: z
      .array(BadgeSchema)
      .refine((badges) => hasNoRepeats(badges.map(({ id }) => id)), 'Expected each Badge id once'),
    /** The Mascot's line for each moment it shows in. */
    mascot: MascotLinesSchema,
    /** The floors the Edition's content should reach; the admin shows a miss and nothing blocks on it. */
    contentTargets: ContentTargetsSchema.optional(),
  })
  .superRefine(
    (
      {
        categories,
        correctionCategories,
        categoriesRequiringHistory,
        categoryGroups,
        curatedCollectionPictogram,
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
        reportRepeats(
          context,
          questionnaire[question].map(({ id }) => id),
          (index) => ['questionnaire', question, index, 'id'],
          (id) => `Duplicate option id "${id}"`,
        );
      }
      const idsOf = (list: readonly Category[], field: 'categories' | 'correctionCategories') =>
        reportRepeats(
          context,
          list.map(({ id }) => id),
          (index) => [field, index, 'id'],
          (id) => `Duplicate Category id "${id}"`,
        );
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
      if (categoryGroups !== undefined) {
        const grouped = new Set<string>();
        categoryGroups.forEach(({ categories: ids }, group) => {
          ids.forEach((id, index) => {
            const path = ['categoryGroups', group, 'categories', index];
            if (!known.categories.has(id))
              context.addIssue({ code: 'custom', path, message: `Unknown Category id "${id}"` });
            else if (grouped.has(id))
              context.addIssue({
                code: 'custom',
                path,
                message: `Category "${id}" is in two groups`,
              });
            grouped.add(id);
          });
        });
        known.categories.forEach((id) => {
          if (!grouped.has(id))
            context.addIssue({
              code: 'custom',
              path: ['categoryGroups'],
              message: `Category "${id}" is in no group`,
            });
        });
      }
      if (
        curatedCollectionPictogram !== undefined &&
        !known.categories.has(curatedCollectionPictogram) &&
        !known.correctionCategories.has(curatedCollectionPictogram)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['curatedCollectionPictogram'],
          message: `Unknown Category id "${curatedCollectionPictogram}"`,
        });
      }
      reportRepeats(
        context,
        originLanguages.map(({ code }) => code),
        (index) => ['originLanguages', index, 'code'],
        (code) => `Duplicate origin language code "${code}"`,
      );
      const moodIds = reportRepeats(
        context,
        moods.map(({ id }) => id),
        (index) => ['moods', index, 'id'],
        (id) => `Duplicate mood id "${id}"`,
      );
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
        if (moods.find((mood) => mood.id === id)?.effect === undefined && moodIds.has(id)) {
          context.addIssue({
            code: 'custom',
            path: ['dashboardMoods', index],
            message: `The Dashboard mood "${id}" has no effect line`,
          });
        }
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
