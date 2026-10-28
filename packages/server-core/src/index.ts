/**
 * The server Core's public interface. The backend reaches the server's rules
 * through this module only (ADR 0030).
 */
export { createAccounts, type Accounts, type Session } from './account/accounts';
export { createCollectionLinks, type CollectionLinks } from './collection-links/collection-links';
export {
  createContentPacks,
  type ContentPacks,
  type PublishRefusal,
} from './content/content-packs';
export {
  createEditionRegistry,
  type Edition,
  type EditionRegistry,
  type NotServing,
  type SwitchRefusal,
} from './edition/edition-registry';
export { createCommunityCounters, type CommunityCounters } from './counters/community-counters';
export { createMistakeReports, type MistakeReports } from './reports/mistake-reports';
export { createSync, type Sync, type SyncChange, type SyncPage } from './sync/sync';
export {
  systemClock,
  type AccountRecord,
  type Authenticator,
  type Clock,
  type CodeCheck,
  type CollectionLinkStore,
  type ContentPackStore,
  type CounterStore,
  type EntryCounts,
  type GoogleIdentity,
  type GoogleTokenCheck,
  type GoogleVerifier,
  type Json,
  type KeptCollectionLink,
  type KeptRecord,
  type KeptReport,
  type Mail,
  type Mailer,
  type MistakeReportStore,
  type PublishedFile,
  type Random,
  type RateLimits,
  type RecordChange,
  type RemoteSwitchStore,
  type SignedIn,
  type UserRecords,
} from './ports';
