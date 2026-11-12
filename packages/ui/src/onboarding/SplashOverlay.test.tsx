import { coreTokens, EditionProvider, SplashOverlay, TokensProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';
import { testStrings } from '../test-strings';

async function renderSplash(reduceMotion: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  const onDone = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <SplashOverlay wordmark="SLOVO" tagline="rare words" onDone={onDone} />
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
    await renderSplash(false);
    expect(screen.getByTestId('splash')).toBeTruthy();
    expect(screen.getByText('rare words')).toBeTruthy();
    expect(screen.getAllByText(/^[SLOV]$/)).toHaveLength(5);
  });

  it('draws the wordmark on an engine without Intl.Segmenter, as Hermes is', async () => {
    const segmenter = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    Reflect.deleteProperty(Intl, 'Segmenter');
    try {
      await renderSplash(false);
      expect(screen.getAllByText(/^[SLOV]$/)).toHaveLength(5);
    } finally {
      if (segmenter) Object.defineProperty(Intl, 'Segmenter', segmenter);
    }
  });

  it.each<[boolean, number]>([
    [false, 4200],
    [true, 800],
  ])('hands over to the app on every launch (Reduce Motion %s) after %i ms', async (rm, ms) => {
    const onDone = await renderSplash(rm);
    await pass(ms - 10);
    expect(onDone).not.toHaveBeenCalled();
    await pass(10);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('hands over through the latest onDone it was given', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const first = jest.fn();
    const latest = jest.fn();
    const splash = (onDone: () => void) => (
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <SplashOverlay wordmark="SLOVO" tagline="rare words" onDone={onDone} />
      </EditionProvider>
    );
    const { rerender } = await render(splash(first));
    await pass(100);
    await rerender(splash(latest));
    await pass(4100);
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("draws the cut in the dark Theme's own background, ink and tagline colour", async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const dark = { ...coreTokens.colors.dark, tagline: '#123456' };
    await render(
      <TokensProvider
        tokens={{ ...coreTokens, colors: { ...coreTokens.colors, dark } }}
        colorScheme="dark"
      >
        <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
          <SplashOverlay wordmark="SLOVO" tagline="rare words" onDone={jest.fn()} />
        </EditionProvider>
      </TokensProvider>,
    );
    await pass(0);
    expect(screen.getByTestId('splash')).toHaveStyle({ backgroundColor: dark.background });
    expect(screen.getAllByText('S')[0]).toHaveStyle({ color: dark.ink });
    expect(screen.getByText('rare words')).toHaveStyle({ color: '#123456' });
  });

  it("holds each letter wholly under its row's clip before it pops up, its capital's top included", async () => {
    await renderSplash(false);
    const { width, height } = Dimensions.get('window');
    const scale = Math.min(width / 390, height / 844);
    const [first] = screen.getAllByText('S');
    const { transform } = StyleSheet.flatten(first?.props['style']) as {
      transform: [{ translateY: number }];
    };
    // 105% of the line and the row's 4 pt bottom room left the capital's top showing on iOS.
    expect(transform[0].translateY).toBeGreaterThan((1.05 * 58 + 4 + 10) * scale);
  });

  it('wipes the screen to the app', async () => {
    await renderSplash(false);
    expect(screen.getByTestId('splash-wipe')).toBeTruthy();
  });

  it('draws no wipe under Reduce Motion', async () => {
    await renderSplash(true);
    expect(screen.queryByTestId('splash-wipe')).toBeNull();
  });

  it('shows the shouting Mascot', async () => {
    await renderSplash(false);
    expect(screen.getByTestId('mascot-shouts')).toBeTruthy();
  });
});
