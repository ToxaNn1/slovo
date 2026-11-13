/**
 * The Core's test entry, `@slovo/core/testing`: the fakes of its ports and the
 * Core functions, models and constants that only the tests of other workspace
 * parts use. Only a test or a test-support module imports
 * it (dependency-cruiser's `only-tests-import-the-core-testing-entry`).
 */
export {
  createFakeBackend,
  type FakeBackend,
  type FakeFailure,
  type FakeFailureReason,
  type ProcedureName,
} from './fakes/fake-backend';
export {
  createFakeAppleSignInSheet,
  type FakeAppleSignInSheet,
} from './fakes/fake-apple-sign-in-sheet';
export {
  createFakeGoogleSignInSheet,
  type FakeGoogleSignInSheet,
} from './fakes/fake-google-sign-in-sheet';
export {
  createFakeNotificationScheduler,
  type FakeNotificationScheduler,
} from './fakes/fake-notification-scheduler';
export { createMemoryContentPort } from './fakes/memory-content';
export {
  readFact,
  seedUserState,
  type UserStateFact,
  type UserStateFactName,
  type UserStateFacts,
} from './fakes/seeded-user-state';
export { UserStateTooNewError } from './user-state/user-state';
export { createMemoryContentStore, type MemoryContentStore } from './fakes/memory-content-store';
export { createMemoryMediaCache } from './fakes/memory-media-cache';
export { createFakeMediaFetcher, type FakeMediaFetcher } from './fakes/fake-media-fetcher';
export type { MediaSource } from './media/media';
export { fakeClock, testEdition, type TestEditionOverrides } from './test-support';
// Core functions, models and constants that only tests of other packages use.
export { buildCorrectionCard } from './entries/correction-card';
export { wordGrammarText } from './entries/part-of-speech';
export { createEntries, EVERYTHING_IN, type Entries } from './entries/entries';
export { buildEntryCard, SEEN_DWELL_MS } from './feed/feed';
export { type IdiomFeedCard, type WordFeedCard } from './feed/feed-card';
export { type PlayingGame } from './game/game';
export { type GameMode, type GameModeGroup } from './game/game-mode';
export { relativeTimeOf } from './saved/history-time';
export { playPuzzle, startPuzzle } from './game/crossword-puzzle';
export { renderStress } from './entries/stress';
export { buildWordCard } from './entries/word-card';
export type { XpRecord } from './progress/records';
export { ALL_KINDS, ENTRY_KINDS } from './entries/entry-kinds';
export { NOTIFICATION_BODY_LENGTH } from './notifications/notification-text';
export { type UserStateChanges } from './ports';
