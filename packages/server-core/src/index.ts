/**
 * The server Core's public interface. The backend reaches the server's rules
 * through this module only (ADR 0030).
 */
export { createAccounts, type Accounts } from './account/accounts';
export {
  createContentPacks,
  type ContentPacks,
  type PublishRefusal,
  type ServeRefusal,
} from './content/content-packs';
export {
  createEditionRegistry,
  type Edition,
  type EditionRegistry,
} from './edition/edition-registry';
export {
  systemClock,
  type AccountRecord,
  type Authenticator,
  type Clock,
  type CodeCheck,
  type ContentPackStore,
  type Mail,
  type Mailer,
  type PublishedFile,
  type RateLimits,
} from './ports';
