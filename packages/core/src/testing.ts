/**
 * The Core's test entry, `@slovo/core/testing`: the fakes of its ports for the
 * tests of other workspace parts. Only a test or a test-support module imports
 * it (dependency-cruiser's `only-tests-import-the-core-testing-entry`).
 */
export { createFakeAccountApi } from './fakes/fake-account-api';
export {
  createFakeCommunityWordApi,
  type FakeCommunityWordApi,
} from './fakes/fake-community-word-api';
export {
  createFakeCollectionLinksApi,
  type FakeCollectionLinksApi,
} from './fakes/fake-collection-links-api';
export { createFakeContentApi } from './fakes/fake-content-api';
export { createFakeCountersApi, type FakeCountersApi } from './fakes/fake-counters-api';
export {
  createFakeGoogleSignInSheet,
  type FakeGoogleSignInSheet,
} from './fakes/fake-google-sign-in-sheet';
export {
  createFakeNotificationScheduler,
  type FakeNotificationScheduler,
} from './fakes/fake-notification-scheduler';
export { createFakeReportsApi, type FakeReportsApi } from './fakes/fake-reports-api';
export { createFakeSyncApi } from './fakes/fake-sync-api';
export { createMemoryContentPort } from './fakes/memory-content';
export { createMemoryPackFiles, type MemoryPackFile } from './fakes/memory-pack-files';
export { testEdition, type TestEditionOverrides } from './test-support';
