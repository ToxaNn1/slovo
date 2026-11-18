import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import * as WebBrowser from 'expo-web-browser';

import AboutScreen from '../app/settings/about';
import { edition, editionStrings } from '../edition/edition';

/**
 * What the installed build and the update it runs report, set by each test,
 * and whether the binary has the modules that report them. The Update
 * channel is read once, when first asked, so it stays `beta` here.
 */
const mockBuild: {
  version: string | null;
  build: string | null;
  environment: string;
  updateId: string | null;
  createdAt: Date | null;
  isEmbeddedLaunch: boolean;
  channel: string | null;
  modules: boolean;
} = {
  // The native version differs from the app config's, so a test sees which one shows.
  version: '9.9',
  build: '42',
  environment: 'standalone',
  updateId: null,
  createdAt: null,
  isEmbeddedLaunch: true,
  channel: 'beta',
  modules: true,
};
// The binary has `expo-application` and `expo-updates` unless a test says not.
jest.mock('../device/device-native-modules', () => ({
  nativeModules: {
    has: () => mockBuild.modules,
    load: (_name: string, require: () => unknown) => (mockBuild.modules ? require() : undefined),
  },
}));
// The app config's version, and where the app runs: Expo Go is `storeClient`.
jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
  default: {
    expoConfig: { version: '0.9' },
    get executionEnvironment() {
      return mockBuild.environment;
    },
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
  get createdAt() {
    return mockBuild.createdAt;
  },
  get isEmbeddedLaunch() {
    return mockBuild.isEmbeddedLaunch;
  },
  get channel() {
    return mockBuild.channel;
  },
}));

/** About as the app routes to it, under the Edition's strings. */
async function renderAbout() {
  await renderRoutes(
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
  it("heads the screen with the Edition's name on the red panel, under its giant letter", async () => {
    await renderAbout();

    const panel = within(screen.getByTestId('about-panel'));
    expect(panel.getByRole('header', { name: edition.displayName })).toBeTruthy();
    expect(
      panel.getByText(editionStrings.settings.about.glyph, { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(panel.queryByText(editionStrings.settings.about.glyph)).toBeNull();
  });

  it.each([
    ['privacy policy', 'about-row-privacy', 'https://slovoapp.org/uk/privacy'],
    ['terms', 'about-row-terms', 'https://slovoapp.org/uk/terms'],
  ])(
    "opens the Edition's %s in the app's own browser sheet, closed by «Готово»",
    async (_page, rowId, address) => {
      const openBrowser = jest
        .spyOn(WebBrowser, 'openBrowserAsync')
        .mockResolvedValue({ type: WebBrowser.WebBrowserResultType.DISMISS });
      await renderAbout();

      await fireEvent.press(screen.getByTestId(rowId));

      expect(openBrowser).toHaveBeenCalledWith(address, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        dismissButtonStyle: 'done',
      });
    },
  );

  it("shows the app's own version and the build, never the raw update id", async () => {
    mockBuild.modules = true;
    mockBuild.updateId = '0198e3a1-7c2b-7f00-9a4e-3b5d6c7e8f90';
    await renderAbout();

    expect(screen.getByTestId('about-version')).toHaveTextContent('Версія 0.9 · збірка 42');
    expect(screen.queryByText(/0198e3a1/)).toBeNull();
    expect(screen.queryByText(/^Оновлення /)).toBeNull();
  });

  it('names the update it runs by the day it was made, never by its id', async () => {
    mockBuild.modules = true;
    mockBuild.updateId = '0198e3a1-7c2b-7f00-9a4e-3b5d6c7e8f90';
    mockBuild.createdAt = new Date(2026, 10, 18, 9, 30);
    mockBuild.isEmbeddedLaunch = false;
    try {
      await renderAbout();

      expect(screen.getByTestId('about-update')).toHaveTextContent('Оновлення від 18 листопада');
      expect(screen.queryByText(/0198e3a1/)).toBeNull();
    } finally {
      mockBuild.updateId = null;
      mockBuild.createdAt = null;
      mockBuild.isEmbeddedLaunch = true;
    }
  });

  it('shows no update line while the build runs the code it shipped with', async () => {
    mockBuild.modules = true;
    mockBuild.createdAt = new Date(2026, 10, 18, 9, 30);
    try {
      await renderAbout();

      expect(screen.getByTestId('about-version')).toHaveTextContent('Версія 0.9 · збірка 42');
      expect(screen.queryByTestId('about-update')).toBeNull();
    } finally {
      mockBuild.createdAt = null;
    }
  });

  it("shows the app's version, not Expo Go's, and no build under Expo Go", async () => {
    mockBuild.modules = true;
    mockBuild.environment = 'storeClient';
    mockBuild.version = '58.0.7';
    mockBuild.build = '1017';
    try {
      await renderAbout();

      expect(screen.getByTestId('about-version')).toHaveTextContent('Версія 0.9');
      expect(screen.queryByText(/58\.0\.7|1017/)).toBeNull();
    } finally {
      mockBuild.environment = 'standalone';
      mockBuild.version = '9.9';
      mockBuild.build = '42';
    }
  });

  it('shows the Update channel the build listens to (ADR 0167)', async () => {
    mockBuild.modules = true;
    await renderAbout();

    expect(screen.getByText('Канал оновлень beta')).toBeTruthy();
  });

  it('shows the version without a build on a binary that lacks the modules reporting it', async () => {
    mockBuild.modules = false;
    await renderAbout();

    expect(screen.getByText(edition.displayName)).toBeTruthy();
    expect(screen.getByTestId('about-version')).toHaveTextContent('Версія 0.9');
  });
});

describe('About › its header (app pass 91)', () => {
  it('keeps the back header above the list, so it stays put under the status bar while the list scrolls', async () => {
    await renderAbout();

    expect(
      screen.getByRole('header', { name: editionStrings.settings.rows.about }),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('about-scroll')).queryByRole('header', {
        name: editionStrings.settings.rows.about,
      }),
    ).toBeNull();
  });
});
