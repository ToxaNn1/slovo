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
export { openComposition, type Composition } from './composition';
export {
  type Collection,
  type CollectionEntry,
  type CollectionNameRefusal,
  type CollectionResult,
  type Collections,
} from './collections';
export { buildCorrectionCard, type CorrectionCardModel } from './correction-card';
export { openCycle, type Cycle, type CycleChange } from './cycle';
export { coreDecor, InvalidDecorError, loadDecor, type Decor } from './decor';
export { createEntries, type Entries, type EntryIds } from './entries';
export { type EntryRowModel } from './entry-row';
export { type Favorite, type Favorites } from './favorites';
export {
  buildEntryCard,
  CORRECTION_EVERY,
  entryIdOf,
  SEEN_DWELL_MS,
  type CorrectionFeedCard,
  type EntryFeedCard,
  type Feed,
  type FeedCard,
  type WordFeedCard,
} from './feed';
export { createHaptics, type HapticEngine, type Haptics } from './haptics';
export { type HiddenEntries, type HiddenEntry } from './hidden-entries';
export { HISTORY_CAP, type History, type HistoryEntry } from './history';
export { groupByLocalDay, relativeTimeOf, type DayGroup, type RelativeTime } from './history-time';
export { localDayOf, localTimeOf, type LocalDate, type LocalDay } from './local-date';
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
export { openWordOfTheDay, type WordOfTheDay, type WordOfTheDayChoice } from './word-of-the-day';
export { createMemoryContentPort } from './memory-content';
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
