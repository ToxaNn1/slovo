import {
  EditionConfigSchema,
  type DailyGoal,
  type FeatureSwitch,
  type FontSize,
  type LanguageTraits,
  type Mood,
  type OriginLanguage,
  type Rarity,
  type Theme,
  type XpTable,
  type Badge,
  type MascotLines,
  type Levels,
  type Questionnaire,
} from '@slovo/contracts';

/**
 * The Edition's default Mix: the Categories, plus Corrections, Idioms,
 * Synonym Rows and Tips each as a whole, a new user sees. `'all'` is every
 * Category of the Language Pack, also one a content update adds (ADR 0019,
 * 0033, 0046, 0051).
 */
export interface DefaultMix {
  readonly categoryIds: 'all' | readonly string[];
  /** The Categories of Corrections in the Mix, under Corrections as a whole (ADR 0033). */
  readonly correctionCategoryIds: 'all' | readonly string[];
  readonly corrections: boolean;
  readonly idioms: boolean;
  readonly synonymRows: boolean;
  readonly tips: boolean;
  /** The Rarity Floor a new user starts with. */
  readonly rarityFloor: Rarity;
  /** The Rarity Ceiling a new user starts with, never below the Rarity Floor. */
  readonly rarityCeiling: Rarity;
}

/** The settings a new user starts with, as declared by the Edition. */
export interface UserSettingDefaults {
  readonly theme: Theme;
  readonly fontSize: FontSize;
  /** Whether haptics are on. */
  readonly vibration: boolean;
  /** The Daily Goal of a reader who has not chosen one (ADR 0066). */
  readonly dailyGoal: DailyGoal;
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
  /** What the Account is called on every screen, such as «Акаунт SLOVO». */
  readonly accountName: string;
  readonly languageTraits: LanguageTraits;
  readonly userSettingDefaults: UserSettingDefaults;
  /** The file name of the Edition's notification sound, which the shell bundles; without one, notifications play the system sound. */
  readonly notificationSound: string | undefined;
  /** The languages Words come from, in their order, which «Звідки слово» offers (ADR 0052). */
  readonly originLanguages: readonly OriginLanguage[];
  /** The moods a Word may carry, in their order, which «Слово під настрій» offers (ADR 0054). */
  readonly moods: readonly Mood[];
  /** The letters Search reads as another, such as ґ as г (ADR 0054). */
  readonly searchLetters: Readonly<Record<string, string>>;
  /** The XP table: what each Game learning action earns (ADR 0066). */
  readonly xp: XpTable;
  /** The Level curve and the Level names (ADR 0066). */
  readonly levels: Levels;
  /** The onboarding questions, their options and what each sets (ADR 0067). */
  readonly questionnaire: Questionnaire;
  /** The Badges the Edition chooses and names, in their order (ADR 0066). */
  readonly badges: readonly Badge[];
  /** The Mascot's short line for each moment it shows in. */
  readonly mascot: MascotLines;
  /**
   * The file names of the Illustrations the app bundles as Edition assets; a
   * Word naming any other file shows no Illustration (ADR 0055).
   */
  readonly illustrations: ReadonlySet<string>;
  /**
   * Whether the given Core feature is in effect: its Feature Switch on, not
   * off remotely (ADR 0040), and every switch it depends on in effect.
   */
  isFeatureEnabled(feature: FeatureSwitch): boolean;
}

/** The Feature Switches of the Game Modes and the Daily Crossword, each off while `game` is (ADR 0052). */
const GAME_PART_SWITCHES = [
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
] as const satisfies readonly FeatureSwitch[];

/**
 * What each Feature Switch depends on: a feature is in effect only while
 * every switch it names here is in effect too (ADR 0040). A feature not
 * listed depends on nothing. Every rule between two switches lives here, so
 * the shell and the Core ask one question of the Edition.
 */
const DEPENDS_ON: Partial<Record<FeatureSwitch, readonly FeatureSwitch[]>> = {
  ...Object.fromEntries(GAME_PART_SWITCHES.map((feature) => [feature, ['game']])),
  // The 1.0 progress features all stand on the XP log (ADR 0066).
  streakBreak: ['xpLog'],
  badges: ['xpLog'],
  profile: ['xpLog'],
  dailyGoal: ['xpLog'],
  progressShareCards: ['shareCards', 'xpLog'],
  dailyCrosswordShare: ['shareCards', 'dailyCrossword'],
  quickQuestion: ['game'],
  // The Rarity Test sets the Rarity Floor.
  rarityTest: ['rarityFloor'],
};

/**
 * Whether a feature is in effect, from whether each switch is on by itself:
 * its own switch on and every switch it depends on in effect, such as a Game
 * Mode only while `game` is on too (ADR 0052).
 */
export function switchedOn(isOn: (feature: FeatureSwitch) => boolean) {
  const inEffect = (feature: FeatureSwitch): boolean =>
    isOn(feature) && (DEPENDS_ON[feature] ?? []).every(inEffect);
  return inEffect;
}

/** Thrown when an Edition config doesn't match the contracts. */
export class InvalidEditionConfigError extends Error {
  override readonly name = 'InvalidEditionConfigError';
}

/**
 * Validates an Edition config and reports the Edition, with the file names of
 * the Illustrations the app bundles (none by default). Every feature asks the
 * Edition returned here instead of reading the config directly.
 */
export function loadEdition(config: unknown, illustrations: readonly string[] = []): Edition {
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
    accountName,
    languageTraits,
    featureSwitches,
    userSettingDefaults,
    notificationSound,
    originLanguages,
    moods,
    searchLetters,
    xp,
    levels,
    questionnaire,
    badges,
    mascot,
  } = result.data;
  const { mix, ...settings } = userSettingDefaults;
  return {
    id,
    locale,
    displayName,
    accountName,
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
        rarityFloor: mix.rarityFloor,
        rarityCeiling: mix.rarityCeiling,
      },
    },
    notificationSound,
    originLanguages,
    moods,
    searchLetters,
    xp,
    levels,
    questionnaire,
    badges,
    mascot,
    illustrations: new Set(illustrations),
    isFeatureEnabled: switchedOn((feature) => featureSwitches[feature]),
  };
}
