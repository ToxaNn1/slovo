import {
  EditionConfigSchema,
  type Category,
  type FeatureSwitch,
  type FontSize,
  type LanguageTraits,
  type Theme,
} from '@slovo/contracts';

/** The Edition's default Mix: the Categories, plus Corrections as a whole, a new user sees. */
export interface DefaultMix {
  readonly categoryIds: readonly string[];
  readonly corrections: boolean;
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

/** What the Core knows about the Edition it runs as. */
export interface Edition {
  readonly id: string;
  readonly locale: string;
  /** The app's name, such as «SLOVO»; its Share Cards carry it as their watermark. */
  readonly displayName: string;
  /** The app's bundle id, such as `app.slovo.uk`. */
  readonly bundleId: string;
  readonly languageTraits: LanguageTraits;
  /** Every Category of the Edition, in the order the Edition declares them. */
  readonly categories: readonly Category[];
  readonly userSettingDefaults: UserSettingDefaults;
  /** The file name of the Edition's notification sound, which the shell bundles; without one, notifications play the system sound. */
  readonly notificationSound: string | undefined;
  /** Whether the Edition turns the given Core feature on. */
  isFeatureEnabled(feature: FeatureSwitch): boolean;
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
    categories,
  } = result.data;
  const { mix, ...settings } = userSettingDefaults;
  return {
    id,
    locale,
    displayName,
    bundleId,
    languageTraits,
    categories,
    userSettingDefaults: {
      ...settings,
      mix: {
        categoryIds: mix.categories === 'all' ? categories.map(({ id }) => id) : mix.categories,
        corrections: mix.corrections,
      },
    },
    notificationSound,
    isFeatureEnabled: (feature) => featureSwitches[feature],
  };
}
