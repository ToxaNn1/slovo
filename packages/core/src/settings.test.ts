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

    expect(await settings.read()).toEqual({ theme: 'system', fontSize: 'M', vibration: true });
  });

  it("uses the user's Theme over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ theme: 'dark' })).toEqual({ theme: 'dark', fontSize: 'M', vibration: true });
    expect(await settings.read()).toEqual({ theme: 'dark', fontSize: 'M', vibration: true });
  });

  it("uses the user's font size over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ fontSize: 'XL' })).toEqual({ theme: 'system', fontSize: 'XL', vibration: true });
    expect(await settings.read()).toEqual({ theme: 'system', fontSize: 'XL', vibration: true });
  });

  it("keeps the user's Theme and font size when the user state is opened again", async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ theme: 'light', fontSize: 'S', vibration: true });

    expect(await (await settingsOver(records)).read()).toEqual({ theme: 'light', fontSize: 'S', vibration: true });
  });

  it('changes one setting without touching the other', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark' });

    expect(await settings.update({ fontSize: 'L' })).toEqual({ theme: 'dark', fontSize: 'L', vibration: true });
  });

  it("falls back to the Edition's default when the stored Theme is not one the Core knows", async () => {
    const settings = await settingsOver(new Map([['settings.theme', 'sepia']]));

    expect(await settings.read()).toEqual({ theme: 'system', fontSize: 'M', vibration: true });
  });

  it("falls back to the Edition's default when the stored font size is not one the Core knows", async () => {
    const settings = await settingsOver(
      new Map([
        ['settings.fontSize', 'XXL'],
        ['settings.theme', 'dark'],
      ]),
    );

    expect(await settings.read()).toEqual({ theme: 'dark', fontSize: 'M', vibration: true });
  });

  it("starts from a different Edition's default font size", async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const settings = createSettings({ userState, defaults: { theme: 'light', fontSize: 'L' } });

    expect(await settings.read()).toEqual({ theme: 'light', fontSize: 'L' });
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
    });
  });

  it("falls back to the Edition's default when the stored Vibration is not on or off", async () => {
    const settings = await settingsOver(new Map([['settings.vibration', '"loud"']]));

    expect((await settings.read()).vibration).toBe(true);
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
