import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import AboutScreen from '../app/settings/about';
import { edition, editionStrings } from '../edition/edition';

/**
 * What the installed build and the update it runs report, set by each test,
 * and whether the binary has the modules that report them.
 */
const mockBuild: {
  version: string | null;
  build: string | null;
  updateId: string | null;
  modules: boolean;
} = {
  version: '0.9',
  build: '42',
  updateId: null,
  modules: true,
};
// The binary has `expo-application` and `expo-updates` unless a test says not.
jest.mock('../device/device-native-modules', () => ({
  nativeModules: {
    has: () => mockBuild.modules,
    load: (_name: string, require: () => unknown) => (mockBuild.modules ? require() : undefined),
  },
}));
jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockBuild.version;
  },
  get nativeBuildVersion() {
    return mockBuild.build;
  },
}));
jest.mock('expo-updates', () => ({
  get updateId() {
    return mockBuild.updateId;
  },
}));

/** About as the app routes to it, under the Edition's strings. */
async function renderAbout() {
  await renderRouter(
    {
      _layout: () => (
        <EditionProvider edition={edition} strings={editionStrings}>
          <Slot />
        </EditionProvider>
      ),
      'settings/about': AboutScreen,
    },
    { initialUrl: '/settings/about' },
  );
}

describe('About', () => {
  it.each([
    ['privacy policy', 'about-row-privacy', 'https://slovo.example/uk/privacy'],
    ['terms', 'about-row-terms', 'https://slovo.example/uk/terms'],
  ])("opens the Edition's %s in the browser", async (_page, rowId, address) => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderAbout();

    await fireEvent.press(screen.getByTestId(rowId));

    expect(openURL).toHaveBeenCalledWith(address);
  });

  it('shows the version, the build and the update the app runs', async () => {
    mockBuild.modules = true;
    mockBuild.updateId = '0198e3a1-7c2b-7f00-9a4e-3b5d6c7e8f90';
    await renderAbout();

    expect(screen.getByText('Версія 0.9 · збірка 42')).toBeTruthy();
    expect(screen.getByText('Оновлення 0198e3a1-7c2b-7f00-9a4e-3b5d6c7e8f90')).toBeTruthy();
  });

  it('shows no update line when the app runs without updates', async () => {
    mockBuild.modules = true;
    mockBuild.updateId = null;
    await renderAbout();

    expect(screen.getByText('Версія 0.9 · збірка 42')).toBeTruthy();
    expect(screen.queryByText(/^Оновлення /)).toBeNull();
  });

  it('opens without the version and update lines on a binary that lacks the modules reporting them', async () => {
    mockBuild.modules = false;
    mockBuild.updateId = '0198e3a1-7c2b-7f00-9a4e-3b5d6c7e8f90';
    await renderAbout();

    expect(screen.getByText(editionStrings.splash.wordmark)).toBeTruthy();
    expect(screen.queryByTestId('about-version')).toBeNull();
    expect(screen.queryByTestId('about-update')).toBeNull();
  });
});
