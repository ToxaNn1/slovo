/**
 * The contracts: the single definition of every shape shared across the
 * factory (Entries, the Edition config, the Language Pack). The API contract
 * has its own entry point, `@slovo/contracts/api`, so only its callers load
 * oRPC.
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
  NotificationTimesSchema,
  ThemeSchema,
  TimeOfDaySchema,
  UserSettingDefaultsConfigSchema,
  editionAppGroup,
  type Category,
  type DistractorRule,
  type EditionConfig,
  type FeatureSwitch,
  type FeatureSwitches,
  type FontSize,
  type LanguageTraits,
  type LegalPages,
  type MixConfig,
  type Theme,
  type UserSettingDefaultsConfig,
} from './edition';
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
  SplashDecorSchema,
  type DecorLayer,
  type DecorMotif,
  type EditionDecor,
  type SplashDecor,
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
export { EntrySchema, type Entry, type EntryKind } from './entry';
export { SYNC_BATCH_SIZE } from './sync';
export { SourceSchema, type Source } from './shared';
export {
  ExampleSchema,
  GenderSchema,
  PartOfSpeechSchema,
  RaritySchema,
  RegisterSchema,
  WordIdSchema,
  WordSchema,
  type Example,
  type Gender,
  type PartOfSpeech,
  type Register,
  type Word,
  type WordInput,
} from './word';
export {
  serializeWidgetSnapshot,
  WIDGET_SNAPSHOT_FORMAT,
  WidgetSnapshotSchema,
  type WidgetEntry,
  type WidgetSnapshot,
} from './widget-snapshot';
