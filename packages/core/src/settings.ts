import { ThemeSchema, type Theme } from '@slovo/contracts';

import type { UserState } from './user-state';

/** The user settings in effect. */
export interface UserSettings {
  readonly theme: Theme;
}

/** The user's settings: their own choices over the Edition's defaults. */
export interface Settings {
  /** The settings in effect: what the user chose, else the Edition's default. */
  read(): Promise<UserSettings>;
  /** Keeps the user's choices and returns the settings now in effect. */
  update(changes: Partial<UserSettings>): Promise<UserSettings>;
}

/** Light or dark: how the app is drawn right now. */
export type ColorScheme = 'light' | 'dark';

/**
 * The colour scheme to draw a Theme in. The System Theme follows the device's
 * appearance, and is light when the device doesn't report one.
 */
export function colorSchemeFor(
  theme: Theme,
  deviceAppearance: ColorScheme | undefined,
): ColorScheme {
  if (theme !== 'system') return theme;
  return deviceAppearance ?? 'light';
}

/** The user-state record of each setting. */
const KEYS = { theme: 'settings.theme' } as const satisfies Record<keyof UserSettings, string>;

export function createSettings({
  userState,
  defaults,
}: {
  userState: UserState;
  defaults: UserSettings;
}): Settings {
  async function read(): Promise<UserSettings> {
    const theme = ThemeSchema.safeParse(await userState.get(KEYS.theme));
    return { theme: theme.success ? theme.data : defaults.theme };
  }

  return {
    read,
    async update(changes) {
      await userState.write(
        new Map(
          Object.entries(changes).map(([setting, value]) => [
            KEYS[setting as keyof UserSettings],
            value,
          ]),
        ),
      );
      return read();
    },
  };
}
