import type { FontSize, Theme } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import { forgetUnsentCounters } from '../community-counters/counter-deltas';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** The user settings in effect. */
export interface UserSettings {
  readonly theme: Theme;
  readonly fontSize: FontSize;
  /** Whether haptics are on. */
  readonly vibration: boolean;
  /**
   * Whether «Без лічильників» is on: XP, Level, Streak, celebrations, level
   * milestones and in-Game XP feedback are hidden while counting goes on
   * (ADR 0066). While the Edition's `noCounters` switch is off it is
   * «Приховати Серію» of 0.9 and hides only the Streak.
   */
  readonly noCounters: boolean;
  /** Whether Self-check hides the answer on an Entry card until the reader taps. */
  readonly selfCheck: boolean;
  /** Whether «Сезонний декор» is on: slots 1 and 2 of the Decor follow the local date (ADR 0055). */
  readonly seasonalDecor: boolean;
  /**
   * Whether «Ділитися анонімною статистикою» is on: this device counts and
   * sends its Community Counters (ADR 0060). Turning it off forgets what
   * waits to be sent.
   */
  readonly shareCounters: boolean;
}

/**
 * The settings an Edition sets the defaults of. The counters are shown until the
 * user hides them, Self-check is off until the user turns it on and Seasonal
 * Decor and sharing the Community Counters are on until the user turns them
 * off, in every Edition, so none of them has an Edition default.
 */
export type SettingsDefaults = Omit<
  UserSettings,
  'noCounters' | 'selfCheck' | 'seasonalDecor' | 'shareCounters'
>;

/** The user's settings: their own choices over the Edition's defaults. */
export interface Settings {
  /** The settings in effect until the user chooses: the Edition's defaults and the Core's own. */
  readonly defaults: UserSettings;
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
  analytics,
}: {
  userState: UserState;
  defaults: SettingsDefaults;
  /** Where a changed setting is told (ADR 0068); turning sharing off stops it. Without it, nowhere. */
  analytics?: Analytics;
}): Settings {
  const all: UserSettings = {
    ...defaults,
    noCounters: false,
    selfCheck: false,
    seasonalDecor: true,
    shareCounters: true,
  };

  async function read(): Promise<UserSettings> {
    return {
      theme: (await userState.read(userStateRecords.theme)) ?? all.theme,
      fontSize: (await userState.read(userStateRecords.fontSize)) ?? all.fontSize,
      vibration: (await userState.read(userStateRecords.vibration)) ?? all.vibration,
      noCounters: (await userState.read(userStateRecords.noCounters)) ?? all.noCounters,
      selfCheck: (await userState.read(userStateRecords.selfCheck)) ?? all.selfCheck,
      seasonalDecor: (await userState.read(userStateRecords.seasonalDecor)) ?? all.seasonalDecor,
      shareCounters: (await userState.read(userStateRecords.shareCounters)) ?? all.shareCounters,
    };
  }

  return {
    defaults: all,
    read,
    async update(changes) {
      await userState.write(
        new Map([
          ...('theme' in changes ? userStateRecords.theme.change(changes.theme) : []),
          ...('fontSize' in changes ? userStateRecords.fontSize.change(changes.fontSize) : []),
          ...('vibration' in changes ? userStateRecords.vibration.change(changes.vibration) : []),
          ...('noCounters' in changes
            ? userStateRecords.noCounters.change(changes.noCounters)
            : []),
          ...('selfCheck' in changes ? userStateRecords.selfCheck.change(changes.selfCheck) : []),
          ...('seasonalDecor' in changes
            ? userStateRecords.seasonalDecor.change(changes.seasonalDecor)
            : []),
          ...('shareCounters' in changes
            ? userStateRecords.shareCounters.change(changes.shareCounters)
            : []),
          ...(changes.shareCounters === false ? await forgetUnsentCounters(userState) : []),
        ]),
      );
      if (changes.shareCounters === false) analytics?.stop();
      for (const [setting, value] of Object.entries(changes)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
          await analytics?.track('settingChanged', { setting, value }).catch(() => undefined);
      }
      return read();
    },
  };
}
