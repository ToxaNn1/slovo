/**
 * The Core's test entry, `@slovo/core/testing`: the fakes of its ports for the
 * tests of other workspace parts. Only a test or a test-support module imports
 * it (dependency-cruiser's `only-tests-import-the-core-testing-entry`).
 */
export { createFakeAccountApi } from './fakes/fake-account-api';
export { createFakeContentApi } from './fakes/fake-content-api';
export {
  createFakeGoogleSignInSheet,
  type FakeGoogleSignInSheet,
} from './fakes/fake-google-sign-in-sheet';
export {
  createFakeNotificationScheduler,
  type FakeNotificationScheduler,
} from './fakes/fake-notification-scheduler';
export { createFakeSyncApi } from './fakes/fake-sync-api';
export { createMemoryContentPort } from './fakes/memory-content';
export { createMemoryPackFiles, type MemoryPackFile } from './fakes/memory-pack-files';
