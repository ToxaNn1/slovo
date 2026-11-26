import {
  EditionConfigSchema,
  type EditionConfig,
  type FeatureSwitch,
  type FeatureSwitches,
  type MixConfig,
  type Mood,
  type NarratorVoice,
  type NarratorVoiceSample,
  type UserSettingDefaultsConfig,
  switchedOn,
} from '@slovo/contracts';

export { switchedOn };

/** A parsed config's field as the Core reads it: a list or a record of it not reassigned either. */
type Frozen<V> = V extends readonly (infer E)[] ? readonly E[] : V extends object ? Readonly<V> : V;

/** The fields of a parsed config as the Core reads them, each with the config's own doc. */
type AsRead<Config> = { readonly [Field in keyof Config]: Frozen<Config[Field]> };

/** The fields of the Edition config the Core reshapes before it reads them. */
type Reshaped = 'featureSwitches' | 'userSettingDefaults' | 'dashboardMoods' | 'narratorVoices';

/**
 * The fields of the Edition config only the Language Pack build and the app
 * config read: the Core reads its Categories from the Language Pack.
 */
type LeftToTheBuild =
  | 'wordOfTheDayFont'
  | 'widgetPalette'
  | 'categories'
  | 'correctionCategories'
  | 'categoriesRequiringHistory'
  | 'contentTargets';

/**
 * The Edition's default Mix: the Categories, plus each kind of Entry beside
 * Words as a whole, a new user sees. `'all'` is every
 * Category of the Language Pack, also one a content update adds.
 */
export interface DefaultMix extends AsRead<Omit<MixConfig, 'categories' | 'correctionCategories'>> {
  readonly categoryIds: 'all' | readonly string[];
  /** The Categories of Corrections in the Mix, under Corrections as a whole. */
  readonly correctionCategoryIds: 'all' | readonly string[];
}

/** The settings a new user starts with, as declared by the Edition. */
export interface UserSettingDefaults extends AsRead<Omit<UserSettingDefaultsConfig, 'mix'>> {
  /** The id of the Narrator Voice that reads until the reader chooses: the Edition's default voice. */
  readonly narratorVoice: string;
  readonly mix: DefaultMix;
}

/**
 * What the Core knows about the Edition it runs as: only what can't change
 * without a store build. Every field of the Edition config it does not
 * reshape or leave to the build, as parsed; its Categories come from the
 * Language Pack.
 */
export interface Edition extends AsRead<Omit<EditionConfig, Reshaped | LeftToTheBuild>> {
  /** The app's name, such as «SLOVO»; its Share Cards carry it as their watermark. */
  readonly displayName: string;
  readonly userSettingDefaults: UserSettingDefaults;
  /** The three to five moods the Dashboard's Mood check-in offers, in display order. */
  readonly dashboardMoods: readonly Mood[];
  /** The Narrator Voices that read Words, in their order. */
  readonly narratorVoices: readonly NarratorVoice[];
  /**
   * The Narrator Voice that reads: the chosen one, or the Edition's default
   * without a choice or for a voice the Edition no longer declares.
   */
  narratorVoiceOf(chosen: string | undefined): NarratorVoice;
  /** The Word the voice screen reads in every Narrator Voice, and how it shows it. */
  readonly narratorVoiceSample: NarratorVoiceSample;
  /**
   * Whether the given Core feature is in effect (ADR 0203): by the remote
   * Rules the device read last, else as the Edition shipped it (ADR 0089),
   * and every switch it depends on in effect.
   */
  isFeatureEnabled(feature: FeatureSwitch): boolean;
}

/**
 * The Edition as the build shipped it (ADR 0203): everything of the Edition
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
 * kept are read (ADR 0203).
 */
export function inEffectWithoutRules(shipped: ShippedEdition): Edition {
  const { featureSwitches: _shippedStates, isShippedOn, ...edition } = shipped;
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
    featureSwitches,
    userSettingDefaults,
    dashboardMoods,
    narratorVoices,
    // Left to the Language Pack build and the app config.
    wordOfTheDayFont: _font,
    widgetPalette: _widgetPalette,
    categories: _categories,
    correctionCategories: _correctionCategories,
    categoriesRequiringHistory: _requiringHistory,
    contentTargets: _contentTargets,
    ...carried
  } = result.data;
  const moodOf = (id: string) => carried.moods.find((mood) => mood.id === id);
  const voiceOf = (id: string | undefined) =>
    narratorVoices.voices.find((voice) => voice.id === id);
  const defaultVoice = voiceOf(narratorVoices.default);
  // The schema checks the default is declared; this keeps the type honest.
  if (defaultVoice === undefined)
    throw new InvalidEditionConfigError('Invalid Edition config:\nnarratorVoices.default');
  const {
    mix: { categories, correctionCategories, ...mix },
    ...settings
  } = userSettingDefaults;
  return {
    ...carried,
    userSettingDefaults: {
      ...settings,
      narratorVoice: defaultVoice.id,
      mix: { ...mix, categoryIds: categories, correctionCategoryIds: correctionCategories },
    },
    // Each id is one of `moods`: the schema checked it.
    dashboardMoods: dashboardMoods.flatMap((id) => moodOf(id) ?? []),
    narratorVoices: narratorVoices.voices,
    narratorVoiceSample: narratorVoices.sample,
    narratorVoiceOf: (chosen) => voiceOf(chosen) ?? defaultVoice,
    featureSwitches,
    isShippedOn: switchedOn((feature) => featureSwitches[feature] === 'on'),
  };
}
