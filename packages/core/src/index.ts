/**
 * The Core's public interface. Every Edition reaches Core behaviour through
 * this module only (ADR 0006). It exports what the rest of the workspace
 * imports and every Extension Point; the fakes of the ports sit behind
 * `@slovo/core/testing`.
 */
export type { Correction, Entry, Example, FeatureSwitch, Idiom, Word } from '@slovo/contracts';
export { openAccount, type Account, type AccountState } from './account';
export { openComposition, type Composition } from './composition';
export {
  type Collection,
  type CollectionEntry,
  type CollectionNameRefusal,
  type CollectionResult,
  type Collections,
} from './saved/collections';
export { buildCorrectionCard, type CorrectionCardModel } from './entries/correction-card';
export { type IdiomCardModel } from './entries/idiom-card';
export { coreDecor, loadDecor, type Decor } from './edition/decor';
export { createEntries, type Entries } from './entries/entries';
export { buildEntryRow, type EntryRowModel } from './entries/entry-row';
export { type Favorite } from './saved/favorites';
export {
  buildEntryCard,
  CORRECTION_EVERY,
  IDIOM_EVERY,
  isTodaysWordOfTheDay,
  SEEN_DWELL_MS,
  type Feed,
} from './feed/feed';
export {
  type EntryFeedCard,
  type FeedCard,
  type IdiomFeedCard,
  type WordFeedCard,
} from './feed/feed-card';
export { type GameModeOffer, type GameState } from './game/game';
export {
  GAME_LIVES,
  type CurrentGame,
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
export { createGameHaptics, LIFE_LOST_DELAY, type GameHaptics } from './game/game-haptics';
export { createHaptics, type HapticEngine, type Haptics } from './game/haptics';
export { type HiddenEntry } from './hidden/hidden-entries';
export { type HideTarget, type HidingChange } from './hidden/hiding';
export { HISTORY_CAP, type HistoryEntry } from './saved/history';
export { groupByLocalDay, relativeTimeOf, type RelativeTime } from './saved/history-time';
export { type KnowledgeMark } from './knowledge/knowledge-record';
export { type KnownCounts, type LearningEntry } from './knowledge/knowledge';
export {
  formatTimeOfDay,
  localDayOf,
  localTimeOf,
  parseLocalDate,
  parseTimeOfDay,
  untilNextLocalDay,
  type LocalDate,
  type LocalDay,
} from './local-date';
export { loadEdition, type Edition } from './edition/edition';
export { openRemoteSwitches } from './edition/remote-switches';
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
export { buildWordCard, type WordCardModel } from './entries/word-card';
export { createContentUpdate, type ContentUpdate } from './content-update';
export type { ContentApi, PackFiles, PackVersion } from './ports';
export { type ProgressState } from './progress';
export { featureOfKind, MIX_KINDS, type MixKind, type MixState } from './entries/mix';
export { type OnboardingStep, type SampleNotification } from './onboarding';
// The shell keeps the Session in memory on a development client without the Keychain.
export { createMemorySessionStore } from './fakes/memory-session-store';
export { openSync, type Sync, type SyncState } from './sync/sync';
export { NOTIFICATION_BODY_LENGTH } from './notifications/notification-plan';
export {
  type NotificationTimeRefusal,
  type NotificationsState,
} from './notifications/notifications';
export {
  systemClock,
  systemRandom,
  type AccountApi,
  type AccountApiFailure,
  type Clock,
  type ContentReadPort,
  type GoogleSignInSheet,
  type KeptSession,
  type NotificationPermission,
  type NotificationSchedulerPort,
  type PlannedNotification,
  type PlannedSound,
  type Random,
  type RecordChange,
  type RequestFailure,
  type Schedule,
  type SessionStore,
  type SwitchesApi,
  type SyncApi,
  type SyncApiFailure,
  type UserStateChanges,
  type UserStatePort,
} from './ports';
export { userStateRecords } from './user-state/user-state-schema';
export {
  createMemoryUserStatePort,
  openUserState,
  UserStateTooNewError,
} from './user-state/user-state';
export { trackChanges, type TrackedUserState } from './user-state/tracked-user-state';
export type { UserStateMigration } from './user-state/user-state-migration';
