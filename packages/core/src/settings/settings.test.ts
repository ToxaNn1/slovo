import { describe, expect, it } from 'vitest';

import {
  colorSchemeFor,
  createMemorySessionStore,
  createSettings,
  openAccount,
  openSync,
  smallerTextSize,
} from '../index';
import { TEXT_SIZE_LADDER } from './text-size-ladder';
import { fakeClock, randomOf, settle, testSchedule } from '../test-support';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
} from '../testing';
import { trackChanges } from '../user-state/tracked-user-state';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const defaults = {
  theme: 'system',
  textSize: 'system',
  vibration: true,
  narratorVoice: 'anna',
} as const;

async function settingsOver(records = new Map<string, string>()) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return createSettings({ userState, defaults });
}

describe('settings', () => {
  it("uses the Edition's defaults until the user chooses", async () => {
    const settings = await settingsOver();

    expect(await settings.read()).toEqual({
      theme: 'system',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it("gives its defaults, the Edition's and its own, whatever the user chose", async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', noCounters: true, selfCheck: true });

    expect(settings.defaults).toEqual({
      theme: 'system',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it("uses the user's Theme over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ theme: 'dark' })).toEqual({
      theme: 'dark',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
    expect(await settings.read()).toEqual({
      theme: 'dark',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it("uses the user's text size over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ textSize: 'largest' })).toEqual({
      theme: 'system',
      textSize: 'largest',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
    expect(await settings.read()).toEqual({
      theme: 'system',
      textSize: 'largest',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it("keeps the user's Theme and text size when the user state is opened again", async () => {
    const records = new Map<string, string>();
    await (
      await settingsOver(records)
    ).update({ theme: 'light', textSize: 'larger', vibration: true });

    expect(await (await settingsOver(records)).read()).toEqual({
      theme: 'light',
      textSize: 'larger',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it('changes one setting without touching the other', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark' });

    expect(await settings.update({ textSize: 'larger' })).toEqual({
      theme: 'dark',
      textSize: 'larger',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it("falls back to the Edition's default when the stored Theme is not one the Core knows", async () => {
    const settings = await settingsOver(new Map([['settings.theme', 'sepia']]));

    expect(await settings.read()).toEqual({
      theme: 'system',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it("starts from a different Edition's default text size", async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const settings = createSettings({
      userState,
      defaults: {
        theme: 'light',
        textSize: 'larger',
        vibration: false,
        narratorVoice: 'boris',
      },
    });

    expect(await settings.read()).toEqual({
      theme: 'light',
      textSize: 'larger',
      vibration: false,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'boris',
    });
  });
});

describe('settings: Vibration', () => {
  it("uses the Edition's default Vibration until the user chooses", async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const off = createSettings({ userState, defaults: { ...defaults, vibration: false } });

    expect((await off.read()).vibration).toBe(false);
  });

  it("uses the user's Vibration over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ vibration: false })).toEqual({
      theme: 'system',
      textSize: 'system',
      vibration: false,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
    expect((await settings.read()).vibration).toBe(false);
  });

  it('lets the user turn Vibration on over an Edition default of off', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const settings = createSettings({ userState, defaults: { ...defaults, vibration: false } });

    expect((await settings.update({ vibration: true })).vibration).toBe(true);
  });

  it("keeps the user's Vibration when the user state is opened again", async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ vibration: false });

    expect((await (await settingsOver(records)).read()).vibration).toBe(false);
  });

  it('has «Звуки» on until the user turns it off, and keeps that choice', async () => {
    const records = new Map<string, string>();
    expect((await (await settingsOver(records)).read()).sounds).toBe(true);

    await (await settingsOver(records)).update({ sounds: false });

    expect((await (await settingsOver(records)).read()).sounds).toBe(false);
  });

  it('changes Vibration without touching the Theme or the text size', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', textSize: 'largest' });

    expect(await settings.update({ vibration: false })).toEqual({
      theme: 'dark',
      textSize: 'largest',
      vibration: false,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it("falls back to the Edition's default when the stored Vibration is not on or off", async () => {
    const settings = await settingsOver(new Map([['settings.vibration', '"loud"']]));

    expect((await settings.read()).vibration).toBe(true);
  });
});

describe('settings: «Без лічильників»', () => {
  it('shows the counters until the user hides them', async () => {
    const settings = await settingsOver();

    expect((await settings.read()).noCounters).toBe(false);
  });

  it('hides the counters once the user chooses to, and returns the settings in effect', async () => {
    const settings = await settingsOver();

    expect(await settings.update({ noCounters: true })).toEqual({
      theme: 'system',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: true,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
    expect((await settings.read()).noCounters).toBe(true);
  });

  it('lets the user show the counters again', async () => {
    const settings = await settingsOver();
    await settings.update({ noCounters: true });

    expect((await settings.update({ noCounters: false })).noCounters).toBe(false);
  });

  it('keeps the choice when the user state is opened again', async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ noCounters: true });

    expect((await (await settingsOver(records)).read()).noCounters).toBe(true);
  });

  it('changes the choice without touching the other settings', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', textSize: 'largest', vibration: false });

    expect(await settings.update({ noCounters: true })).toEqual({
      theme: 'dark',
      textSize: 'largest',
      vibration: false,
      sounds: true,
      noCounters: true,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it('keeps a Streak hidden with «Приховати Серію» as «Без лічильників» on', async () => {
    const settings = await settingsOver(new Map([['settings.hideStreak', 'true']]));

    expect((await settings.read()).noCounters).toBe(true);
  });

  it('shows the counters when the stored choice is not on or off', async () => {
    const settings = await settingsOver(new Map([['settings.hideStreak', '"yes"']]));

    expect((await settings.read()).noCounters).toBe(false);
  });

  it('reads the user state a 0.8 app kept, schema version 4: its settings stay, the Streak shows', async () => {
    const settings = await settingsOver(
      new Map([
        ['schema.version', '4'],
        ['settings.theme', '"dark"'],
        ['settings.fontSize', '"L"'],
      ]),
    );

    expect(await settings.read()).toEqual({
      theme: 'dark',
      textSize: 'larger',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });
});

describe('settings: Self-check', () => {
  it('is off until the user turns it on', async () => {
    const settings = await settingsOver();

    expect((await settings.read()).selfCheck).toBe(false);
  });

  it('turns on once the user chooses to, and returns the settings in effect', async () => {
    const settings = await settingsOver();

    expect(await settings.update({ selfCheck: true })).toEqual({
      theme: 'system',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: true,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
    expect((await settings.read()).selfCheck).toBe(true);
  });

  it('keeps the choice when the user state is opened again', async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ selfCheck: true });

    expect((await (await settingsOver(records)).read()).selfCheck).toBe(true);
  });

  it('changes the choice without touching the other settings', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', noCounters: true });

    expect(await settings.update({ selfCheck: true })).toEqual({
      theme: 'dark',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: true,
      selfCheck: true,
      seasonalDecor: true,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it('stays off when the stored choice is not on or off', async () => {
    const settings = await settingsOver(new Map([['settings.selfCheck', '"yes"']]));

    expect((await settings.read()).selfCheck).toBe(false);
  });
});

describe('settings: Seasonal Decor', () => {
  it('is on until the user turns it off', async () => {
    const settings = await settingsOver();

    expect((await settings.read()).seasonalDecor).toBe(true);
    expect(settings.defaults.seasonalDecor).toBe(true);
  });

  it('turns off once the user chooses to, without touching the other settings', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', selfCheck: true });

    expect(await settings.update({ seasonalDecor: false })).toEqual({
      theme: 'dark',
      textSize: 'system',
      vibration: true,
      sounds: true,
      noCounters: false,
      selfCheck: true,
      seasonalDecor: false,
      shareCounters: true,
      reduceMotion: false,
      narratorVoice: 'anna',
    });
  });

  it('keeps the choice when the user state is opened again', async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ seasonalDecor: false });

    expect((await (await settingsOver(records)).read()).seasonalDecor).toBe(false);
  });

  it('is on when the stored choice is not on or off', async () => {
    const settings = await settingsOver(new Map([['settings.seasonalDecor', '"yes"']]));

    expect((await settings.read()).seasonalDecor).toBe(true);
  });
});

describe('settings: «Голос диктора»', () => {
  it("reads the Edition's default Narrator Voice until the reader chooses", async () => {
    const settings = await settingsOver();

    expect((await settings.read()).narratorVoice).toBe('anna');
    expect(settings.defaults.narratorVoice).toBe('anna');
  });

  it('keeps the chosen voice, without touching the other settings, and returns the settings in effect', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark' });

    expect(await settings.update({ narratorVoice: 'boris' })).toMatchObject({
      theme: 'dark',
      sounds: true,
      narratorVoice: 'boris',
    });
  });

  it('keeps the choice when the user state is opened again', async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ narratorVoice: 'boris' });

    expect((await (await settingsOver(records)).read()).narratorVoice).toBe('boris');
  });

  it("reads the Edition's default when the stored choice is not a voice id", async () => {
    const settings = await settingsOver(new Map([['settings.narratorVoice', '3']]));

    expect((await settings.read()).narratorVoice).toBe('anna');
  });
});

describe('colorSchemeFor', () => {
  it.each([
    ['system', 'dark', 'dark'],
    ['system', 'light', 'light'],
    ['system', undefined, 'light'],
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
    ['dark', undefined, 'dark'],
  ] as const)(
    'shows the %s Theme on a device in %s appearance as %s',
    (theme, deviceAppearance, expected) => {
      expect(colorSchemeFor(theme, deviceAppearance)).toBe(expected);
    },
  );
});

describe('settings: «Менше руху»', () => {
  it('is off until the user turns it on', async () => {
    const settings = await settingsOver();

    expect((await settings.read()).reduceMotion).toBe(false);
    expect(settings.defaults.reduceMotion).toBe(false);
  });

  it('keeps the choice when the user state is opened again', async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ reduceMotion: true });

    expect((await (await settingsOver(records)).read()).reduceMotion).toBe(true);
  });

  it('is off when the stored choice is not on or off', async () => {
    const settings = await settingsOver(new Map([['settings.reduceMotion', '"yes"']]));

    expect((await settings.read()).reduceMotion).toBe(false);
  });
});

describe('settings: the three-step text size', () => {
  it("uses the user's text size over the Edition's default", async () => {
    const settings = await settingsOver();

    const now = await settings.update({ textSize: 'largest' });

    expect(now).toMatchObject({ textSize: 'largest' });
    expect(await settings.read()).toMatchObject({ textSize: 'largest' });
  });

  it("falls back to the Edition's default when the stored text size is not one the Core knows", async () => {
    for (const stored of ['"huge"', '"L"', '3', 'not json']) {
      const settings = await settingsOver(new Map([['settings.textSize', stored]]));

      expect((await settings.read()).textSize, stored).toBe('system');
    }
  });

  it('opens each S…XL font size an older app stored as its step on the ladder', async () => {
    const opened = { S: 'system', M: 'system', L: 'larger', XL: 'largest' } as const;
    for (const [fontSize, textSize] of Object.entries(opened)) {
      const records = new Map([
        ['schema.version', '7'],
        ['settings.fontSize', JSON.stringify(fontSize)],
      ]);

      const settings = await settingsOver(records);

      expect(await settings.read(), fontSize).toMatchObject({ textSize });
      expect(records.get('schema.version')).toBe('9');
    }
  });

  it("starts at the Edition's default when an older app stored no font size, or one that does not read", async () => {
    for (const stored of [undefined, '"XXL"', 'M']) {
      const records = new Map([['schema.version', '7']]);
      if (stored !== undefined) records.set('settings.fontSize', stored);

      const settings = await settingsOver(records);

      expect((await settings.read()).textSize, stored).toBe('system');
      expect(records.has('settings.textSize'), stored).toBe(false);
    }
  });

  it('steps down the ladder one step at a time to the floor, and no further', () => {
    expect(TEXT_SIZE_LADDER).toEqual(['system', 'larger', 'largest']);
    expect(smallerTextSize('largest')).toBe('larger');
    expect(smallerTextSize('larger')).toBe('system');
    expect(smallerTextSize('system')).toBeUndefined();
  });
});

describe('settings: the text size and Sync', () => {
  const EMAIL = 'reader@example.com';

  async function device(
    server: ReturnType<typeof createFakeBackend>,
    time: ReturnType<typeof fakeClock>,
    records = new Map<string, string>(),
  ) {
    const timers = testSchedule(time);
    const userState = trackChanges({
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: time.clock,
    });
    await userState.write(userStateRecords.installed.change(true));
    const account = await openAccount({
      backend: server.backend,
      edition: { id: 'uk', isFeatureEnabled: () => false },
      googleSheet: createFakeGoogleSignInSheet(),
      appleSheet: createFakeAppleSignInSheet(),
      userState,
      sessions: createMemorySessionStore({
        token: `session-of-${time.clock.now().toISOString()}`,
        email: EMAIL,
      }),
      clock: time.clock,
      schedule: timers.schedule,
      random: randomOf(0.5),
    });
    const sync = await openSync({
      userState,
      backend: server.backend,
      account,
      edition: { id: 'uk', isFeatureEnabled: () => true },
      clock: time.clock,
      schedule: timers.schedule,
      random: randomOf(0.5),
    });
    return {
      settings: createSettings({ userState, defaults }),
      async syncNow(): Promise<void> {
        sync.foreground();
        await timers.advance(0);
      },
      /** The settings as the app reads them when it opens over the same records again. */
      async reopened() {
        return settingsOver(records);
      },
    };
  }

  it('carries the migrated text size to another device, and a newer choice back', async () => {
    const server = createFakeBackend({ clock: fakeClock('2026-11-14T08:00:00+02:00').clock });
    const phoneTime = fakeClock('2026-11-14T08:00:00+02:00');
    const phone = await device(
      server,
      phoneTime,
      new Map([
        ['schema.version', '7'],
        ['settings.fontSize', '"XL"'],
      ]),
    );
    const tablet = await device(server, fakeClock('2026-11-14T09:00:00+02:00'));

    await phone.syncNow();
    await tablet.syncNow();
    expect((await (await tablet.reopened()).read()).textSize).toBe('largest');

    await tablet.settings.update({ textSize: 'larger' });
    await tablet.syncNow();
    await phone.syncNow();
    expect((await (await phone.reopened()).read()).textSize).toBe('larger');
  });
});

describe('settings: the switch-off unit of anonymous statistics (ADR 0163)', () => {
  async function settingsSending({
    records = new Map<string, string>(),
    unitSwitch = 'on',
  }: { records?: Map<string, string>; unitSwitch?: 'on' | 'off' } = {}) {
    const server = createFakeBackend();
    const userState = await openUserState({ port: createMemoryUserStatePort(records) });
    const settings = createSettings({
      userState,
      defaults,
      statisticsOff: {
        edition: {
          id: 'uk',
          isFeatureEnabled: (feature) => feature !== 'statisticsOffCounter' || unitSwitch === 'on',
        },
        backend: server.backend,
      },
    });
    return { server, settings };
  }

  it('sends exactly one unit carrying only the Edition when the reader turns sharing off', async () => {
    const { server, settings } = await settingsSending();

    await settings.update({ shareCounters: false });
    await settle();

    expect(server.counters.statisticsOff).toEqual([
      { body: { editionId: 'uk' }, session: undefined },
    ]);
  });

  it('sends nothing on→on, off→off or off→on, nor for another setting', async () => {
    const { server, settings } = await settingsSending();

    await settings.update({ shareCounters: true });
    await settings.update({ theme: 'dark' });
    await settings.update({ shareCounters: false });
    await settings.update({ shareCounters: false });
    await settings.update({ shareCounters: true });
    await settle();

    expect(server.counters.statisticsOff).toHaveLength(1);
  });

  it('sends nothing when the reader had already turned sharing off on an earlier run', async () => {
    const { server, settings } = await settingsSending({
      records: new Map([['settings.shareCounters', 'false']]),
    });

    await settings.update({ shareCounters: false });
    await settle();

    expect(server.calls).not.toContain('counters.statisticsOff');
  });

  it('drops a unit that fails: it is neither retried nor queued for a later switch-off', async () => {
    const { server, settings } = await settingsSending();
    server.online = false;

    await expect(settings.update({ shareCounters: false })).resolves.toMatchObject({
      shareCounters: false,
    });
    await settle();
    server.online = true;
    await settings.update({ shareCounters: true });
    await settings.update({ shareCounters: false });
    await settle();

    expect(server.calls.filter((call) => call === 'counters.statisticsOff')).toHaveLength(2);
    expect(server.counters.statisticsOff).toEqual([
      { body: { editionId: 'uk' }, session: undefined },
    ]);
  });

  it('sends nothing while `statisticsOffCounter` is off', async () => {
    const { server, settings } = await settingsSending({ unitSwitch: 'off' });

    await settings.update({ shareCounters: false });
    await settle();

    expect(server.calls).not.toContain('counters.statisticsOff');
  });
});
