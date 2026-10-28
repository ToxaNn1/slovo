import type { EditionStrings } from '@slovo/contracts';
import type { Haptics } from '@slovo/core';
import { EditionProvider, FavoriteButton, HapticsProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

const strings = {
  favorites: { heart: { add: 'Add to Favorites', remove: 'Remove from Favorites' } },
} as unknown as EditionStrings;

const impactLight = jest.fn();

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight,
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

/** The heart over Favorites that hold one Entry, or not. */
function Heart({ saved }: { saved: boolean }) {
  const [inFavorites, setInFavorites] = useState(saved);
  return (
    <FavoriteButton
      inFavorites={inFavorites}
      onToggle={() => {
        setInFavorites(!inFavorites);
        return Promise.resolve(!inFavorites);
      }}
    />
  );
}

async function renderHeart(saved = false) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <Heart saved={saved} />
      </HapticsProvider>
    </EditionProvider>,
  );
}

/** The scale of the heart's icon. */
function scale(): number {
  const icon = screen.getByTestId('favorite-button').children[0];
  if (typeof icon !== 'object') throw new Error('The heart draws no icon.');
  const style = getAnimatedStyle(icon) as { transform?: { scale?: number }[] };
  return style.transform?.find((step) => step.scale !== undefined)?.scale ?? 1;
}

/** The heart's scale every frame for that many milliseconds. */
async function scalesOver(ms: number): Promise<number[]> {
  const scales: number[] = [];
  for (let time = 0; time < ms; time += 16) {
    await act(() => {
      jest.advanceTimersByTime(16);
    });
    scales.push(scale());
  }
  return scales;
}

describe('FavoriteButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    impactLight.mockClear();
  });

  it('springs to 1.2 and back within 300 ms with one light haptic when saving', async () => {
    await renderHeart();

    await fireEvent.press(screen.getByRole('button', { name: 'Add to Favorites' }));
    const scales = await scalesOver(320);

    expect(impactLight).toHaveBeenCalledTimes(1);
    expect(Math.max(...scales)).toBeCloseTo(1.2, 1);
    expect(scales.at(-1)).toBeCloseTo(1, 2);
    expect(screen.getByRole('button', { name: 'Remove from Favorites' })).toBeOnTheScreen();
  });

  it('neither springs nor plays a haptic when taking the Entry out', async () => {
    await renderHeart(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove from Favorites' }));
    const scales = await scalesOver(320);

    expect(impactLight).not.toHaveBeenCalled();
    expect(scales.every((value) => value === 1)).toBe(true);
  });

  it('only fills with Reduce Motion, with the same light haptic', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderHeart();

    await fireEvent.press(screen.getByRole('button', { name: 'Add to Favorites' }));
    const scales = await scalesOver(320);

    expect(impactLight).toHaveBeenCalledTimes(1);
    expect(scales.every((value) => value === 1)).toBe(true);
    expect(screen.getByRole('button', { name: 'Remove from Favorites' })).toBeOnTheScreen();
  });
});
