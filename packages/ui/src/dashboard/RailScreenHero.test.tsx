import { EditionProvider, RailScreenHero } from '@slovo/ui';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import type { ComponentProps } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type Hero = ComponentProps<typeof RailScreenHero>;

/** The hero tree with a description unless `withDescription` is false. */
function heroTree(props: Partial<Hero>, back: Hero['back'], withDescription = true) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
        <RailScreenHero
          id="hero"
          glyph="circle"
          kicker="Category · 4 words"
          title="Gentle words"
          {...(withDescription && { description: 'Words that sound soft.' })}
          progress="Known 1 of 4"
          done={0.25}
          mascot="waits"
          back={back}
          {...props}
        />
      </EditionProvider>
    </SafeAreaProvider>
  );
}

async function renderHero(props: Partial<Hero> = {}, withDescription = true) {
  const back = { label: 'Home', onPress: jest.fn() };
  await render(heroTree(props, back, withDescription));
  return back;
}

describe('RailScreenHero', () => {
  it('shows the kicker, the title as a header, the description and the progress, and goes back', async () => {
    const back = await renderHero();

    expect(screen.getByText('Category · 4 words')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Gentle words' })).toBeTruthy();
    expect(screen.getByTestId('hero-description')).toHaveTextContent('Words that sound soft.');
    expect(screen.getByTestId('hero-progress')).toHaveTextContent('Known 1 of 4');
    expect(screen.queryByTestId('hero-action')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));

    expect(back.onPress).toHaveBeenCalledTimes(1);
  });

  it('draws no description when the screen has none, as a Collection’s', async () => {
    await renderHero({}, false);

    expect(screen.getByRole('header', { name: 'Gentle words' })).toBeTruthy();
    expect(screen.queryByTestId('hero-description')).toBeNull();
  });

  it('draws the add button not yet pressed, and its press adds', async () => {
    const onPress = jest.fn();
    await renderHero({ action: { kind: 'toggle', label: 'Add', on: false, onPress } });

    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).not.toBeSelected();
    // The board's hard shadow lies below the button, outside its face.
    expect(screen.getByTestId('hero-action-edge')).toBeOnTheScreen();
    expect(add).not.toHaveStyle({ borderBottomWidth: 3 });

    await fireEvent.press(add);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws the add button pressed once the copy is kept', async () => {
    await renderHero({
      action: { kind: 'toggle', label: 'In the mix', on: true, onPress: jest.fn() },
    });

    expect(screen.getByRole('button', { name: 'In the mix' })).toBeSelected();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByTestId('hero-action-edge')).toBeNull();
  });

  describe('the tick of the toggle', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    /** Renders the toggle off, then on, with Reduce Motion as given, and lets 100 ms pass. */
    async function toggleOn(reduceMotion: boolean) {
      jest.useFakeTimers();
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
      const action = { kind: 'toggle', label: 'Add', on: false, onPress: jest.fn() } as const;
      const back = await renderHero({ action });
      await act(async () => {
        await Promise.resolve();
      });
      await screen.rerender(heroTree({ action: { ...action, label: 'Added', on: true } }, back));
      await act(() => {
        jest.advanceTimersByTime(100);
      });
    }

    /** The scale of the toggle's icon, 1 when it rests. */
    function iconScale(): number {
      const { transform } = getAnimatedStyle(screen.getByTestId('hero-action-icon')) as {
        transform: { scale?: number }[];
      };
      return transform.find((step) => step.scale !== undefined)?.scale ?? 1;
    }

    it('pops in once the toggle turns on, and comes to rest', async () => {
      await toggleOn(false);

      expect(screen.getByRole('button', { name: 'Added' })).toBeSelected();
      expect(iconScale()).not.toBe(1);
      await act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(iconScale()).toBe(1);
    });

    it('stays still with Reduce Motion', async () => {
      await toggleOn(true);

      expect(screen.getByRole('button', { name: 'Added' })).toBeSelected();
      expect(iconScale()).toBe(1);
    });

    it('does not pop when the screen opens with the copy already kept', async () => {
      jest.useFakeTimers();
      await renderHero({
        action: { kind: 'toggle', label: 'Added', on: true, onPress: jest.fn() },
      });
      await act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(iconScale()).toBe(1);
    });
  });

  it('draws the Collection menu button in the right slot, and its press opens the menu', async () => {
    const onPress = jest.fn();
    await renderHero({ action: { kind: 'menu', label: 'Collection menu', onPress } });

    const menu = screen.getByRole('button', { name: 'Collection menu' });
    expect(menu).not.toBeSelected();
    expect(screen.queryByText('Collection menu')).toBeNull();

    await fireEvent.press(menu);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
