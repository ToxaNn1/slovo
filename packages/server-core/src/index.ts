/**
 * The server Core's public interface. The backend reaches the server's rules
 * through this module only (ADR 0030).
 */
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
export { systemClock, type Clock, type ContentPackStore } from './ports';
