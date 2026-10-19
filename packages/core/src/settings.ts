import type { FontSize, Theme } from '@slovo/contracts';

import type { UserState } from './user-state/user-state';
import { userStateRecords } from './user-state/user-state-schema';

/** The user settings in effect. */
export interface UserSettings {
  readonly theme: Theme;
  readonly fontSize: FontSize;
  /** Whether haptics are on. */
  readonly vibration: boolean;
  /** Whether the Streak is hidden everywhere it is drawn. */
  readonly hideStreak: boolean;
  /** Whether Self-check hides the answer on an Entry card until the reader taps. */
  readonly selfCheck: boolean;
}

/**
 * The settings an Edition sets the defaults of. The Streak is shown until the
 * user hides it, and Self-check is off until the user turns it on, in every
 * Edition, so neither has an Edition default.
 */
export type SettingsDefaults = Omit<UserSettings, 'hideStreak' | 'selfCheck'>;

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
  defaults: SettingsDefaults;
}): Settings {
  async function read(): Promise<UserSettings> {
    return {
      theme: (await userState.read(userStateRecords.theme)) ?? defaults.theme,
      fontSize: (await userState.read(userStateRecords.fontSize)) ?? defaults.fontSize,
      vibration: (await userState.read(userStateRecords.vibration)) ?? defaults.vibration,
      hideStreak: (await userState.read(userStateRecords.hideStreak)) ?? false,
      selfCheck: (await userState.read(userStateRecords.selfCheck)) ?? false,
    };
  }

  return {
    read,
    async update(changes) {
      await userState.write(
        new Map([
          ...('theme' in changes ? userStateRecords.theme.change(changes.theme) : []),
          ...('fontSize' in changes ? userStateRecords.fontSize.change(changes.fontSize) : []),
          ...('vibration' in changes ? userStateRecords.vibration.change(changes.vibration) : []),
          ...('hideStreak' in changes
            ? userStateRecords.hideStreak.change(changes.hideStreak)
            : []),
          ...('selfCheck' in changes ? userStateRecords.selfCheck.change(changes.selfCheck) : []),
        ]),
      );
      return read();
    },
  };
}
