import { EditionProvider, GameTimer } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const texts = {
  remaining: (seconds: number) => `${String(seconds)} seconds left`,
  shown: (seconds: number) => `${String(seconds)} s`,
};

function Timer({ remainingMs, running = false }: { remainingMs: number; running?: boolean }) {
  return (
    <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
      <GameTimer
        remainingMs={remainingMs}
        totalMs={60_000}
        running={running}
        texts={texts}
        testID="timer"
      />
    </EditionProvider>
  );
}

describe('GameTimer', () => {
  let announce: jest.SpiedFunction<typeof AccessibilityInfo.announceForAccessibility>;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
  });
  afterEach(() => {
    announce.mockRestore();
  });

  it('shows the whole seconds left, counted up, and reads them by name', async () => {
    await render(<Timer remainingMs={39_200} />);

    expect(screen.getByText('40 s')).toBeTruthy();
    expect(screen.getByLabelText('40 seconds left')).toBeTruthy();
  });

  it('never shows less than none', async () => {
    await render(<Timer remainingMs={-300} />);

    expect(screen.getByText('0 s')).toBeTruthy();
  });

  it('announces the time left as each ten seconds pass, and only then', async () => {
    const view = await render(<Timer remainingMs={60_000} />);
    for (let ms = 59_500; ms >= 0; ms -= 500) await view.rerender(<Timer remainingMs={ms} />);

    expect(announce.mock.calls.map(([text]) => text)).toEqual([
      '50 seconds left',
      '40 seconds left',
      '30 seconds left',
      '20 seconds left',
      '10 seconds left',
    ]);
  });

  it('announces once when a jump skips a ten, and not again as the same time is drawn', async () => {
    const view = await render(<Timer remainingMs={42_000} />);
    await view.rerender(<Timer remainingMs={38_000} />);
    await view.rerender(<Timer remainingMs={38_000} />);
    await view.rerender(<Timer remainingMs={37_500} />);

    expect(announce.mock.calls.map(([text]) => text)).toEqual(['38 seconds left']);
  });

  describe('its bar', () => {
    /** How much of the bar is left, 1 full and 0 empty. */
    const barLeft = () =>
      (getAnimatedStyle(screen.getByTestId('timer-left')) as { transform: [{ scaleX: number }] })
        .transform[0].scaleX;

    afterEach(() => {
      jest.useRealTimers();
    });

    it('stands at the share of the time left while the clock is paused', async () => {
      jest.useFakeTimers();
      await render(<Timer remainingMs={45_000} />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });

      expect(barLeft()).toBeCloseTo(0.75);
    });

    it('empties on its own at the pace of the clock while it runs, with no new time drawn', async () => {
      jest.useFakeTimers();
      await render(<Timer remainingMs={30_000} running />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15_000);
      });

      expect(barLeft()).toBeCloseTo(0.25, 1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15_000);
      });
      expect(barLeft()).toBe(0);
    });
  });
});
