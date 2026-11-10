import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { EditionProvider, TokensProvider } from '@slovo/ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings, editionTokens } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { switchedTo, testShell } from '../shell/test-support';
import { renderInGestureRoot } from '../shell/test-render';
import { ForceUpdateGate } from './force-update';
import { storeAddress } from './store-link';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The build the tests run as. */
const device = { appVersion: '1.0.0', platform: 'ios' } as const;

type Minimums = Parameters<typeof switchedTo>[1];

function renderApp(
  minimums: Minimums,
  {
    colorScheme = 'light',
    on = edition,
  }: { colorScheme?: 'light' | 'dark'; on?: typeof edition } = {},
) {
  return renderInGestureRoot(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ remoteSwitches: switchedTo(on, minimums) })}>
        <EditionProvider edition={on} strings={editionStrings}>
          <TokensProvider tokens={editionTokens} colorScheme={colorScheme}>
            <ForceUpdateGate device={device}>
              <Text testID="feed">Feed</Text>
            </ForceUpdateGate>
          </TokensProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
}

const { forceUpdate: texts } = editionStrings;

afterEach(() => {
  jest.restoreAllMocks();
});

describe('The force update', () => {
  it('asks for an update over the Feed below the soft minimum, with the store link', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderApp({ ios: { soft: '1.1.0' } });

    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.getByText(texts.banner)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: texts.bannerAction }));
    expect(openURL).toHaveBeenCalledWith(storeAddress('ios'));
    expect(screen.queryByTestId('force-update-blocking')).not.toBeOnTheScreen();
  });

  it('closes the banner for the app run', async () => {
    await renderApp({ ios: { soft: '1.1.0' } });

    await fireEvent.press(screen.getByRole('button', { name: texts.dismiss }));

    expect(screen.queryByTestId('force-update-banner')).not.toBeOnTheScreen();
    expect(screen.getByTestId('feed')).toBeOnTheScreen();
  });

  it('blocks the Feed below the hard minimum, with the store button', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderApp({ ios: { soft: '2.0.0', hard: '2.0.0' } });

    expect(screen.getByTestId('force-update-blocking')).toBeOnTheScreen();
    expect(screen.getByText(texts.title)).toBeOnTheScreen();
    expect(screen.getByText(texts.body)).toBeOnTheScreen();
    expect(screen.queryByTestId('feed')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('force-update-banner')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('force-update-blocking-retry'));
    expect(openURL).toHaveBeenCalledWith(storeAddress('ios'));
  });

  it('draws nothing with no minimums in the kept answer', async () => {
    await renderApp({});

    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.queryByTestId('force-update-banner')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('force-update-blocking')).not.toBeOnTheScreen();
  });

  it('draws nothing while its Feature Switch is off', async () => {
    const off: typeof edition = {
      ...edition,
      isFeatureEnabled: (feature) => feature !== 'forceUpdate' && edition.isFeatureEnabled(feature),
    };
    await renderApp({ ios: { hard: '2.0.0' } }, { on: off });

    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.queryByTestId('force-update-blocking')).not.toBeOnTheScreen();
  });

  it.each(['light', 'dark'] as const)(
    'draws the same texts in the %s Theme',
    async (colorScheme) => {
      await renderApp({ ios: { soft: '1.1.0' } }, { colorScheme });
      expect(screen.getByText(texts.banner)).toBeOnTheScreen();

      await renderApp({ ios: { hard: '2.0.0' } }, { colorScheme });
      expect(screen.getByText(texts.title)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: texts.button })).toBeOnTheScreen();
    },
  );
});

describe('The store link', () => {
  const store = { name: 'SLOVO', bundleId: 'app.slovo.uk', appStoreConnectAppId: '6740000000' };

  it('names the app by its App Store Connect id on iOS, or searches its name until it has one', () => {
    expect(storeAddress('ios', store)).toBe('https://apps.apple.com/app/id6740000000');
    expect(storeAddress('ios', { ...store, appStoreConnectAppId: '' })).toBe(
      'https://apps.apple.com/search?term=SLOVO',
    );
  });

  it('names the app by its bundle id on Android', () => {
    expect(storeAddress('android', store)).toBe(
      'https://play.google.com/store/apps/details?id=app.slovo.uk',
    );
  });
});
