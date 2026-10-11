import {
  colorSchemeFor,
  createMemoryUserStatePort,
  createSettings,
  openUserState,
  type ColorScheme,
  type Settings,
  type UserSettings,
  type UserState,
} from '@slovo/core';
import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { edition } from './edition';
import { openSqliteUserState } from './user-state-sqlite';

/**
 * The user state lives in its own writable database in the app's documents
 * directory, never in the read-only Language Pack (spec #51).
 */
const DATABASE_NAME = 'user-state.db';

async function openStoredUserState(): Promise<UserState> {
  try {
    const db = await openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL');
    return await openUserState({ port: await openSqliteUserState(db) });
  } catch (error) {
    // The app still works on the Edition's defaults; choices last until it quits.
    console.error('Could not open the user state; nothing will be kept', error);
    return openUserState({ port: createMemoryUserStatePort() });
  }
}

// Opened once per app run, however often the provider mounts.
let opening: Promise<{ settings: Settings; current: UserSettings }> | undefined;

function openSettings() {
  opening ??= openStoredUserState().then(async (userState) => {
    const settings = createSettings({ userState, defaults: edition.userSettingDefaults });
    return { settings, current: await settings.read() };
  });
  return opening;
}

/** Makes native views (alerts, keyboards) follow the Theme too. */
function applyToNativeViews({ theme }: UserSettings): void {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

interface SettingsContextValue {
  readonly current: UserSettings;
  readonly update: (changes: Partial<UserSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

/**
 * Reads the user's settings before the app draws anything, so it never
 * flashes in the wrong Theme, and keeps every change in the user state.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ settings: Settings; current: UserSettings }>();

  useEffect(() => {
    let active = true;
    void openSettings().then((opened) => {
      applyToNativeViews(opened.current);
      if (active) setState(opened);
    });
    return () => {
      active = false;
    };
  }, []);

  if (state === undefined) return null;
  const { settings, current } = state;

  function update(changes: Partial<UserSettings>) {
    const next = { ...current, ...changes };
    applyToNativeViews(next);
    setState({ settings, current: next });
    settings.update(changes).catch((error: unknown) => {
      console.error('Could not keep the settings', error);
    });
  }

  return <SettingsContext value={{ current, update }}>{children}</SettingsContext>;
}

/** The user settings in effect, and a way to change them. */
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (value === undefined) throw new Error('useSettings needs a SettingsProvider above it');
  return value;
}

/** The colour scheme the app is drawn in: the Theme, or the device's appearance. */
export function useColorSchemeInEffect(): ColorScheme {
  const { theme } = useSettings().current;
  const device = useColorScheme();
  return colorSchemeFor(theme, device === 'light' || device === 'dark' ? device : undefined);
}
