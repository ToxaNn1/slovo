import {
  EditionConfigSchema,
  type DailyGoals,
  type OnboardingNotificationTimes,
  type FeatureSwitch,
  type FontSize,
  type LanguageTraits,
  type Mood,
  type NarratorVoice,
  type NarratorVoiceSample,
  type OriginLanguage,
  type Rarity,
  type Theme,
  type XpTable,
  type Badge,
  type BadgeFamily,
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
}

/** The settings a new user starts with, as declared by the Edition. */
export interface UserSettingDefaults {
  readonly theme: Theme;
  readonly fontSize: FontSize;
  /** Whether haptics are on. */
  readonly vibration: boolean;
  /** The id of the Narrator Voice that reads until the reader chooses: the Edition's default voice (ADR 0083). */
  readonly narratorVoice: string;
  /** Local times of day, `HH:MM` on a 24-hour clock. */
  readonly notificationTimes: readonly string[];
  /** The Rarity Ceiling a new user starts with, «до 1» to «до 5» (ADR 0072). */
  readonly rarityCeiling: Rarity;
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
  /** The Edition's moods, in their order. */
  readonly moods: readonly Mood[];
  /** The four moods the Dashboard's Mood check-in offers, in display order (ADR 0076). */
  readonly dashboardMoods: readonly Mood[];
  /** The Narrator Voices that read Words, in their order (ADR 0083). */
  readonly narratorVoices: readonly NarratorVoice[];
  /**
   * The Narrator Voice that reads: the chosen one, or the Edition's default
   * without a choice or for a voice the Edition no longer declares.
   */
  narratorVoiceOf(chosen: string | undefined): NarratorVoice;
  /** The Word the voice screen reads in every Narrator Voice, and how it shows it. */
  readonly narratorVoiceSample: NarratorVoiceSample;
  /** The letters Search reads as another, such as ґ as г (ADR 0054). */
  readonly searchLetters: Readonly<Record<string, string>>;
  /** The XP table: what each Game learning action earns (ADR 0066). */
  readonly xp: XpTable;
  /** The Level curve and the Level names (ADR 0066). */
  readonly levels: Levels;
  /** The Daily Goals in Words the reader chooses from, and the one highlighted (ADR 0074). */
  readonly dailyGoals: DailyGoals;
  /** The Notification times «Коли нагадати?» offers, one for each bucket it counts (ADR 0067). */
  readonly onboardingNotificationTimes: OnboardingNotificationTimes;
  /** The onboarding questions, their options and what each sets (ADR 0067). */
  readonly questionnaire: Questionnaire;
  /** The Badge families the Edition declares, in their order (ADR 0085). */
  readonly badgeFamilies: readonly BadgeFamily[];
  /** The Badges the Edition chooses and names, in their order, each of a family (ADR 0066, 0085). */
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
  // The board 10 parts of the Profile and the Badges (ADR 0085).
  levelLadder: ['xpLog'],
  newLevelScreen: ['xpLog'],
  streakFreezeCard: ['xpLog'],
  breakCard: ['xpLog'],
  calendarDayLines: ['xpLog'],
  badgeSheet: ['xpLog', 'badges'],
  badgeToast: ['xpLog', 'badges'],
  profile: ['xpLog'],
  profileConfirmedByRarity: ['profile', 'confirmedEntries'],
  profileGameBest: ['profile', 'game'],
  dailyGoal: ['xpLog'],
  seenWordXp: ['xpLog', 'dailyGoal'],
  progressShareCards: ['shareCards', 'xpLog'],
  dailyCrosswordShare: ['shareCards', 'dailyCrossword'],
  tracedCrossword: ['dailyCrossword'],
  // The crossing Daily Crossword and its parts (ADR 0087).
  crossingCrossword: ['dailyCrossword'],
  crosswordHint: ['crossingCrossword'],
  crosswordSolveTime: ['crossingCrossword'],
  crosswordSolvedScreen: ['crossingCrossword'],
  crosswordBadgeStamp: ['crossingCrossword', 'badges'],
  // The board 07 parts of a Game (spec #1674).
  gameAnswerCard: ['game'],
  letterTiles: ['gameByLetters'],
  survivalStreak: ['gameSurvival'],
  finishPoster: ['game'],
  quickQuestion: ['game'],
  playStep: ['game'],
  // The Rarity Test sets the Rarity Ceiling (ADR 0072).
  rarityTest: ['rarityCeiling'],
  // The Dashboard's hero is the Word of the Day (ADR 0076).
  dashboard: ['wordOfTheDay'],
  // The Mood check-in is a Dashboard block (ADR 0076).
  mood: ['dashboard'],
  // «Попередні слова» is a Dashboard block over the Word of the Day archive (ADR 0076).
  previousWords: ['dashboard', 'wordOfTheDayArchive'],
  // The Correction Types rail is a Dashboard block over the Corrections (ADR 0076).
  correctionTypes: ['dashboard', 'corrections'],
  // The Curated Collections rail is a Dashboard block (ADR 0076).
  curatedCollections: ['dashboard'],
  // A swipe sets a Knowledge Mark.
  swipeMarks: ['knowledge'],
  // The Feed header's Search button opens the Search screen.
  searchButton: ['search'],
  // The wordmark leads to the Dashboard (ADR 0079).
  dashboardWordmark: ['dashboard'],
  // The «Стрічка» tab opens the Feed the Dashboard otherwise opens (ADR 0093).
  feedTab: ['dashboard'],
  // The Categories rail and its grid are Dashboard blocks (ADR 0081).
  categoryScreens: ['dashboard'],
  // The grid of the Categories of Corrections opens from the Dashboard's Corrections rail (ADR 0081).
  correctionCategoryScreens: ['dashboard', 'corrections'],
  // The quiet variant is a variant of a Category screen (ADR 0081).
  quietCategories: ['categoryScreens'],
  notificationTimeStep: ['notifications'],
  // The reader's choice of voice only changes what Pronunciation plays (ADR 0083).
  narratorVoice: ['pronunciation'],
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
    dashboardMoods,
    narratorVoices,
    searchLetters,
    xp,
    levels,
    dailyGoals,
    onboardingNotificationTimes,
    questionnaire,
    badgeFamilies,
    badges,
    mascot,
  } = result.data;
  const moodOf = (id: string) => moods.find((mood) => mood.id === id);
  const voiceOf = (id: string | undefined) =>
    narratorVoices.voices.find((voice) => voice.id === id);
  const defaultVoice = voiceOf(narratorVoices.default);
  // The schema checks the default is declared; this keeps the type honest.
  if (defaultVoice === undefined)
    throw new InvalidEditionConfigError('Invalid Edition config:\nnarratorVoices.default');
  const { mix, ...settings } = userSettingDefaults;
  return {
    id,
    locale,
    displayName,
    accountName,
    languageTraits,
    userSettingDefaults: {
      ...settings,
      narratorVoice: defaultVoice.id,
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
    originLanguages,
    moods,
    // Each id is one of `moods`: the schema checked it.
    dashboardMoods: dashboardMoods.flatMap((id) => moodOf(id) ?? []),
    narratorVoices: narratorVoices.voices,
    narratorVoiceSample: narratorVoices.sample,
    narratorVoiceOf: (chosen) => voiceOf(chosen) ?? defaultVoice,
    searchLetters,
    xp,
    levels,
    dailyGoals,
    onboardingNotificationTimes,
    questionnaire,
    badgeFamilies,
    badges,
    mascot,
    illustrations: new Set(illustrations),
    isFeatureEnabled: switchedOn((feature) => featureSwitches[feature] === 'on'),
  };
}
