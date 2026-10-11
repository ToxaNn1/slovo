import { describe, expect, it } from 'vitest';

import { colorSchemeFor, createMemoryUserStatePort, createSettings, openUserState } from './index';

const defaults = { theme: 'system', fontSize: 'M' } as const;

async function settingsOver(records = new Map<string, string>()) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return createSettings({ userState, defaults });
}

describe('settings', () => {
  it("uses the Edition's defaults until the user chooses", async () => {
    const settings = await settingsOver();

    expect(await settings.read()).toEqual({ theme: 'system', fontSize: 'M' });
  });

  it("uses the user's Theme over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ theme: 'dark' })).toEqual({ theme: 'dark', fontSize: 'M' });
    expect(await settings.read()).toEqual({ theme: 'dark', fontSize: 'M' });
  });

  it("uses the user's font size over the Edition's default, and returns the settings in effect", async () => {
    const settings = await settingsOver();

    expect(await settings.update({ fontSize: 'XL' })).toEqual({ theme: 'system', fontSize: 'XL' });
    expect(await settings.read()).toEqual({ theme: 'system', fontSize: 'XL' });
  });

  it("keeps the user's Theme and font size when the user state is opened again", async () => {
    const records = new Map<string, string>();
    await (await settingsOver(records)).update({ theme: 'light', fontSize: 'S' });

    expect(await (await settingsOver(records)).read()).toEqual({ theme: 'light', fontSize: 'S' });
  });

  it('changes one setting without touching the other', async () => {
    const settings = await settingsOver();
    await settings.update({ theme: 'dark' });

    expect(await settings.update({ fontSize: 'L' })).toEqual({ theme: 'dark', fontSize: 'L' });
  });

  it("falls back to the Edition's default when the stored Theme is not one the Core knows", async () => {
    const settings = await settingsOver(new Map([['settings.theme', 'sepia']]));

    expect(await settings.read()).toEqual({ theme: 'system', fontSize: 'M' });
  });

  it("falls back to the Edition's default when the stored font size is not one the Core knows", async () => {
    const settings = await settingsOver(
      new Map([
        ['settings.fontSize', 'XXL'],
        ['settings.theme', 'dark'],
      ]),
    );

    expect(await settings.read()).toEqual({ theme: 'dark', fontSize: 'M' });
  });

  it("starts from a different Edition's default font size", async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const settings = createSettings({ userState, defaults: { theme: 'light', fontSize: 'L' } });

    expect(await settings.read()).toEqual({ theme: 'light', fontSize: 'L' });
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
