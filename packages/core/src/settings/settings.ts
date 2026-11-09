import type { FontSize, Theme } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import { forgetUnsentCounters } from '../community-counters/counter-deltas';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** The user settings in effect. */
export interface UserSettings {
  readonly theme: Theme;
  readonly fontSize: FontSize;
  /** Whether haptics are on. */
  readonly vibration: boolean;
  /** Whether «Звуки» is on: the Interface sounds play while the `sounds` switch is in effect too. */
  readonly sounds: boolean;
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
  /**
   * Whether «Менше руху» is on: the app draws the calmer variant of every
   * animation, as it does when the system's Reduce Motion is on (ADR 0055).
   */
  readonly reduceMotion: boolean;
  /**
   * The id of the Narrator Voice that reads: the reader's choice, else the
   * Edition's default. The Edition reads an id it no longer declares as its
   * default (ADR 0083).
   */
  readonly narratorVoice: string;
}

/**
 * The settings an Edition sets the defaults of. The counters are shown until the
 * user hides them, Self-check is off until the user turns it on and Seasonal
 * Decor, sharing the Community Counters and «Звуки» are on until the user
 * turns them off, and «Менше руху» is off until the user turns it on, in
 * every Edition, so none of them has an Edition default.
 */
export type SettingsDefaults = Omit<
  UserSettings,
  'noCounters' | 'selfCheck' | 'seasonalDecor' | 'shareCounters' | 'sounds' | 'reduceMotion'
>;

/** The user's settings: their own choices over the Edition's defaults. */
export interface Settings {
  /** The settings in effect until the user chooses: the Edition's defaults and the Core's own. */
  readonly defaults: UserSettings;
  /** The settings in effect: what the user chose, else the Edition's default. */
  read(): Promise<UserSettings>;
  /** Keeps the user's choices and returns the settings now in effect. Only a value that differs is written and told. */
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
    sounds: true,
    reduceMotion: false,
  };

  async function read(): Promise<UserSettings> {
    return {
      theme: (await userState.read(userStateRecords.theme)) ?? all.theme,
      fontSize: (await userState.read(userStateRecords.fontSize)) ?? all.fontSize,
      vibration: (await userState.read(userStateRecords.vibration)) ?? all.vibration,
      sounds: (await userState.read(userStateRecords.sounds)) ?? all.sounds,
      noCounters: (await userState.read(userStateRecords.noCounters)) ?? all.noCounters,
      selfCheck: (await userState.read(userStateRecords.selfCheck)) ?? all.selfCheck,
      seasonalDecor: (await userState.read(userStateRecords.seasonalDecor)) ?? all.seasonalDecor,
      shareCounters: (await userState.read(userStateRecords.shareCounters)) ?? all.shareCounters,
      reduceMotion: (await userState.read(userStateRecords.reduceMotion)) ?? all.reduceMotion,
      narratorVoice: (await userState.read(userStateRecords.narratorVoice)) ?? all.narratorVoice,
    };
  }

  return {
    defaults: all,
    read,
    async update(changes) {
      const before = new Map<string, unknown>(Object.entries(await read()));
      const changed = new Map(
        Object.entries(changes).filter(([setting, value]) => before.get(setting) !== value),
      );
      await userState.write(
        new Map([
          ...(changed.has('theme') ? userStateRecords.theme.change(changes.theme) : []),
          ...(changed.has('fontSize') ? userStateRecords.fontSize.change(changes.fontSize) : []),
          ...(changed.has('vibration') ? userStateRecords.vibration.change(changes.vibration) : []),
          ...(changed.has('sounds') ? userStateRecords.sounds.change(changes.sounds) : []),
          ...(changed.has('noCounters')
            ? userStateRecords.noCounters.change(changes.noCounters)
            : []),
          ...(changed.has('selfCheck') ? userStateRecords.selfCheck.change(changes.selfCheck) : []),
          ...(changed.has('seasonalDecor')
            ? userStateRecords.seasonalDecor.change(changes.seasonalDecor)
            : []),
          ...(changed.has('shareCounters')
            ? userStateRecords.shareCounters.change(changes.shareCounters)
            : []),
          ...(changed.has('reduceMotion')
            ? userStateRecords.reduceMotion.change(changes.reduceMotion)
            : []),
          ...(changed.has('narratorVoice')
            ? userStateRecords.narratorVoice.change(changes.narratorVoice)
            : []),
          ...(changes.shareCounters === false ? await forgetUnsentCounters(userState) : []),
        ]),
      );
      if (changes.shareCounters === false) analytics?.stop();
      for (const [setting, value] of changed) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
          await analytics?.track('settingChanged', { setting, value }).catch(() => undefined);
      }
      return read();
    },
  };
}
