import {
  EditionConfigSchema,
  type FeatureSwitch,
  type FontSize,
  type LanguageTraits,
  type LegalPages,
  type Theme,
} from '@slovo/contracts';

/**
 * The Edition's default Mix: the Categories, plus Corrections, Idioms,
 * Synonym Rows and Tips each as a whole, a new user sees. `'all'` is every
 * Category of the Language Pack, also one a content update adds (ADR 0019,
 * 0033, 0046, 0051).
 */
export interface DefaultMix {
  readonly categoryIds: 'all' | readonly string[];
  /** The Categories of Corrections in the Mix, under Corrections as a whole (ADR 0050). */
  readonly correctionCategoryIds: 'all' | readonly string[];
  readonly corrections: boolean;
  readonly idioms: boolean;
  readonly synonymRows: boolean;
  readonly tips: boolean;
}

/** The settings a new user starts with, as declared by the Edition. */
export interface UserSettingDefaults {
  readonly theme: Theme;
  readonly fontSize: FontSize;
  /** Whether haptics are on. */
  readonly vibration: boolean;
  /** Local times of day, `HH:MM` on a 24-hour clock. */
  readonly notificationTimes: readonly string[];
  readonly mix: DefaultMix;
}

/**
 * What the Core knows about the Edition it runs as: only what can't change
 * without a store build. Its Categories come from the Language Pack (ADR 0033).
 */
export interface Edition {
  readonly id: string;
  readonly locale: string;
  /** The app's name, such as «SLOVO»; its Share Cards carry it as their watermark. */
  readonly displayName: string;
  /** The app's bundle id, such as `app.slovo.uk`. */
  readonly bundleId: string;
  readonly languageTraits: LanguageTraits;
  readonly userSettingDefaults: UserSettingDefaults;
  /** The file name of the Edition's notification sound, which the shell bundles; without one, notifications play the system sound. */
  readonly notificationSound: string | undefined;
  /** The addresses of the privacy policy and the terms, which About opens in the browser. */
  readonly legalPages: LegalPages;
  /** Whether the Edition turns the given Core feature on. */
  isFeatureEnabled(feature: FeatureSwitch): boolean;
}

/** The Feature Switches of the Game Modes and the Daily Crossword, each off while `game` is (ADR 0052). */
const GAME_PART_SWITCHES: ReadonlySet<FeatureSwitch> = new Set([
  'gameGuessWord',
  'gameCorrection',
  'gameStress',
  'gamePairs',
  'gameSurvival',
  'gameTimed',
  'gameIdiomMeaning',
  'gameAnglicism',
  'gameBuildIdiom',
  'gameTypeWord',
  'gameAnagram',
  'gameByLetters',
  'gameOrigin',
  'dailyCrossword',
]);

/**
 * Whether a feature is on, from whether each switch is on by itself: a Game
 * Mode or the Daily Crossword only while `game` is on too (ADR 0052).
 */
export function switchedOn(isOn: (feature: FeatureSwitch) => boolean) {
  return (feature: FeatureSwitch) =>
    isOn(feature) && (!GAME_PART_SWITCHES.has(feature) || isOn('game'));
}

/** Thrown when an Edition config doesn't match the contracts. */
export class InvalidEditionConfigError extends Error {
  override readonly name = 'InvalidEditionConfigError';
}

/**
 * Validates an Edition config and reports the Edition. Every feature asks the
 * Edition returned here instead of reading the config directly.
 */
export function loadEdition(config: unknown): Edition {
  const result = EditionConfigSchema.safeParse(config);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new InvalidEditionConfigError(`Invalid Edition config:\n${problems.join('\n')}`);
  }
  const {
    id,
    locale,
    displayName,
    bundleId,
    languageTraits,
    featureSwitches,
    userSettingDefaults,
    notificationSound,
    legalPages,
  } = result.data;
  const { mix, ...settings } = userSettingDefaults;
  return {
    id,
    locale,
    displayName,
    bundleId,
    languageTraits,
    userSettingDefaults: {
      ...settings,
      mix: {
        categoryIds: mix.categories,
        correctionCategoryIds: mix.correctionCategories,
        corrections: mix.corrections,
        idioms: mix.idioms,
        synonymRows: mix.synonymRows,
        tips: mix.tips,
      },
    },
    notificationSound,
    legalPages,
    isFeatureEnabled: switchedOn((feature) => featureSwitches[feature]),
  };
}
