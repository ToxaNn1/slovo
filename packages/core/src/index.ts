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
  buildShareCardContent,
  type ShareCardBody,
  type ShareCardContent,
  type ShareCardStrings,
  type ShareCardSubject,
} from './share/share-card';
export { type ShareCardKind } from './analytics/analytics';
export { type ProgressShareCard, type ProgressShareCards } from './share/progress-share-cards';
export { partOfSpeechText, registerText, wordGrammarText } from './entries/part-of-speech';
export { stressLabel } from './entries/stress-label';
export { sentences } from './sentences';
export { coreDecor, loadDecor, type Decor } from './edition/decor';
export { createEntries, type Entries } from './entries/entries';
export type { EntryRowModel } from './entries/entry-row';
export { type Favorite } from './saved/favorites';
export { buildEntryCard, isTodaysWordOfTheDay, SEEN_DWELL_MS, type Feed } from './feed/feed';
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
export { LATER_QUESTIONS, type FeedNotice, type LaterQuestion } from './feed-notice';
export { type FirstWeekDay } from './feed/feed-notices';
export { type GameModeOffer, type GameState, type OfferedBest } from './game/game';
export {
  type CurrentGame,
  type GameTime,
  type GivenAnswer,
  type GridCell,
  type PlayedRound,
  type Round,
  type RoundAnswer,
  type RoundBlank,
} from './game/game';
export {
  GAME_MODE_GROUPS,
  ROUND_OPTIONS,
  type AnswerSheet,
  type ChipKind,
  type FixedChip,
  type GameEdition,
  type GameMode,
  type GameModeGroup,
  type GameModeRefusal,
  type GridPair,
  type RoundContent,
  type RoundForm,
  type RoundInput,
  type RoundLabelKind,
  type RoundOption,
  type TextRange,
} from './game/game-mode';
export { buildGameReview, type GameReviewItem } from './game/game-review';
export { GAME_ROUNDS } from './game/round-plan';
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
export { type ConfirmedCounts, type KnownCounts, type LearningEntry } from './knowledge/knowledge';
export {
  openCounterReads,
  type CounterLine,
  type CounterReads,
} from './community-counters/counter-reads';
export { openCounterSending } from './community-counters/counter-sending';
export {
  createAnalytics,
  noAnalytics,
  type Analytics,
  type AnalyticsEvent,
  type AnalyticsEvents,
  type AnalyticsPort,
  type EntryEventProperties,
} from './analytics/analytics';
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
export type { PackFiles, PackVersion } from './ports';
export { type ProgressState } from './progress/progress';
export type { XpAction, XpAward } from './game/game-xp';
export type { XpLog, XpLogState } from './progress/xp-log';
export type { BadgeProgress, BadgeState, Badges } from './progress/badges';
export type { BreakState, StreakBreak } from './progress/streak-break';
export type { LevelMilestone, LevelState } from './progress/levels';
export type { XpRecord, XpSource } from './user-state/user-state-schema';
export type { CalendarDay, CalendarMonth } from './progress/calendar';
export { type WeeklyRecapModel } from './feed/weekly-recap';
export {
  ALL_KINDS,
  ENTRY_KINDS,
  featureOfKind,
  MIX_KINDS,
  type CategoryKind,
  type MixKind,
  type MixKindName,
} from './entries/entry-kinds';
export {
  categoriesInMix,
  kindsShown,
  type CategoriesInMix,
  type MixKindWeights,
  type MixState,
} from './entries/mix';
export { type OnboardingStep } from './onboarding/onboarding';
export type {
  OptionQuestion,
  Questionnaire,
  QuestionnaireOption,
} from './questionnaire/questionnaire';
export { type RarityTestAnswer, type RarityTestWord } from './mix/rarity-test';
// The shell keeps the Session in memory on a development client without the Keychain.
export { createMemorySessionStore } from './account/memory-session-store';
export { type CollectionShareRefusal } from './collection-links/share-collection';
export {
  openMistakeReports,
  type MistakeReports,
  type ReportsApiFailure,
} from './mistake-reports/mistake-reports';
export { openSync, type Sync, type SyncState } from './sync/sync';
export { type SyncApiFailure } from './sync/exchange';
export { type AccountApiFailure } from './account/account-requests';
export { type CollectionLinksApiFailure } from './collection-links/collection-link-requests';
export { NOTIFICATION_BODY_LENGTH } from './notifications/notification-text';
export {
  type NotificationTimeRefusal,
  type NotificationsState,
} from './notifications/notifications';
export {
  systemClock,
  systemRandom,
  type AppleSignInSheet,
  type Backend,
  type Clock,
  type ContentReadPort,
  type GoogleSignInSheet,
  type KeptSession,
  type NotificationPermission,
  type NotificationSchedulerPort,
  type EveningMessage,
  type NotificationKind,
  type PlannedNotification,
  type PlannedSound,
  type Random,
  type RecordChange,
  type RequestFailure,
  type Schedule,
  type SessionStore,
  type UserStateChanges,
  type UserStatePort,
} from './ports';
export { openTrackedUserState, type TrackedUserState } from './user-state/tracked-user-state';
