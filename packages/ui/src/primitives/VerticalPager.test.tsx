import type { Haptics } from '@slovo/core';
import { HapticsProvider, usePageTurnActions, VerticalPager } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';

const PAGES = ['First', 'Second', 'Third'];
/** The pager's height, in points. */
const HEIGHT = 800;
/** The names of the VoiceOver actions that turn the page. */
const TURN_LABELS = { next: 'Next page', previous: 'Previous page' };

/** A page whose text offers the page-turn actions to VoiceOver. */
function TurnablePage({ page }: { page: string }) {
  return <Text {...usePageTurnActions()}>{page}</Text>;
}

async function renderPager({
  initialIndex = 0,
  onIndexChange = jest.fn(),
  selection = jest.fn(),
}: {
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  /** The light tick of a selection, which a swipe plays as it turns the page. */
  selection?: () => void;
}) {
  const haptics: Haptics = {
    selection,
    impactLight: jest.fn(),
    impactMedium: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  };
  const pager = (items: readonly string[]) => (
    <HapticsProvider haptics={haptics}>
      <VerticalPager
        testID="pager"
        items={items}
        initialIndex={initialIndex}
        onIndexChange={onIndexChange}
        renderPage={(page) => <TurnablePage page={page} />}
        turnActionLabels={TURN_LABELS}
      />
    </HapticsProvider>
  );
  await render(pager(PAGES));
  // The pages are drawn once the pager knows its height.
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: HEIGHT } },
  });
  /** Gives the pager other pages, as its owner does when pages leave. */
  return async (items: readonly string[]) => {
    await screen.rerender(pager(items));
  };
}

/** The longest a page takes to settle, swiped or turned without a swipe (ADR 0055). */
const SETTLE_MS = 300;

/** Where the page showing `text` stands: its offset in points and its opacity. */
function pageAt(text: string): { y: number; opacity: number } {
  let node = screen.getByText(text, { includeHiddenElements: true }).parent;
  while (node !== null && node.props['jestAnimatedStyle'] === undefined) node = node.parent;
  if (node === null) throw new Error(`No page holds «${text}».`);
  const style = getAnimatedStyle(node) as {
    opacity?: number;
    transform?: { translateY?: number }[];
  };
  const y = style.transform?.find((step) => step.translateY !== undefined)?.translateY ?? 0;
  return { y, opacity: style.opacity ?? 1 };
}

/** Where the page showing `text` stands every frame for that many milliseconds. */
async function pageOver(text: string, ms: number) {
  const frames: { y: number; opacity: number }[] = [];
  for (let time = 0; time < ms; time += 16) {
    await act(() => {
      jest.advanceTimersByTime(16);
    });
    frames.push(pageAt(text));
  }
  return frames;
}

/** How far, in points, a drag goes before the swipe takes it, as on the device. */
const ACTIVATION = 12;

/**
 * A vertical drag by `distance` points (up is negative), let go at `velocity`
 * points per second. The swipe takes it after `ACTIVATION` points, and the
 * first move it reports is from there.
 */
async function swipe(distance: number, velocity: number, { settle = true } = {}) {
  const start = Math.sign(distance) * ACTIVATION;
  await act(() => {
    fireGestureHandler(getByGestureTestId('pager-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      // The swipe starts here, then reports its first move from the same point.
      { state: State.ACTIVE, translationY: start, velocityY: velocity },
      { state: State.ACTIVE, translationY: start, velocityY: velocity },
      { state: State.ACTIVE, translationY: distance, velocityY: velocity },
      { state: State.END, translationY: distance, velocityY: velocity },
    ]);
  });
  if (!settle) return;
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SETTLE_MS);
  });
}

describe('VerticalPager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('puts only the current page before the reader', async () => {
    await renderPager({});

    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.queryByText('Second')).toBeNull();
  });

  it('turns to the next page on a swipe up', async () => {
    const onIndexChange = jest.fn();
    const selection = jest.fn();
    await renderPager({ onIndexChange, selection });

    await swipe(-HEIGHT / 2, -100);

    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(selection).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.queryByText('First')).toBeNull();
  });

  it('turns to the previous page on a swipe down', async () => {
    const onIndexChange = jest.fn();
    await renderPager({ initialIndex: 1, onIndexChange });

    await swipe(HEIGHT / 2, 100);

    expect(onIndexChange).toHaveBeenCalledWith(0);
    expect(screen.getByText('First')).toBeTruthy();
  });

  it('turns on a short flick', async () => {
    const onIndexChange = jest.fn();
    await renderPager({ onIndexChange });

    await swipe(-40, -1200);

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('stays on the page after a short slow drag', async () => {
    const onIndexChange = jest.fn();
    const selection = jest.fn();
    await renderPager({ onIndexChange, selection });

    await swipe(-HEIGHT / 10, -100);

    expect(onIndexChange).not.toHaveBeenCalled();
    expect(selection).not.toHaveBeenCalled();
    expect(screen.getByText('First')).toBeTruthy();
  });

  it('turns one page however long and fast the swipe', async () => {
    const onIndexChange = jest.fn();
    await renderPager({ onIndexChange });

    await swipe(-HEIGHT * 2, -3000);

    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('turns no further than the last page', async () => {
    const onIndexChange = jest.fn();
    await renderPager({ initialIndex: 2, onIndexChange });

    await swipe(-HEIGHT / 2, -3000);

    expect(onIndexChange).not.toHaveBeenCalled();
    expect(screen.getByText('Third')).toBeTruthy();
  });

  it('shows the last page left once the current page and those after it leave', async () => {
    const setPages = await renderPager({ initialIndex: 2 });

    await setPages(['First', 'Second']);

    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('turns the page with the VoiceOver actions of the current page', async () => {
    const onIndexChange = jest.fn();
    await renderPager({ onIndexChange });
    expect(screen.getByText('First').props['accessibilityActions']).toEqual([
      { name: 'next', label: TURN_LABELS.next },
    ]);

    await fireEvent(screen.getByText('First'), 'accessibilityAction', {
      nativeEvent: { actionName: 'next' },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByText('Second').props['accessibilityActions']).toEqual([
      { name: 'next', label: TURN_LABELS.next },
      { name: 'previous', label: TURN_LABELS.previous },
    ]);
    // The page left behind offers none.
    expect(
      screen.getByText('First', { includeHiddenElements: true }).props['accessibilityActions'],
    ).toBeUndefined();
  });

  it('settles a swipe on a spring within 300 ms, never past the page', async () => {
    await renderPager({});

    await swipe(-HEIGHT / 2, -1500, { settle: false });
    const frames = await pageOver('Second', SETTLE_MS);

    // Let go half way, the page moves on from there and stops on its place.
    expect(frames[0]?.y).toBeGreaterThan(0);
    expect(frames[0]?.y).toBeLessThan(HEIGHT / 2);
    expect(frames.every(({ y }) => y >= 0)).toBe(true);
    expect(frames.at(-1)?.y).toBe(0);
    expect(pageAt('First').y).toBe(-HEIGHT);
  });

  it('turns without a swipe in 300 ms', async () => {
    await renderPager({});

    await fireEvent(screen.getByText('First'), 'accessibilityAction', {
      nativeEvent: { actionName: 'next' },
    });
    const frames = await pageOver('Second', SETTLE_MS);

    expect(frames[0]?.y).toBeGreaterThan(0);
    expect(frames.at(-1)?.y).toBe(0);
  });

  it('cross-fades the pages in place under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const onIndexChange = jest.fn();
    await renderPager({ onIndexChange });

    await swipe(-HEIGHT / 2, -100, { settle: false });
    const frames = await pageOver('Second', SETTLE_MS);

    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(frames.every(({ y }) => y === 0)).toBe(true);
    expect(frames.some(({ opacity }) => opacity > 0 && opacity < 1)).toBe(true);
    expect(frames.at(-1)?.opacity).toBe(1);
    expect(pageAt('First')).toEqual({ y: 0, opacity: 0 });
  });
});
