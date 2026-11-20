import {
  EditionConfigSchema,
  type DailyGoals,
  type OnboardingNotificationTimes,
  type FeatureSwitch,
  type FeatureSwitches,
  type TextSize,
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
  type MixKind,
  switchedOn,
} from '@slovo/contracts';

export { switchedOn };

/**
 * The Edition's default Mix: the Categories, plus each kind of Entry beside
 * Words as a whole, a new user sees. `'all'` is every
 * Category of the Language Pack, also one a content update adds (ADR 0019,
 * 0033, 0046, 0051).
 */
export interface DefaultMix {
  readonly categoryIds: 'all' | readonly string[];
  /** The Categories of Corrections in the Mix, under Corrections as a whole (ADR 0033). */
  readonly correctionCategoryIds: 'all' | readonly string[];
  /** Whether each kind of Entry beside Words is in the Mix as a whole. */
  readonly kinds: Readonly<Record<MixKind, boolean>>;
}

/** The settings a new user starts with, as declared by the Edition. */
export interface UserSettingDefaults {
  readonly theme: Theme;
  /** The three-step text size a new user starts with (ADR 0134). */
  readonly textSize: TextSize;
  /** Whether haptics are on. */
  readonly vibration: boolean;
  /** The id of the Narrator Voice that reads until the reader chooses: the Edition's default voice (ADR 0083). */
  readonly narratorVoice: string;
  /** Local times of day, `HH:MM` on a 24-hour clock. */
  readonly notificationTimes: readonly string[];
  /** The top of the Rarity Range a new user starts with, «до 1» to «до 5» (ADR 0156). */
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
  /** The three to five moods the Dashboard's Mood check-in offers, in display order (ADR 0076, ADR 0192). */
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
   * The id of the Category or Correction Category whose pictogram a Curated
   * Collection's tile draws when the collection names none (ADR 0178).
   */
  readonly curatedCollectionPictogram: string | undefined;
  /**
   * Whether the given Core feature is in effect (ADR 0202): by the remote
   * Rules the device read last, else as the Edition shipped it (ADR 0089),
   * and every switch it depends on in effect.
   */
  isFeatureEnabled(feature: FeatureSwitch): boolean;
}

/**
 * The Edition as the build shipped it (ADR 0202): everything of the Edition
 * but the answer in effect. A reader that asks it takes the shipped answer on
 * purpose; every other reader asks the `Edition` the remote Feature Switches
 * give (`openRemoteSwitches`), and the compiler refuses one for the other.
 */
export interface ShippedEdition extends Omit<Edition, 'isFeatureEnabled'> {
  /** The Edition's own Feature Switch states, which hold where no remote Rule matches (ADR 0089). */
  readonly featureSwitches: FeatureSwitches;
  /**
   * Whether the build shipped the given Core feature on, and every switch it
   * depends on: no remote Rule changes this answer.
   */
  readonly isShippedOn: (feature: FeatureSwitch) => boolean;
}

/** Thrown when an Edition config doesn't match the contracts. */
export class InvalidEditionConfigError extends Error {
  override readonly name = 'InvalidEditionConfigError';
}

/**
 * The Edition in effect where no remote Rule is read: each Feature Switch as
 * the Edition shipped it. The Shell runs on it until the Rules the device
 * kept are read (ADR 0202).
 */
export function inEffectWithoutRules(shipped: ShippedEdition): Edition {
  const { featureSwitches, isShippedOn, ...edition } = shipped;
  return { ...edition, isFeatureEnabled: isShippedOn };
}

/**
 * Validates an Edition config and reports the Edition in effect of a run no
 * remote Rule reaches: each Feature Switch as the config states it. For
 * tests alone (`@slovo/core/testing`); the app loads `loadShippedEdition`.
 */
export function loadEdition(config: unknown): Edition {
  return inEffectWithoutRules(loadShippedEdition(config));
}

/**
 * Validates an Edition config and reports the Edition as the build shipped
 * it. Every feature asks the Edition instead of reading the config directly.
 */
export function loadShippedEdition(config: unknown): ShippedEdition {
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
    curatedCollectionPictogram,
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
        kinds: mix.kinds,
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
    curatedCollectionPictogram,
    featureSwitches,
    isShippedOn: switchedOn((feature) => featureSwitches[feature] === 'on'),
  };
}
