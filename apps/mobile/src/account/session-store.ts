import { createMemorySessionStore, type KeptSession, type SessionStore } from '@slovo/core';

/** The options `expo-secure-store` takes with each call: who may read the item, and when. */
interface KeychainOptions {
  readonly keychainAccessible?: number;
}

/** The part of `expo-secure-store` the Session store uses: the Keychain on iOS. */
export interface Keychain {
  /** Readable once the device was unlocked after a restart, and never restored from a backup to another device. */
  readonly AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: number;
  getItemAsync(key: string, options: KeychainOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options: KeychainOptions): Promise<void>;
  deleteItemAsync(key: string, options: KeychainOptions): Promise<void>;
}

/** The Keychain item that holds this device's Session. */
const SESSION_KEY = 'slovo.session';

/** The Session an item holds, or undefined when it holds none the store wrote. */
function sessionIn(item: string): KeptSession | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(item);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const { token, email } = parsed as Partial<Record<keyof KeptSession, unknown>>;
  return typeof token === 'string' && typeof email === 'string' ? { token, email } : undefined;
}

/**
 * The Session store of the shell: in the Keychain through `expo-secure-store`,
 * on this device only, so neither another app nor a backup reads it. Without
 * the Keychain module (`undefined`, on a dev client built before the 0.7
 * batch), in memory: the Session lasts until the app restarts. Never in the
 * user state or in a file.
 */
export function createSessionStore(keychain: Keychain | undefined): SessionStore {
  if (keychain === undefined) return createMemorySessionStore();
  const options = { keychainAccessible: keychain.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  return {
    keep: (session) => keychain.setItemAsync(SESSION_KEY, JSON.stringify(session), options),
    async read() {
      const item = await keychain.getItemAsync(SESSION_KEY, options);
      return item === null ? undefined : sessionIn(item);
    },
    forget: () => keychain.deleteItemAsync(SESSION_KEY, options),
  };
}
