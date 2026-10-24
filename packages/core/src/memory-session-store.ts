import type { KeptSession, SessionStore } from './ports';

/**
 * A Session store held in memory: in tests, and in the shell on a development
 * client without the Keychain module, where the Session lasts until the app
 * restarts. It starts with `kept`, when given.
 */
export function createMemorySessionStore(kept?: KeptSession): SessionStore {
  let session = kept;
  return {
    keep(next) {
      session = next;
      return Promise.resolve();
    },
    read: () => Promise.resolve(session),
    forget() {
      session = undefined;
      return Promise.resolve();
    },
  };
}
