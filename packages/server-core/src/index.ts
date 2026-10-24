/**
 * The server Core's public interface. The backend reaches the server's rules
 * through this module only (ADR 0030).
 */
export { createAccounts, type Accounts, type Session } from './account/accounts';
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
export { createSync, type Sync, type SyncChange, type SyncPage } from './sync/sync';
export {
  systemClock,
  type AccountRecord,
  type Authenticator,
  type Clock,
  type CodeCheck,
  type ContentPackStore,
  type GoogleIdentity,
  type GoogleTokenCheck,
  type GoogleVerifier,
  type Json,
  type KeptRecord,
  type Mail,
  type Mailer,
  type PublishedFile,
  type RateLimits,
  type RecordChange,
  type RemoteSwitchStore,
  type SignedIn,
  type UserRecords,
} from './ports';
