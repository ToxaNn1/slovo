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
} from './saved/collections';
export { buildCorrectionCard, type CorrectionCardModel } from './entries/correction-card';
export { openCycle, type Cycle, type CycleChange } from './feed/cycle';
export { coreDecor, InvalidDecorError, loadDecor, type Decor } from './edition/decor';
export {
  createEntries,
  type EligibleOfKind,
  type Entries,
  type EntryIds,
  type KindRefusal,
} from './entries/entries';
export { type EntryRowModel } from './entries/entry-row';
export { type Favorite, type Favorites } from './saved/favorites';
export {
  buildEntryCard,
  CORRECTION_EVERY,
  isTodaysWordOfTheDay,
  SEEN_DWELL_MS,
  type Feed,
} from './feed/feed';
export {
  entryIdOf,
  type CorrectionFeedCard,
  type EntryFeedCard,
  type FeedCard,
  type WordFeedCard,
} from './feed/feed-card';
export { type Game, type GameModeOffer, type GameState } from './game/game';
export {
  GAME_LIVES,
  type CurrentGame,
  type GameStatus,
  type Round,
  type RoundAnswer,
} from './game/game-in-play';
export {
  ROUND_OPTIONS,
  type AnswerSheet,
  type GameEdition,
  type GameMode,
  type GameModeRefusal,
  type RoundContent,
  type RoundInput,
  type RoundOption,
  type TextRange,
} from './game/game-mode';
export { GAME_ROUNDS } from './game/round-plan';
export {
  createGameHaptics,
  LIFE_LOST_DELAY,
  WIN_SECOND_SUCCESS,
  type GameHaptics,
} from './game/game-haptics';
export { createHaptics, type HapticEngine, type Haptics } from './game/haptics';
export { type HiddenEntries, type HiddenEntry } from './hidden/hidden-entries';
export {
  type UnhideResult,
  type HideResult,
  type HideTarget,
  type HidingChange,
} from './hidden/hiding';
export { HISTORY_CAP, type History, type HistoryEntry } from './saved/history';
export {
  groupByLocalDay,
  relativeTimeOf,
  type DayGroup,
  type RelativeTime,
} from './saved/history-time';
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
} from './edition/edition';
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
export { renderStress } from './entries/stress';
export { createSwipeHint, type SwipeHint } from './feed/swipe-hint';
export { type Widget } from './widget';
export {
  buildWordCard,
  type LinkedCorrection,
  type WordCardDetails,
  type WordCardModel,
} from './entries/word-card';
export {
  openWordOfTheDay,
  type WordOfTheDay,
  type WordOfTheDayChoice,
} from './feed/word-of-the-day';
export { createMemoryContentPort } from './fakes/memory-content';
export { type Progress, type ProgressState } from './progress';
export { type Mix, type MixEdition, type MixState } from './entries/mix';
export {
  type Onboarding,
  type OnboardingState,
  type OnboardingStep,
  type SampleNotification,
} from './onboarding';
export {
  createFakeNotificationScheduler,
  type FakeNotificationScheduler,
} from './fakes/fake-notification-scheduler';
export {
  NOTIFICATION_BODY_LENGTH,
  type NotificationScheduling,
} from './notifications/notification-plan';
export {
  type NotificationTimeRefusal,
  type Notifications,
  type NotificationsEdition,
  type NotificationsState,
} from './notifications/notifications';
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
export { userStateRecords } from './user-state/user-state-schema';
export {
  createMemoryUserStatePort,
  openUserState,
  UserStateTooNewError,
  type UserState,
} from './user-state/user-state';
export type { UserStateMigration } from './user-state/user-state-migration';
