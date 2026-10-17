/**
 * The server Core's public interface. The backend reaches the server's rules
 * through this module only (ADR 0030).
 */
export { createAccounts, SESSION_SECONDS, SIGN_IN_CODE, type Accounts } from './account/accounts';
export {
  createContentPacks,
  type ContentPacks,
  type PublishRefusal,
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
} from './ports';
