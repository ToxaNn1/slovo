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
export {
  createEntries,
  type EligibleOfKind,
  type Entries,
  type EntryIds,
  type KindRefusal,
} from './entries';
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
export {
  GAME_LIVES,
  GAME_ROUNDS,
  ROUND_OPTIONS,
  type AnswerSheet,
  type CurrentGame,
  type Game,
  type GameEdition,
  type GameMode,
  type GameModeOffer,
  type GameModeRefusal,
  type GameState,
  type GameStatus,
  type Round,
  type RoundAnswer,
  type RoundContent,
  type RoundInput,
  type RoundOption,
  type TextRange,
} from './game';
export {
  createGameHaptics,
  LIFE_LOST_DELAY,
  WIN_SECOND_SUCCESS,
  type GameHaptics,
} from './game-haptics';
export { createHaptics, type HapticEngine, type Haptics } from './haptics';
export { type HiddenEntries, type HiddenEntry } from './hidden-entries';
export { type UnhideResult, type HideResult, type HideTarget, type HidingChange } from './hiding';
export { HISTORY_CAP, type History, type HistoryEntry } from './history';
export { groupByLocalDay, relativeTimeOf, type DayGroup, type RelativeTime } from './history-time';
export {
  formatTimeOfDay,
  localDayOf,
  localTimeOf,
  parseLocalDate,
  parseTimeOfDay,
  untilNextLocalDay,
  type LocalDate,
  type LocalDay,
  type TimeOfDay,
} from './local-date';
export {
  InvalidEditionConfigError,
  loadEdition,
  type Edition,
  type DefaultMix,
  type UserSettingDefaults,
} from './edition';
export type {
  Category,
  DistractorRule,
  FeatureSwitch,
  FontSize,
  LanguageTraits,
  Theme,
} from '@slovo/contracts';
export {
  colorSchemeFor,
  createSettings,
  type ColorScheme,
  type Settings,
  type UserSettings,
} from './settings';
export { renderStress } from './stress';
export { createSwipeHint, type SwipeHint } from './swipe-hint';
export { type Widget } from './widget';
export {
  buildWordCard,
  type LinkedCorrection,
  type WordCardDetails,
  type WordCardModel,
} from './word-card';
export { openWordOfTheDay, type WordOfTheDay, type WordOfTheDayChoice } from './word-of-the-day';
export { createMemoryContentPort } from './memory-content';
export { type Progress, type ProgressState } from './progress';
export { type Mix, type MixEdition, type MixState } from './mix';
export {
  type Onboarding,
  type OnboardingState,
  type OnboardingStep,
  type SampleNotification,
} from './onboarding';
export {
  createFakeNotificationScheduler,
  type FakeNotificationScheduler,
} from './fake-notification-scheduler';
export { NOTIFICATION_BODY_LENGTH, type NotificationScheduling } from './notification-plan';
export {
  type NotificationTimeRefusal,
  type Notifications,
  type NotificationsEdition,
  type NotificationsState,
} from './notifications';
export {
  systemClock,
  systemRandom,
  type Clock,
  type ContentReadPort,
  type NotificationPermission,
  type NotificationSchedulerPort,
  type PlannedNotification,
  type PlannedSound,
  type Random,
  type Schedule,
  type UserStateChanges,
  type UserStatePort,
} from './ports';
export { userStateRecords } from './user-state-schema';
export {
  createMemoryUserStatePort,
  openUserState,
  UserStateTooNewError,
  type UserState,
} from './user-state';
export type { UserStateMigration } from './user-state-migration';
