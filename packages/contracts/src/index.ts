/**
 * The contracts: the single definition of every shape shared across the
 * factory (Entries, the Edition config, the Language Pack, the API).
 */
export {
  CategorySchema,
  DistractorRuleSchema,
  EditionConfigSchema,
  FeatureSwitchesSchema,
  FontSizeSchema,
  LanguageTraitsSchema,
  MAX_NOTIFICATION_TIMES,
  MixConfigSchema,
  ThemeSchema,
  TimeOfDaySchema,
  UserSettingDefaultsConfigSchema,
  type Category,
  type DistractorRule,
  type EditionConfig,
  type FeatureSwitch,
  type FeatureSwitches,
  type FontSize,
  type LanguageTraits,
  type MixConfig,
  type Theme,
  type UserSettingDefaultsConfig,
} from './edition';
export {
  ExampleSchema,
  GenderSchema,
  PartOfSpeechSchema,
  RaritySchema,
  RegisterSchema,
  SourceSchema,
  WordIdSchema,
  WordSchema,
  type Example,
  type Gender,
  type PartOfSpeech,
  type Register,
  type Source,
  type Word,
  type WordInput,
} from './word';
