export {
  AppConfigSchema,
  DomainSchema,
  appReleaseProblems,
  type AppConfig,
  type ReleaseProblem,
} from './app-config';
/**
 * The contracts: the single definition of every shape shared across the
 * factory (Entries, the Edition config, the Language Pack). The API contract
 * has its own entry point, `@slovo/contracts/api`, so only its callers load
 * oRPC.
 */
export {
  CategorySchema,
  DailyLimitSchema,
  DistractorRuleSchema,
  EditionConfigSchema,
  FeatureSwitchesSchema,
  FontSizeSchema,
  LanguageTraitsSchema,
  MAX_NOTIFICATION_TIMES,
  MixConfigSchema,
  NotificationTimesSchema,
  ThemeSchema,
  TimeOfDaySchema,
  UserSettingDefaultsConfigSchema,
  releaseProblems,
  type Category,
  type DailyLimit,
  type DistractorRule,
  type EditionConfig,
  type FeatureSwitch,
  type FeatureSwitches,
  type FontSize,
  type LanguageTraits,
  type MixConfig,
  type Mood,
  type OriginLanguage,
  type ReleaseProblem,
  type Theme,
  type UserSettingDefaultsConfig,
} from './edition';
export { COUNTERS_BATCH_SIZE } from './community-counters';
export { AccountEmailSchema, SIGN_IN_CODE_DIGITS, SignInCodeSchema } from './account';
export {
  PackMetadataSchema,
  PublishedPackSchema,
  type PackMetadata,
  type PublishedPack,
} from './language-pack';
export { NotificationSoundFileSchema, type NotificationSoundFormat } from './notification-sound';
export {
  ACCOUNT_NAME,
  EditionStringsSchema,
  fill,
  pluralCount,
  PluralLabelSchema,
  PluralSchema,
  type EditionStrings,
  type Plural,
  type PluralLabel,
} from './edition-strings';
export {
  DecorLayerSchema,
  DecorMotifSchema,
  EditionDecorSchema,
  HolidayRuleSchema,
  HolidaySchema,
  SeasonalMotifSchema,
  SeasonMotifsSchema,
  SplashDecorSchema,
  WEEKDAYS,
  type DecorLayer,
  type DecorMotif,
  type EditionDecor,
  type Holiday,
  type HolidayRule,
  type SeasonalMotif,
  type SeasonMotifs,
  type SplashDecor,
  type Weekday,
} from './decor';
export {
  ColorTokensSchema,
  EditionTokensSchema,
  type ColorTokens,
  type EditionTokens,
} from './edition-tokens';
export {
  CorrectionIdSchema,
  CorrectionSchema,
  CorrectionTypeSchema,
  ExamplePairSchema,
  type Correction,
  type CorrectionInput,
  type CorrectionType,
  type ExamplePair,
  type LiteraryUse,
} from './correction';
export {
  IdiomIdSchema,
  IdiomSchema,
  IdiomTypeSchema,
  type Idiom,
  type IdiomInput,
  type IdiomType,
} from './idiom';
export {
  SHADE_NOTE_MAX_LENGTH,
  SynonymRowDominantSchema,
  SynonymRowIdSchema,
  SynonymRowMemberSchema,
  SynonymRowSchema,
  type SynonymRow,
  type SynonymRowDominant,
  type SynonymRowInput,
  type SynonymRowMember,
} from './synonym-row';
export {
  TIP_EXPLANATION_MAX_LENGTH,
  TipGameQuestionSchema,
  TipIdSchema,
  TipSchema,
  type Tip,
  type TipGameQuestion,
  type TipInput,
} from './tip';
export { EntrySchema, type Entry, type EntryKind } from './entry';
export {
  COLLECTION_LINK_NAME_LENGTH,
  COLLECTION_LINK_SIZE,
  CollectionLinkIdSchema,
  CollectionLinkSchema,
  type CollectionLink,
} from './collection-link';
export { type CounterEvent } from './api/counters';
export {
  MistakeReportSchema,
  MistakeTypeSchema,
  REPORT_COMMENT_LENGTH,
  type MistakeReport,
  type MistakeType,
} from './mistake-report';
export { SYNC_BATCH_SIZE } from './sync';
export { SourceSchema, type Source } from './shared';
export {
  ExampleSchema,
  GenderSchema,
  PartOfSpeechSchema,
  RARITIES,
  RaritySchema,
  type Rarity,
  RegisterSchema,
  renderStress,
  STRESS_MARK,
  WordIdSchema,
  WordSchema,
  type Example,
  type Gender,
  type PartOfSpeech,
  type Register,
  type Word,
  type WordInput,
} from './word';
export { SpotlightSnapshotSchema, type SpotlightSnapshot } from './spotlight-snapshot';
export {
  serializeWidgetSnapshot,
  WIDGET_SNAPSHOT_FORMAT,
  WidgetSnapshotSchema,
  type WidgetEntry,
  type WidgetSnapshot,
} from './widget-snapshot';
export {
  CROSSWORD_SIZE,
  CROSSWORD_WORDS,
  CrosswordDaySchema,
  CrosswordDaysSchema,
  CrosswordWordSchema,
  type CrosswordDay,
  type CrosswordWord,
} from './crossword';
