import {
  colorSchemeFor,
  createAnalytics,
  createSettings,
  type ColorScheme,
  type Settings,
  type SettingsDefaults,
  type TrackedUserState,
  type UserSettings,
} from '@slovo/core';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { deviceAnalytics } from '../analytics/posthog-analytics';
import { edition } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { openOnce, useSubscribed, type Opening } from '../opening';
import { useShell, type OpenedSettings } from '../shell-value';

/** Makes native views (alerts, keyboards) follow the Theme too. */
function applyToNativeViews({ theme }: UserSettings): void {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

const { theme, fontSize, vibration, dailyLimit } = edition.userSettingDefaults;
const defaults: SettingsDefaults = { theme, fontSize, vibration, dailyLimit };

/** The settings with those in effect, which native views follow from the start. */
function opened(settings: Settings, current: UserSettings): OpenedSettings {
  applyToNativeViews(current);
  return { settings, current };
}

/**
 * The settings, opened once per app run over the user state, before the
 * Language Pack, and reopened over it when it changes. The app still starts
 * when they can't be read, on their defaults.
 */
export function settingsOpening({
  userState,
}: {
  userState: Opening<TrackedUserState>;
}): Opening<OpenedSettings> {
  async function settingsOverUserState(): Promise<Settings> {
    const opened = await userState.opened();
    return createSettings({
      userState: opened,
      defaults,
      analytics: createAnalytics({ edition, userState: opened, port: deviceAnalytics }),
    });
  }
  return openOnce(
    async () => {
      const settings = await settingsOverUserState();
      return opened(settings, await settings.read());
    },
    {
      onError(error) {
        logError('Could not read the settings; using their defaults', error);
      },
      fallback: async () => {
        const settings = await settingsOverUserState();
        return opened(settings, settings.defaults);
      },
    },
  );
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
  const opening = useSubscribed(useShell().settings, ({ state }) => state);
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
      logError('Could not keep the settings', error);
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
