import { describe, expect, it } from 'vitest';

import { colorSchemeFor, createMemoryUserStatePort, createSettings, openUserState } from './index';

const defaults = { theme: 'system', fontSize: 'M', vibration: true } as const;

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
      hideStreak: false,
      selfCheck: false,
    });
  });

  it("uses the user's Theme over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ theme: 'dark' })).toEqual({
      theme: 'dark',
      fontSize: 'M',
      vibration: true,
      hideStreak: false,
      selfCheck: false,
    });
    expect(await settings.read()).toEqual({
      theme: 'dark',
      fontSize: 'M',
      vibration: true,
      hideStreak: false,
      selfCheck: false,
    });
  });

  it("uses the user's font size over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ fontSize: 'XL' })).toEqual({
      theme: 'system',
      fontSize: 'XL',
      vibration: true,
      hideStreak: false,
      selfCheck: false,
    });
    expect(await settings.read()).toEqual({
      theme: 'system',
      fontSize: 'XL',
      vibration: true,
      hideStreak: false,
      selfCheck: false,
    });
  });

  it("keeps the user's Theme and font size when the user state is opened again", async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ theme: 'light', fontSize: 'S', vibration: true });

    expect(await (await settingsOver(records)).read()).toEqual({
      theme: 'light',
      fontSize: 'S',
      vibration: true,
      hideStreak: false,
      selfCheck: false,
    });
  });

  it('changes one setting without touching the other', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark' });

    expect(await settings.update({ fontSize: 'L' })).toEqual({
      theme: 'dark',
      fontSize: 'L',
      vibration: true,
      hideStreak: false,
      selfCheck: false,
    });
  });

  it("falls back to the Edition's default when the stored Theme is not one the Core knows", async () => {
    const settings = await settingsOver(new Map([['settings.theme', 'sepia']]));

    expect(await settings.read()).toEqual({
      theme: 'system',
      fontSize: 'M',
      vibration: true,
      hideStreak: false,
      selfCheck: false,
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
      hideStreak: false,
      selfCheck: false,
    });
  });

  it("starts from a different Edition's default font size", async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const settings = createSettings({
      userState,
      defaults: { theme: 'light', fontSize: 'L', vibration: false },
    });

    expect(await settings.read()).toEqual({
      theme: 'light',
      fontSize: 'L',
      vibration: false,
      hideStreak: false,
      selfCheck: false,
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
      hideStreak: false,
      selfCheck: false,
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
      hideStreak: false,
      selfCheck: false,
    });
  });

  it("falls back to the Edition's default when the stored Vibration is not on or off", async () => {
    const settings = await settingsOver(new Map([['settings.vibration', '"loud"']]));

    expect((await settings.read()).vibration).toBe(true);
  });
});

describe('settings: hide the Streak', () => {
  it('shows the Streak until the user hides it', async () => {
    const settings = await settingsOver();

    expect((await settings.read()).hideStreak).toBe(false);
  });

  it('hides the Streak once the user chooses to, and returns the settings in effect', async () => {
    const settings = await settingsOver();

    expect(await settings.update({ hideStreak: true })).toEqual({
      theme: 'system',
      fontSize: 'M',
      vibration: true,
      hideStreak: true,
      selfCheck: false,
    });
    expect((await settings.read()).hideStreak).toBe(true);
  });

  it('lets the user show the Streak again', async () => {
    const settings = await settingsOver();
    await settings.update({ hideStreak: true });

    expect((await settings.update({ hideStreak: false })).hideStreak).toBe(false);
  });

  it('keeps the choice when the user state is opened again', async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ hideStreak: true });

    expect((await (await settingsOver(records)).read()).hideStreak).toBe(true);
  });

  it('changes the choice without touching the other settings', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark', fontSize: 'XL', vibration: false });

    expect(await settings.update({ hideStreak: true })).toEqual({
      theme: 'dark',
      fontSize: 'XL',
      vibration: false,
      hideStreak: true,
      selfCheck: false,
    });
  });

  it('shows the Streak when the stored choice is not on or off', async () => {
    const settings = await settingsOver(new Map([['settings.hideStreak', '"yes"']]));

    expect((await settings.read()).hideStreak).toBe(false);
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
      hideStreak: false,
      selfCheck: false,
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
      hideStreak: false,
      selfCheck: true,
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
    await settings.update({ theme: 'dark', hideStreak: true });

    expect(await settings.update({ selfCheck: true })).toEqual({
      theme: 'dark',
      fontSize: 'M',
      vibration: true,
      hideStreak: true,
      selfCheck: true,
    });
  });

  it('stays off when the stored choice is not on or off', async () => {
    const settings = await settingsOver(new Map([['settings.selfCheck', '"yes"']]));

    expect((await settings.read()).selfCheck).toBe(false);
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
