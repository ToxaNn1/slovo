/**
 * The Core's public interface. Every Edition reaches Core behaviour through
 * this module only (ADR 0006). It exports only what the non-test code of the
 * rest of the workspace imports (ADR 0018, 0027; `scripts/core-exports.mjs`
 * checks it); what only tests need sits behind `@slovo/core/testing`.
 */
export type { Example, FeatureSwitch } from '@slovo/contracts';
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
export { type CorrectionCardModel } from './entries/correction-card';
export { type IdiomCardModel } from './entries/idiom-card';
export { type SynonymRowCardModel, type SynonymRowMemberModel } from './entries/synonym-row-card';
export { type TipCardModel } from './entries/tip-card';
export { selfCheckSynonymRowCard, selfCheckTipCard } from './entries/self-check';
export {
  buildShareCardContent,
  type ShareCardBody,
  type ShareCardContent,
  type ShareCardSubject,
} from './share/share-card';
export { type ShareCardKind } from './analytics/analytics';
export { type ProgressShareCard } from './share/progress-share-cards';
export { partOfSpeechText, registerText } from './entries/part-of-speech';
export { stressLabel } from './entries/stress-label';
export { sentences } from './sentences';
export { coreDecor, loadDecor, type Decor } from './edition/decor';
export { type AskableEntry } from './entries/entries';
export {
  linkFromOutside,
  linkSourceOf,
  linkTo,
  parseLink,
  type EntryLinkSource,
} from './entries/entry-links';
export { buildEntryRow, type EntryRowModel } from './entries/entry-row';
export { type Favorite } from './saved/favorites';
export { isTodaysWordOfTheDay, type Feed } from './feed/feed';
export { categoryFeedPage, type CategoryFeedPage } from './feed/category-feed';
export {
  type AnyEntryCard,
  type EntryFeedCard,
  type FeedCard,
  type FeedNoticeCard,
  type SynonymRowFeedCard,
  type TipFeedCard,
} from './feed/feed-card';
export { entryCardTitle } from './feed/entry-feed-card';
export { type FeedNotice, type LaterQuestion } from './feed-notice';
export { ENOUGH_FOR_TODAY_SEEN, type FirstWeekDay } from './feed/feed-notices';
export {
  countsAsWon,
  streakOf,
  type GameModeOffer,
  type GameState,
  type OfferedBest,
  type Streak,
} from './game/game';
export {
  type CurrentGame,
  type GameEnd,
  type GameOver,
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
  type AnswerSheet,
  type ChipLayout,
  type FixedChip,
  type RoundContent,
  type RoundOption,
  type TextRange,
} from './game/game-mode';
export { buildGameReview, type GameReviewItem } from './game/game-review';
export { GAME_ROUNDS } from './game/round-plan';
export { type SearchResults } from './search/search';
export { createGameHaptics, LIFE_LOST_DELAY, type GameHaptics } from './game/game-haptics';
export { createHaptics, type HapticEngine, type Haptics } from './game/haptics';
export {
  createInterfaceSounds,
  silentInterfaceSounds,
  type InterfaceSound,
  type InterfaceSounds,
  type SoundEngine,
} from './sounds/interface-sounds';
export { type HiddenEntry } from './mix/hidden-entries';
export { type HidingChange } from './mix/hiding';
export { HISTORY_CAP, type HistoryEntry } from './saved/history';
export { type WordOfTheDayArchiveDay } from './saved/word-of-the-day-archive';
export { groupByLocalDay } from './saved/history-time';
export { type KnowledgeMark } from './knowledge/knowledge-record';
export { type KnownCounts, type LearningEntry } from './knowledge/knowledge';
export {
  openCounterReads,
  type CounterLine,
  type CounterReads,
} from './community-counters/counter-reads';
export { openCounterSending } from './community-counters/counter-sending';
export {
  createAnalytics,
  createVisit,
  type Visit,
  type AnalyticsEvent,
  type AnalyticsEvents,
  type AnalyticsPort,
  type AnalyticsSink,
} from './analytics/analytics';
export {
  dateKeyOf,
  formatTimeOfDay,
  localDateAfter,
  localDayOf,
  localTimeOf,
  parseLocalDate,
  parseTimeOfDay,
  todayDate,
  untilNextLocalDay,
  type LocalDate,
  type LocalDay,
} from './local-date';
export {
  isSolved,
  type CrosswordPuzzle,
  type PuzzleAction,
  type PuzzlePlace,
  type PuzzleState,
} from './game/crossword-puzzle';
export {
  type CrossingPuzzle,
  type CrossingWord,
} from './game/crossing-crossword';
export {
  crossingCellKey,
  crossingGridOf,
  isCrossingSolved,
  type CrossingAction,
  type CrossingPlay,
} from './game/crossing-play';
export { type CrossingCrossword } from './game/crossing-crossword-progress';
export { type TracedCrossword } from './game/traced-crossword';
export { type DailyCrosswordOpening } from './game/daily-crossword';
export { decorOf, loadSeasonalMotifs } from './decor/decor-of';
export { loadEdition, type Edition } from './edition/edition';
export { openRemoteSwitches, type ReaderFacts } from './edition/remote-switches';
export { evaluateSwitches } from './edition/switch-evaluator';
export { forceUpdateOf, type ForceUpdate, type ForceUpdateFacts } from './edition/force-update';
export { readInstallId } from './edition/install-id';
export {
  colorSchemeFor,
  createSettings,
  type ColorScheme,
  type Settings,
  type SettingsDefaults,
  type UserSettings,
} from './settings/settings';
export { STRESS_MARK, withoutStress } from './entries/stress';
export { createGesturesHint, type GesturesHint } from './feed/gestures-hint';
export { type WordCardModel } from './entries/word-card';
export { createContentUpdate, type ContentUpdate } from './content-update/content-update';
export type {
  CachedMediaFile,
  ContentStore,
  MediaCache,
  MediaFetcher,
  PackVersion,
  WordMedia,
} from './ports';
export { createMedia, PREFETCH_CARDS, type Media } from './media/media';
export { type ProgressState } from './progress/progress';
export type { CrosswordSolve, XpLogState } from './progress/xp-log';
export type { BadgeState } from './progress/badges';
export { totalFor, type LevelMilestone, type LevelState } from './progress/levels';
export type { CalendarDay, CalendarWeek } from './progress/calendar';
export { type WeeklyRecapModel } from './feed/weekly-recap';
export {
  featureOfKind,
  type CategoryKind,
  type MixKind,
  type MixKindName,
} from './entries/entry-kinds';
export {
  categoryTarget,
  categoryPlace,
  kindsShown,
  type CategoryPlace,
  type EntryToHide,
  type HideOption,
  type HideTarget,
  type MixChip,
  type MixScreen,
  type MixState,
  type OutOfMix,
} from './entries/mix';
export { type OnboardingStep } from './onboarding/onboarding';
export type { OptionQuestion, QuestionnaireOption } from './questionnaire/questionnaire';
export { type RarityTestAnswer, type RarityTestWord } from './mix/rarity-test';
// The shell keeps the Session in memory on a development client without the Keychain.
export { createMemorySessionStore } from './account/memory-session-store';
export { type CollectionShareRefusal } from './collection-links/share-collection';
export { openMistakeReports, type MistakeReports } from './mistake-reports/mistake-reports';
export { openSync, type Sync, type SyncState } from './sync/sync';
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
  type NotificationKind,
  type PlannedNotification,
  type PlannedSound,
  type Random,
  type Schedule,
  type SessionStore,
  type UserStatePort,
} from './ports';
export { openTrackedUserState, type TrackedUserState } from './user-state/tracked-user-state';
export {
  changesOfFacts,
  type UserStateFact,
  type UserStateFacts,
} from './user-state/user-state-facts';
export { type CorrectionTypeRow, type CorrectionTypeTile } from './dashboard/correction-types';
export {
  type CuratedCollectionCard,
  type CuratedCollectionScreen,
} from './dashboard/curated-collections';
export {
  type DashboardBlock,
  type MoodBlock,
  type PreviousWordsBlock,
  type WordOfTheDayHero,
} from './dashboard/dashboard';
