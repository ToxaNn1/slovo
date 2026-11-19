import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { systemSchedule } from '@slovo/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
// First, so its mocks stand before the screen loads.
import {
  composition,
  editionInEffect,
  open,
  resetGameScreen,
} from './test-support';

import GameScreen from '../app/game';
import { CELEBRATION_MS, MascotCelebrations } from '../mascot/mascot';
import { renderApp } from '../shell/test-app';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';

// Owner check 15.11, item 25: a Badge's toast hid the answer banner's «Влучив!».

const hidden = { includeHiddenElements: true };

/** Moves the faked time on by `ms` milliseconds. */
async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** The Game screen with the celebrations over it, as the app draws them on a Game's route. */
async function renderGameWithCelebrations() {
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(editionInEffect),
    settings: await settingsAt({}),
  });
  await renderApp(
    <>
      <GameScreen />
      <MascotCelebrations />
    </>,
    { shell },
  );
  await advance(0);
}

describe('a Badge earned in a Game with the answer banner', () => {
  beforeEach(async () => {
    await resetGameScreen();
    jest.useFakeTimers({ now: new Date('2026-10-26T09:00:00Z') });
    await open({
      clock: { now: () => new Date(), timeZone: () => 'Europe/Kyiv' },
      schedule: systemSchedule,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('toasts only once the banner has gone, so the banner’s verdict stays in sight, then goes after a while', async () => {
    await renderGameWithCelebrations();
    await fireEvent.press(screen.getByTestId('game-mode-stress'));
    await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));
    expect(screen.getByTestId('game-answer-banner')).toBeOnTheScreen();

    // A Badge earned while the banner shows.
    await act(async () => {
      composition.xpLog
        .award({ source: 'game-finished', mode: 'stress', right: 10, played: 10 })
        .commit();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByTestId('badge-toast', hidden)).toBeNull();

    await advance(950);
    expect(screen.queryByTestId('game-answer-banner')).toBeNull();
    expect(screen.getByTestId('badge-toast', hidden)).toBeOnTheScreen();

    await advance(CELEBRATION_MS);
    expect(screen.queryByTestId('badge-toast', hidden)).toBeNull();
  });
});
