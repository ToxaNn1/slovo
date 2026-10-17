import { describe, expect, it } from 'vitest';

import { createNativeModules, type NativeModuleProbes } from '../device/native-module';
import { createSessionStore, type Keychain } from './session-store';

const session = { token: 'the-token', email: 'anna@example.com' };

const installed: NativeModuleProbes = {
  notifications: () => true,
  timePicker: () => true,
  widget: () => true,
  shareCapture: () => true,
  contentUpdates: () => true,
  keychain: () => true,
};

/** A Keychain that keeps its items in a map, as `expo-secure-store` does in the device's Keychain. */
function fakeKeychain() {
  const items = new Map<string, string>();
  const accessible = new Set<number | undefined>();
  const keychain: Keychain = {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
    getItemAsync(key, options) {
      accessible.add(options.keychainAccessible);
      return Promise.resolve(items.get(key) ?? null);
    },
    setItemAsync(key, value, options) {
      accessible.add(options.keychainAccessible);
      items.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync(key, options) {
      accessible.add(options.keychainAccessible);
      items.delete(key);
      return Promise.resolve();
    },
  };
  return { keychain, items, accessible };
}

/** The Session store the shell picks on a binary the probes describe, with `keychain` as the Keychain module. */
function sessionStoreOn(probes: NativeModuleProbes, keychain: Keychain) {
  return createSessionStore(createNativeModules(probes).load('keychain', () => keychain));
}

describe('the Session store of the shell', () => {
  it('keeps the Session in the Keychain, only on this device, when the binary has the module', async () => {
    const { keychain, items, accessible } = fakeKeychain();
    const sessions = sessionStoreOn(installed, keychain);

    await sessions.keep(session);

    expect(items.size).toBe(1);
    expect(accessible).toEqual(new Set([7]));
    // The app's next run reads it from the Keychain.
    await expect(sessionStoreOn(installed, keychain).read()).resolves.toEqual(session);
  });

  it('forgets the Session kept in the Keychain', async () => {
    const { keychain, items } = fakeKeychain();
    const sessions = sessionStoreOn(installed, keychain);
    await sessions.keep(session);

    await sessions.forget();

    expect(items.size).toBe(0);
    await expect(sessions.read()).resolves.toBeUndefined();
  });

  it('reads no Session from a Keychain item it can’t make sense of', async () => {
    const { keychain, items } = fakeKeychain();
    const sessions = sessionStoreOn(installed, keychain);
    await sessions.keep(session);
    const [key] = items.keys();
    items.set(key ?? '', '{"token":42}');

    await expect(sessions.read()).resolves.toBeUndefined();
  });

  it('keeps the Session in memory until the app restarts on a dev client without the Keychain module', async () => {
    const { keychain, items } = fakeKeychain();
    const sessions = sessionStoreOn({ ...installed, keychain: () => false }, keychain);

    await sessions.keep(session);

    await expect(sessions.read()).resolves.toEqual(session);
    expect(items.size).toBe(0);
    // A restart opens a new store, which knows no Session.
    const afterRestart = sessionStoreOn({ ...installed, keychain: () => false }, keychain);
    await expect(afterRestart.read()).resolves.toBeUndefined();
    await sessions.forget();
    await expect(sessions.read()).resolves.toBeUndefined();
  });
});
