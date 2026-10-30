/**
 * The Core's test entry, `@slovo/core/testing`: the fakes of its ports for the
 * tests of other workspace parts. Only a test or a test-support module imports
 * it (dependency-cruiser's `only-tests-import-the-core-testing-entry`).
 */
export {
  createFakeBackend,
  type FakeBackend,
  type FakeFailure,
  type FakeFailureReason,
  type FakePublishedPack,
  type ProcedureName,
} from './fakes/fake-backend';
export {
  createFakeGoogleSignInSheet,
  type FakeGoogleSignInSheet,
} from './fakes/fake-google-sign-in-sheet';
export {
  createFakeNotificationScheduler,
  type FakeNotificationScheduler,
} from './fakes/fake-notification-scheduler';
export { createMemoryContentPort } from './fakes/memory-content';
export { createMemoryPackFiles, type MemoryPackFile } from './fakes/memory-pack-files';
export { testEdition, type TestEditionOverrides } from './test-support';
