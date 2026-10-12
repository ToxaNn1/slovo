import type { FontSize, Theme } from '@slovo/contracts';

import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** The user settings in effect. */
export interface UserSettings {
  readonly theme: Theme;
  readonly fontSize: FontSize;
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

export function createSettings({
  userState,
  defaults,
}: {
  userState: UserState;
  defaults: UserSettings;
}): Settings {
  async function read(): Promise<UserSettings> {
    return {
      theme: (await userState.read(userStateRecords.theme)) ?? defaults.theme,
      fontSize: (await userState.read(userStateRecords.fontSize)) ?? defaults.fontSize,
    };
  }

  return {
    read,
    async update(changes) {
      await userState.write(
        new Map([
          ...('theme' in changes ? userStateRecords.theme.change(changes.theme) : []),
          ...('fontSize' in changes ? userStateRecords.fontSize.change(changes.fontSize) : []),
        ]),
      );
      return read();
    },
  };
}
