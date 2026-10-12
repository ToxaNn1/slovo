/**
 * The Core's public interface. Every Edition reaches Core behaviour through
 * this module only (ADR 0006).
 */
export type {
  Correction,
  CorrectionType,
  Entry,
  EntryKind,
  Example,
  ExamplePair,
  Gender,
  PartOfSpeech,
  Register,
  Word,
} from '@slovo/contracts';
export { createContent, type Content } from './content';
export { buildCorrectionCard, type CorrectionCardModel } from './correction-card';
export { coreDecor, InvalidDecorError, loadDecor, type Decor } from './decor';
export {
  CORRECTION_EVERY,
  openFeed,
  SEEN_DWELL_MS,
  type CorrectionFeedCard,
  type EntryFeedCard,
  type Feed,
  type FeedCard,
  type WordFeedCard,
} from './feed';
export type { LocalDate } from './local-date';
export {
  InvalidEditionConfigError,
  loadEdition,
  type Edition,
  type Mix,
  type UserSettingDefaults,
} from './edition';
export type { Category, FeatureSwitch, FontSize, LanguageTraits, Theme } from '@slovo/contracts';
export {
  colorSchemeFor,
  createSettings,
  type ColorScheme,
  type Settings,
  type UserSettings,
} from './settings';
export { renderStress } from './stress';
export { createSwipeHint, type SwipeHint } from './swipe-hint';
export {
  buildWordCard,
  type LinkedCorrection,
  type WordCardDetails,
  type WordCardModel,
} from './word-card';
export {
  systemClock,
  systemRandom,
  type Clock,
  type ContentReadPort,
  type Random,
  type UserStateChanges,
  type UserStatePort,
} from './ports';
export {
  createMemoryUserStatePort,
  openUserState,
  UserStateTooNewError,
  type UserState,
  type UserStateMigration,
} from './user-state';
