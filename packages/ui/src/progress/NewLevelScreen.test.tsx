import { coreTokens, EditionProvider, NewLevelScreen, TokensProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, View } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import type { ReactNode } from 'react';

import { testStrings } from '../test-strings';

async function renderScreen(onClose = jest.fn(), mascot?: (width: number) => ReactNode) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme="light">
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <NewLevelScreen
          level={4}
          kicker="LEVEL"
          title="Level 4 — Bookworm"
          line="A new Level! Keep it up."
          doneLabel="DONE"
          onClose={onClose}
          {...(mascot === undefined ? {} : { mascot })}
        />
      </EditionProvider>
    </TokensProvider>,
  );
  return onClose;
}

/** The landing number's opacity, scale and turn in degrees. */
function numberPose() {
  const style = getAnimatedStyle(screen.getByTestId('new-level-number'));
  const steps: readonly object[] = Array.isArray(style.transform) ? style.transform : [];
  let scale = 1;
  let turn = 0;
  for (const step of steps) {
    if ('scale' in step && typeof step.scale === 'number') scale = step.scale;
    if ('rotate' in step && typeof step.rotate === 'string') turn = Number.parseFloat(step.rotate);
  }
  const opacity = typeof style.opacity === 'number' ? style.opacity : 1;
  return { opacity, scale, turn };
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('NewLevelScreen (board 10, the new Level)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the kicker, the number, the title and the line under the title', async () => {
    await renderScreen();
    const ground = screen.getByTestId('new-level');

    expect(within(ground).getByText('LEVEL')).toBeOnTheScreen();
    expect(within(ground).getByText('4')).toBeOnTheScreen();
    expect(within(ground).getByRole('header', { name: 'Level 4 — Bookworm' })).toBeOnTheScreen();
    expect(within(ground).getByTestId('new-level-line')).toHaveTextContent(
      'A new Level! Keep it up.',
    );
  });

  it('draws the kicker small in a corner, not as a giant word the number overlaps', async () => {
    await renderScreen();

    expect(screen.getByText('LEVEL')).not.toHaveProp('adjustsFontSizeToFit', true);
    expect(screen.getByText('LEVEL')).toHaveStyle({ position: 'absolute', fontSize: 44 });
  });

  it('closes on its button', async () => {
    const onClose = await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'DONE' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lands the number as slStamp on the board: hidden for .2 s, .92× at 70 %, at rest at .8 s', async () => {
    await renderScreen();

    await advance(150);
    expect(numberPose()).toEqual({ opacity: 0, scale: 3, turn: -26 });

    // 70 % of the 600 ms landing after the 200 ms wait.
    await advance(200 + 420 - 150);
    const pressed = numberPose();
    expect(pressed.opacity).toBeCloseTo(1, 1);
    expect(pressed.scale).toBeCloseTo(0.92, 1);
    expect(pressed.turn).toBeCloseTo(-8, 0);

    await advance(400);
    expect(numberPose()).toEqual({ opacity: 1, scale: 1, turn: -8 });
  });

  it('under Reduce Motion fades the number in at rest, turned as the board', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderScreen();

    await advance(1000);
    expect(numberPose()).toEqual({ opacity: 1, scale: 1, turn: -8 });
  });

  it('draws its Mascot 120 points wide, as the board', async () => {
    await renderScreen(jest.fn(), (width) => <View testID="figure" style={{ width }} />);

    expect(screen.getByTestId('figure')).toHaveStyle({ width: 120 });
  });
});
