import type { TextSize, Theme } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import { forgetUnsentCounters } from '../community-counters/counter-deltas';
import type { Edition } from '../edition/edition';
import type { Backend } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** The user settings in effect. */
export interface UserSettings {
  readonly theme: Theme;
  /** The step on the three-step text size ladder a Word text starts from. */
  readonly textSize: TextSize;
  /** Whether haptics are on. */
  readonly vibration: boolean;
  /** Whether «Звуки» is on: the Interface sounds play while the `sounds` switch is in effect too. */
  readonly sounds: boolean;
  /**
   * Whether «Без лічильників» is on: XP, Level, Streak, celebrations, level
   * milestones and in-Game XP feedback are hidden while counting goes on
   * (ADR 0066).
   */
  readonly noCounters: boolean;
  /** Whether Self-check hides the answer on an Entry card until the reader taps. */
  readonly selfCheck: boolean;
  /** Whether «Сезонний декор» is on: slots 1 and 2 of the Decor follow the local date. */
  readonly seasonalDecor: boolean;
  /**
   * Whether «Ділитися анонімною статистикою» is on: this device counts and
   * sends its Community Counters. Turning it off forgets what
   * waits to be sent.
   */
  readonly shareCounters: boolean;
  /**
   * Whether «Менше руху» is on: the app draws the calmer variant of every
   * animation, as it does when the system's Reduce Motion is on.
   */
  readonly reduceMotion: boolean;
  /**
   * The id of the Narrator Voice that reads: the reader's choice, else the
   * Edition's default. The Edition reads an id it no longer declares as its
   * default.
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
  /** Keeps the user's choices and returns the settings now in effect. Only a value that differs is told. */
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
  statisticsOff,
}: {
  userState: UserState;
  defaults: SettingsDefaults;
  /** Where a changed setting is told (ADR 0068); turning sharing off stops it. Without it, nowhere. */
  analytics?: Analytics;
  /**
   * Where turning «Ділитися анонімною статистикою» from on to off sends its
   * one anonymous unit, with the Edition alone, while `statisticsOffCounter`
   * is on in effect (ADR 0163): the counters' transport, never Analytics. A
   * unit that fails is lost, never retried or queued. Without it, nowhere.
   */
  statisticsOff?: {
    readonly edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
    readonly backend: Pick<Backend, 'counters'>;
  };
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
      textSize: (await userState.read(userStateRecords.textSize)) ?? all.textSize,
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
      // Every choice is written, an equal one too: its stamp lets the newer choice win on sync.
      const changed = Object.entries(changes).filter(
        ([setting, value]) => before.get(setting) !== value,
      );
      await userState.write(
        new Map([
          ...('theme' in changes ? userStateRecords.theme.change(changes.theme) : []),
          ...('textSize' in changes ? userStateRecords.textSize.change(changes.textSize) : []),
          ...('vibration' in changes ? userStateRecords.vibration.change(changes.vibration) : []),
          ...('sounds' in changes ? userStateRecords.sounds.change(changes.sounds) : []),
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
          ...('reduceMotion' in changes
            ? userStateRecords.reduceMotion.change(changes.reduceMotion)
            : []),
          ...('narratorVoice' in changes
            ? userStateRecords.narratorVoice.change(changes.narratorVoice)
            : []),
          ...(changes.shareCounters === false ? await forgetUnsentCounters(userState) : []),
        ]),
      );
      if (changes.shareCounters === false) analytics?.stop();
      if (
        changes.shareCounters === false &&
        before.get('shareCounters') === true &&
        statisticsOff?.edition.isFeatureEnabled('statisticsOffCounter') === true
      ) {
        void statisticsOff.backend.counters
          .statisticsOff({ editionId: statisticsOff.edition.id })
          .catch(() => undefined);
      }
      for (const [setting, value] of changed) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
          await analytics?.track('settingChanged', { setting, value }).catch(() => undefined);
      }
      return read();
    },
  };
}
