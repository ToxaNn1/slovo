import {
  colorSchemeFor,
  createMemoryUserStatePort,
  createSettings,
  openUserState,
  type ColorScheme,
  type Settings,
  type UserState,
  type UserSettings,
} from '@slovo/core';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { edition } from './edition/edition';
import { storedUserState } from './user-state/stored-user-state';

// Opened once per app run, however often the provider mounts.
let opening: Promise<{ settings: Settings; current: UserSettings }> | undefined;

async function openSettingsOver(userState: UserState) {
  const settings = createSettings({ userState, defaults: edition.userSettingDefaults });
  return { settings, current: await settings.read() };
}

function openSettings() {
  opening ??= storedUserState()
    .then(openSettingsOver)
    .catch(async (error: unknown) => {
      // The app still starts on the Edition's defaults; choices last until it quits.
      console.error('Could not read the settings; using the Edition defaults', error);
      return openSettingsOver(await openUserState({ port: createMemoryUserStatePort() }));
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
