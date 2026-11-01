import { describe, expect, it } from 'vitest';

import { colorSchemeFor, createMemoryUserStatePort, createSettings, openUserState } from '../index';

const defaults = { theme: 'system', fontSize: 'M', vibration: true, dailyLimit: 'off' } as const;

async function settingsOver(records = new Map<string, string>()) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return createSettings({ userState, defaults });
}

describe('settings', () => {
  it("uses the Edition's defaults until the user chooses", async () => {
    const settings = await settingsOver();

    expect(await settings.read()).toEqual({
      theme: 'system',
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it("gives its defaults, the Edition's and its own, whatever the user chose", async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', noCounters: true, selfCheck: true });

    expect(settings.defaults).toEqual({
      theme: 'system',
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it("uses the user's Theme over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ theme: 'dark' })).toEqual({
      theme: 'dark',
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
    expect(await settings.read()).toEqual({
      theme: 'dark',
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it("uses the user's font size over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ fontSize: 'XL' })).toEqual({
      theme: 'system',
      fontSize: 'XL',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
    expect(await settings.read()).toEqual({
      theme: 'system',
      fontSize: 'XL',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it("keeps the user's Theme and font size when the user state is opened again", async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ theme: 'light', fontSize: 'S', vibration: true });

    expect(await (await settingsOver(records)).read()).toEqual({
      theme: 'light',
      fontSize: 'S',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it('changes one setting without touching the other', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark' });

    expect(await settings.update({ fontSize: 'L' })).toEqual({
      theme: 'dark',
      fontSize: 'L',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it("falls back to the Edition's default when the stored Theme is not one the Core knows", async () => {
    const settings = await settingsOver(new Map([['settings.theme', 'sepia']]));

    expect(await settings.read()).toEqual({
      theme: 'system',
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it("falls back to the Edition's default when the stored font size is not one the Core knows", async () => {
    const settings = await settingsOver(
      new Map([
        ['settings.fontSize', 'XXL'],
        ['settings.theme', 'dark'],
      ]),
    );

    expect(await settings.read()).toEqual({
      theme: 'dark',
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it("starts from a different Edition's default font size", async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const settings = createSettings({
      userState,
      defaults: { theme: 'light', fontSize: 'L', vibration: false, dailyLimit: 'off' },
    });

    expect(await settings.read()).toEqual({
      theme: 'light',
      fontSize: 'L',
      vibration: false,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
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
      fontSize: 'M',
      vibration: false,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
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

  it('changes Vibration without touching the Theme or the font size', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', fontSize: 'XL' });

    expect(await settings.update({ vibration: false })).toEqual({
      theme: 'dark',
      fontSize: 'XL',
      vibration: false,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
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
      fontSize: 'M',
      vibration: true,
      noCounters: true,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
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
    await settings.update({ theme: 'dark', fontSize: 'XL', vibration: false });

    expect(await settings.update({ noCounters: true })).toEqual({
      theme: 'dark',
      fontSize: 'XL',
      vibration: false,
      noCounters: true,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
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
      fontSize: 'L',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
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
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: true,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
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
      fontSize: 'M',
      vibration: true,
      noCounters: true,
      selfCheck: true,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
  });

  it('stays off when the stored choice is not on or off', async () => {
    const settings = await settingsOver(new Map([['settings.selfCheck', '"yes"']]));

    expect((await settings.read()).selfCheck).toBe(false);
  });
});

describe('settings: Daily Limit', () => {
  it("is the Edition's default until the user chooses, and off in an Edition that keeps it off", async () => {
    const settings = await settingsOver();

    expect((await settings.read()).dailyLimit).toBe('off');
    expect(settings.defaults.dailyLimit).toBe('off');
  });

  it.each([10, 20, 30] as const)(
    'takes a limit of %i once the user chooses it, and returns the settings in effect',
    async (limit) => {
      const settings = await settingsOver();

      expect(await settings.update({ dailyLimit: limit })).toEqual({
        theme: 'system',
        fontSize: 'M',
        vibration: true,
        noCounters: false,
        selfCheck: false,
        seasonalDecor: true,
        shareCounters: true,
        dailyLimit: limit,
      });
      expect((await settings.read()).dailyLimit).toBe(limit);
    },
  );

  it('lets the user turn the limit off again', async () => {
    const settings = await settingsOver();
    await settings.update({ dailyLimit: 20 });

    expect((await settings.update({ dailyLimit: 'off' })).dailyLimit).toBe('off');
  });

  it("starts from a different Edition's default", async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const settings = createSettings({ userState, defaults: { ...defaults, dailyLimit: 30 } });

    expect((await settings.read()).dailyLimit).toBe(30);
  });

  it('keeps the choice when the user state is opened again', async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ dailyLimit: 10 });

    expect((await (await settingsOver(records)).read()).dailyLimit).toBe(10);
  });

  it('changes the limit without touching the other settings', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', selfCheck: true });

    expect(await settings.update({ dailyLimit: 30 })).toEqual({
      theme: 'dark',
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: true,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 30,
    });
  });

  it.each(['15', '"10"', '"on"', 'true'])(
    "falls back to the Edition's default when the stored limit is %s, not one the Core offers",
    async (stored) => {
      const settings = await settingsOver(new Map([['settings.dailyLimit', stored]]));

      expect((await settings.read()).dailyLimit).toBe('off');
    },
  );
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
      fontSize: 'M',
      vibration: true,
      noCounters: false,
      selfCheck: true,
      seasonalDecor: false,
      shareCounters: true,
      dailyLimit: 'off',
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
