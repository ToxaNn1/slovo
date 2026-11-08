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
  type EditionSwitches,
  type NotServing,
  type RuleInput,
  type SwitchRefusal,
  type SwitchRefused,
  type WriteBy,
} from './edition/edition-registry';
export { createCommunityCounters, type CommunityCounters } from './counters/community-counters';
export { createMistakeReports, type MistakeReports } from './reports/mistake-reports';
export {
  createQuality,
  SENTRY_RETENTION_DAYS,
  type CiHistoryRun,
  type Quality,
  type QualityAnswer,
  type QualityKpi,
} from './quality/quality';
export { createSync, type Sync, type SyncChange, type SyncPage } from './sync/sync';
export {
  systemClock,
  type AccountRecord,
  type AppleIdentity,
  type AppleTokenCheck,
  type AppleVerifier,
  type CiRun,
  type CiRunStore,
  type PackageCoverage,
  type SentryAnswer,
  type SentryRead,
  type SentryReader,
  type SentryWindow,
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
  type SwitchRuleStore,
  type SignedIn,
  type UserRecords,
} from './ports';
export {
  createAdminAccess,
  type Action,
  type ActionEntry,
  type Actor,
  type AddAgentResult,
  type AdminAccess,
  type AdminRole,
  type AdminSessionRow,
  type AdminStore,
  type AdminTotp,
  type AdminUser,
  type SecretVault,
} from './admin/admin-access';
export {
  createAdminSignIn,
  totpOf,
  type AdminSessionView,
  type AdminSignIn,
  type CodeAccepted,
  type HmacSha1,
  type SecondFactor,
  type AdminSignedIn,
  type SignedInAdmin,
  type SignInRefused,
} from './admin/admin-sign-in';
