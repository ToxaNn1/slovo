/**
 * The Core's public interface. Every Edition reaches Core behaviour through
 * this module only (ADR 0006). It exports what the rest of the workspace
 * imports, never what only the Core's own tests use, and every Extension
 * Point; the fakes of the ports sit behind `@slovo/core/testing`.
 */
export type { Correction, Entry, Example, FeatureSwitch, Idiom, Word } from '@slovo/contracts';
export { openAccount, type Account, type AccountState } from './account/account';
export { openComposition, type Composition } from './composition';
export {
  type Collection,
  type CollectionEntry,
  type CollectionNameRefusal,
  type CollectionResult,
  type Collections,
} from './saved/collections';
export { type CollectionLinkPreview } from './collection-links/copy-collection';
export { buildCorrectionCard, type CorrectionCardModel } from './entries/correction-card';
export { type IdiomCardModel } from './entries/idiom-card';
export { type SynonymRowCardModel, type SynonymRowMemberModel } from './entries/synonym-row-card';
export { type TipCardModel } from './entries/tip-card';
export { selfCheckSynonymRowCard, selfCheckTipCard } from './entries/self-check';
export {
  buildSynonymRowShareCard,
  buildTipShareCard,
  buildWeeklyRecapShareCard,
  type SynonymRowShareCardModel,
  type TipShareCardModel,
  type WeeklyRecapShareCardModel,
} from './share/share-card';
export { coreDecor, loadDecor, type Decor } from './edition/decor';
export { createEntries, type Entries } from './entries/entries';
export type { EntryRowModel } from './entries/entry-row';
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
  type AnyEntryCard,
  type EntryFeedCard,
  type FeedCard,
  type FeedNoticeCard,
  type IdiomFeedCard,
  type SynonymRowFeedCard,
  type TipFeedCard,
  type WordFeedCard,
} from './feed/feed-card';
export { type FeedNotice, type FirstWeekDay } from './feed/feed-notices';
export { type GameModeOffer, type GameState, type OfferedBest } from './game/game';
export {
  type CurrentGame,
  type GameTime,
  type GivenAnswer,
  type GridCell,
  type PlayedRound,
  type Round,
  type RoundAnswer,
} from './game/game-in-play';
export {
  ROUND_OPTIONS,
  type AnswerSheet,
  type FixedChip,
  type GameEdition,
  type GameMode,
  type GameModeRefusal,
  type GridPair,
  type RoundContent,
  type RoundForm,
  type RoundInput,
  type RoundOption,
  type TextRange,
} from './game/game-mode';
export { buildGameReview, type GameReviewItem } from './game/game-review';
export { GAME_ROUNDS } from './game/round-plan';
export { staysInPlace } from './game/by-letters-mode';
export { gapOf } from './game/guess-word';
export { type MoodChoice } from './mood/mood-draw';
export { type SearchResults } from './search/search';
export { createGameHaptics, LIFE_LOST_DELAY, type GameHaptics } from './game/game-haptics';
export { createHaptics, type HapticEngine, type Haptics } from './game/haptics';
export { type HiddenEntry } from './mix/hidden-entries';
export { type HideTarget, type HidingChange } from './mix/hiding';
export { HISTORY_CAP, type HistoryEntry } from './saved/history';
export { type WordOfTheDayArchiveDay } from './saved/word-of-the-day-archive';
export { groupByLocalDay, relativeTimeOf, type RelativeTime } from './saved/history-time';
export { type KnowledgeMark } from './knowledge/knowledge-record';
export { type KnownCounts, type LearningEntry } from './knowledge/knowledge';
export {
  openCounterReads,
  type CounterLine,
  type CounterReads,
} from './community-counters/counter-reads';
export { openCounterSending } from './community-counters/counter-sending';
export {
  dateKeyOf,
  formatTimeOfDay,
  localDayOf,
  localTimeOf,
  parseLocalDate,
  parseTimeOfDay,
  untilNextLocalDay,
  type LocalDate,
  type LocalDay,
} from './local-date';
export {
  type CrosswordPlace,
  type DailyCrossword,
  type DailyCrosswordState,
  type DailyCrosswordWord,
} from './game/daily-crossword';
export { decorOf, loadSeasonalMotifs } from './decor/decor-of';
export { loadEdition, type Edition } from './edition/edition';
export { openRemoteSwitches } from './edition/remote-switches';
export {
  colorSchemeFor,
  createSettings,
  type ColorScheme,
  type Settings,
  type SettingsDefaults,
  type UserSettings,
} from './settings/settings';
export { renderStress, STRESS_MARK, withoutStress } from './entries/stress';
export { createSwipeHint, type SwipeHint } from './feed/swipe-hint';
export { buildWordCard, type WordCardModel } from './entries/word-card';
export { createContentUpdate, type ContentUpdate } from './content-update/content-update';
export type { ContentApi, PackFiles, PackVersion } from './ports';
export { type ProgressState } from './progress/progress';
export type { CalendarDay, CalendarMonth } from './progress/calendar';
export { type WeeklyRecapModel } from './progress/weekly-recap';
export {
  categoriesInMix,
  featureOfKind,
  MIX_KINDS,
  type CategoriesInMix,
  type CategoryKind,
  type MixKind,
  type MixKindName,
  type MixState,
} from './entries/mix';
export { type OnboardingStep, type SampleNotification } from './onboarding/onboarding';
export { type RarityTestAnswer, type RarityTestWord } from './rarity-test/rarity-test';
// The shell keeps the Session in memory on a development client without the Keychain.
export { createMemorySessionStore } from './account/memory-session-store';
export { type CollectionShareRefusal } from './collection-links/share-collection';
export { openMistakeReports, type MistakeReports } from './mistake-reports/mistake-reports';
export { openSync, type Sync, type SyncState } from './sync/sync';
export { NOTIFICATION_BODY_LENGTH } from './notifications/notification-text';
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
  type CollectionLinksApi,
  type CommunityWordApi,
  type ContentReadPort,
  type CountersApi,
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
  type ReportsApi,
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
