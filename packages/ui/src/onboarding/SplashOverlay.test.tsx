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
    expect(screen.getByText('rare words')).toBeTruthy();
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
    ['first', false, 2000],
    ['daily', false, 500],
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

  it("draws the cut in the dark Theme's own background and ink", async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(
      <TokensProvider tokens={coreTokens} colorScheme="dark">
        <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
          <SplashOverlay wordmark="SLOVO" tagline="rare words" kind="first" onDone={jest.fn()} />
        </EditionProvider>
      </TokensProvider>,
    );
    await pass(0);
    const dark = coreTokens.colors.dark;
    expect(screen.getByTestId('splash')).toHaveStyle({ backgroundColor: dark.background });
    expect(screen.getAllByText('S')[0]).toHaveStyle({ color: dark.ink });
    expect(screen.getByText('rare words')).toHaveStyle({ color: dark.muted });
  });

  it('wipes the screen to the app', async () => {
    await renderSplash('first', false);
    expect(screen.getByTestId('splash-wipe')).toBeTruthy();
  });

  it('draws no wipe under Reduce Motion', async () => {
    await renderSplash('first', true);
    expect(screen.queryByTestId('splash-wipe')).toBeNull();
  });

  it('shows the shouting Mascot', async () => {
    await renderSplash('daily', false);
    expect(screen.getByTestId('mascot-shouts')).toBeTruthy();
  });
});
