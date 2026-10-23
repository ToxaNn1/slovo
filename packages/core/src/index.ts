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
  Idiom,
  IdiomType,
  PartOfSpeech,
  Register,
  Word,
} from '@slovo/contracts';
export {
  openAccount,
  type Account,
  type AccountProblem,
  type AccountRequest,
  type AccountState,
} from './account';
export { openComposition, type Composition } from './composition';
export {
  type Collection,
  type CollectionEntry,
  type CollectionNameRefusal,
  type CollectionResult,
  type Collections,
} from './saved/collections';
export { buildCorrectionCard, type CorrectionCardModel } from './entries/correction-card';
export { buildIdiomCard, type IdiomCardModel } from './entries/idiom-card';
export { openCycle, type Cycle, type CycleChange } from './feed/cycle';
export { coreDecor, InvalidDecorError, loadDecor, type Decor } from './edition/decor';
export {
  createEntries,
  type EligibleOfKind,
  type Entries,
  type EntryIds,
  type KindRefusal,
} from './entries/entries';
export { buildEntryRow, type EntryKindKey, type EntryRowModel } from './entries/entry-row';
export { type Favorite, type Favorites } from './saved/favorites';
export {
  buildEntryCard,
  CORRECTION_EVERY,
  IDIOM_EVERY,
  isTodaysWordOfTheDay,
  SEEN_DWELL_MS,
  type Feed,
} from './feed/feed';
export {
  entryIdOf,
  type CorrectionFeedCard,
  type EntryFeedCard,
  type FeedCard,
  type IdiomFeedCard,
  type WordFeedCard,
} from './feed/feed-card';
export { type Game, type GameModeOffer, type GameState } from './game/game';
export {
  GAME_LIVES,
  type CurrentGame,
  type GameStatus,
  type PlayedRound,
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
  answerKnowledge,
  isDue,
  isLearned,
  shownMark,
  type KnowledgeMark,
  type KnowledgeRecord,
  type ReviewStep,
} from './knowledge/knowledge-record';
export { type Knowledge, type KnowledgeState, type LearningEntry } from './knowledge/knowledge';
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
export { openRemoteSwitches, type RemoteSwitches } from './edition/remote-switches';
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
  type SettingsDefaults,
  type UserSettings,
} from './settings';
export { renderStress, STRESS_MARK, withoutStress } from './entries/stress';
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
export { CONTENT_UPDATE_EVERY, createContentUpdate, type ContentUpdate } from './content-update';
export type { ContentApi, ContentApiFailure, PackFiles, PackVersion } from './ports';
export {
  createFakeContentApi,
  type FakeContentApi,
  type FakePublishedPack,
} from './fakes/fake-content-api';
export {
  createMemoryPackFiles,
  type MemoryPackFile,
  type MemoryPackFiles,
} from './fakes/memory-pack-files';
export { type Progress, type ProgressState } from './progress';
export { type Mix, type MixEdition, type MixState } from './entries/mix';
export {
  type Onboarding,
  type OnboardingState,
  type OnboardingStep,
  type SampleNotification,
} from './onboarding';
export { createFakeAccountApi, type FakeAccountApi, type SentCode } from './fakes/fake-account-api';
export { createMemorySessionStore } from './fakes/memory-session-store';
export { createSyncExchange, type SyncExchange, type SyncResult } from './sync/exchange';
export { openSync, SYNC_AFTER_WRITE, type Sync, type SyncState } from './sync/sync';
export { createFakeSyncApi, type FakeSyncApi, type KeptRecord } from './fakes/fake-sync-api';
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
  type AccountApi,
  type AccountApiFailure,
  type Clock,
  type ContentReadPort,
  type Json,
  type KeptSession,
  type NotificationPermission,
  type NotificationSchedulerPort,
  type PlannedNotification,
  type PlannedSound,
  type Random,
  type RecordChange,
  type RemoteSwitchesAnswer,
  type RequestFailure,
  type Schedule,
  type SessionStore,
  type SwitchesApi,
  type SyncApi,
  type SyncApiFailure,
  type UserStateChanges,
  type UserStatePort,
} from './ports';
export { syncMarkOf, userStateRecords } from './user-state/user-state-schema';
export {
  createMemoryUserStatePort,
  openUserState,
  UserStateTooNewError,
  type UserState,
} from './user-state/user-state';
export {
  trackChanges,
  type PendingChange,
  type TrackedUserState,
} from './user-state/tracked-user-state';
export type { UserStateMigration } from './user-state/user-state-migration';
