import { describe, expect, it } from 'vitest';

import { colorSchemeFor, createMemoryUserStatePort, createSettings, openUserState } from './index';

const defaults = { theme: 'system' } as const;

async function settingsOver(records = new Map<string, string>()) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return createSettings({ userState, defaults });
}

describe('settings', () => {
  it("uses the Edition's default Theme until the user chooses one", async () => {
    const settings = await settingsOver();

    expect(await settings.read()).toEqual({ theme: 'system' });
  });

  it("uses the user's Theme over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ theme: 'dark' })).toEqual({ theme: 'dark' });
    expect(await settings.read()).toEqual({ theme: 'dark' });
  });

  it("keeps the user's Theme when the user state is opened again", async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ theme: 'light' });

    expect(await (await settingsOver(records)).read()).toEqual({ theme: 'light' });
  });

  it("falls back to the Edition's default when the stored Theme is not one the Core knows", async () => {
    const settings = await settingsOver(new Map([['settings.theme', 'sepia']]));

    expect(await settings.read()).toEqual({ theme: 'system' });
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
