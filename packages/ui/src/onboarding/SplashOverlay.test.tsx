import { coreTokens, EditionProvider, SplashOverlay, TokensProvider } from '@slovo/ui';
import type { LaunchKind } from '@slovo/core';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

async function renderSplash(kind: LaunchKind, reduceMotion: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  const onDone = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <SplashOverlay wordmark="SLOVO" tagline="rare words" kind={kind} onDone={onDone} />
    </EditionProvider>,
  );
  await pass(0);
  return onDone;
}

async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('SplashOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('draws the wordmark and the tagline on the cut', async () => {
    await renderSplash('first', false);
    expect(screen.getByTestId('splash')).toBeTruthy();
    expect(screen.getByText('RARE WORDS')).toBeTruthy();
    expect(screen.getAllByText(/^[SLOV]$/)).toHaveLength(5);
  });

  it('draws the wordmark on an engine without Intl.Segmenter, as Hermes is', async () => {
    const segmenter = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    Reflect.deleteProperty(Intl, 'Segmenter');
    try {
      await renderSplash('daily', false);
      expect(screen.getAllByText(/^[SLOV]$/)).toHaveLength(5);
    } finally {
      if (segmenter) Object.defineProperty(Intl, 'Segmenter', segmenter);
    }
  });

  it.each<[LaunchKind, boolean, number]>([
    ['first', false, 2050],
    ['daily', false, 560],
    ['first', true, 800],
    ['daily', true, 350],
  ])(
    'hands over to the app on a %s launch (Reduce Motion %s) after %i ms',
    async (kind, rm, ms) => {
      const onDone = await renderSplash(kind, rm);
      await pass(ms - 10);
      expect(onDone).not.toHaveBeenCalled();
      await pass(10);
      expect(onDone).toHaveBeenCalledTimes(1);
    },
  );

  it('draws the letters in ink and the tagline in cream in the dark Theme, as the board', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(
      <TokensProvider tokens={coreTokens} colorScheme="dark">
        <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
          <SplashOverlay wordmark="SLOVO" tagline="rare words" kind="first" onDone={jest.fn()} />
        </EditionProvider>
      </TokensProvider>,
    );
    await pass(0);
    // The board's band is fixed: #140C0A ink letters and band, #FFF4E6 cream tagline in both Themes.
    const light = coreTokens.colors.light;
    expect(screen.getAllByText('S')[0]).toHaveStyle({ color: light.ink });
    expect(screen.getByText('RARE WORDS')).toHaveStyle({ color: light.background });
  });

  it('shows the shouting Mascot on the red', async () => {
    await renderSplash('daily', false);
    expect(screen.getByTestId('mascot-shouts')).toBeTruthy();
  });
});
