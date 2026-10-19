import {
  colorSchemeFor,
  createSettings,
  type ColorScheme,
  type Settings,
  type SettingsDefaults,
  type UserSettings,
} from '@slovo/core';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { edition } from './edition/edition';
import { openOnce, useSubscribed } from './opening';
import { storedUserState } from './user-state/stored-user-state';

/** Makes native views (alerts, keyboards) follow the Theme too. */
function applyToNativeViews({ theme }: UserSettings): void {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

const { theme, fontSize, vibration } = edition.userSettingDefaults;
const defaults: SettingsDefaults = { theme, fontSize, vibration };

async function settingsOverUserState(): Promise<Settings> {
  return createSettings({ userState: await storedUserState.opened(), defaults });
}

/** The settings with those in effect, which native views follow from the start. */
function opened(settings: Settings, current: UserSettings) {
  applyToNativeViews(current);
  return { settings, current };
}

/**
 * The settings, opened once per app run over the user state, before the
 * Language Pack, and reopened over it when it changes. The app still starts
 * when they can't be read, on the Edition's defaults.
 */
export const settingsOpening = openOnce(
  async () => {
    const settings = await settingsOverUserState();
    return opened(settings, await settings.read());
  },
  {
    onError(error) {
      console.error('Could not read the settings; using the Edition defaults', error);
    },
    fallback: async () =>
      opened(await settingsOverUserState(), { ...defaults, hideStreak: false, selfCheck: false }),
  },
);

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
  const opening = useSubscribed(settingsOpening, ({ state }) => state);
  /**
   * The settings in effect once the reader changed one, over the settings
   * they changed; until then, and once the settings reopen, those opened.
   */
  const [changed, setChanged] = useState<{ over: Settings; current: UserSettings }>();

  // Nothing is drawn until the Theme is known.
  if (opening.status !== 'ready') return null;
  const { settings } = opening.value;
  const current = changed?.over === settings ? changed.current : opening.value.current;

  function update(changes: Partial<UserSettings>) {
    const next = { ...current, ...changes };
    applyToNativeViews(next);
    setChanged({ over: settings, current: next });
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
