import { EditionProvider, FeedLoading } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

/** The Core Decor's divider band is 4 wide, so each stitch is the narrowest, 14. */
const STITCH = 14;
const STITCH_MS = 140;
const WIDTH = 10 * STITCH;

async function renderLoading() {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <FeedLoading text="Loading" accessibilityLabel="Loading the Feed" />
    </EditionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  await fireEvent(screen.getByTestId('feed-loading-divider'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 8 } },
  });
}

/** How wide the stitched part of the divider is drawn. */
const stitched = () => getAnimatedStyle(screen.getByTestId('feed-loading-stitched'));

/** Lets the given milliseconds pass on the faked timers. */
async function pass(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('FeedLoading', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('stitches the divider in one stitch every 140 ms, holds it whole, then starts again', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await renderLoading();

    await pass(3 * STITCH_MS + 10);
    expect(stitched()).toMatchObject({ width: 3 * STITCH });

    await pass(7 * STITCH_MS);
    expect(stitched()).toMatchObject({ width: WIDTH });

    await pass(4 * STITCH_MS);
    expect(stitched()).toMatchObject({ width: WIDTH });

    await pass(STITCH_MS);
    expect(stitched()).toMatchObject({ width: 0 });
  });

  it('draws the divider whole and still with Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderLoading();

    await pass(16);
    expect(stitched()).toMatchObject({ width: WIDTH });
    await pass(3 * STITCH_MS);
    expect(stitched()).toMatchObject({ width: WIDTH });
  });
});
