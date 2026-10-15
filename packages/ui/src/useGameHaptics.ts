import { createGameHaptics, type GameHaptics, type Schedule } from '@slovo/core';
import { useEffect, useMemo } from 'react';

import { useHaptics } from './HapticsProvider';

/** The real clock. */
const schedule: Schedule = (run, delay) => {
  const timer = setTimeout(run, delay);
  return () => {
    clearTimeout(timer);
  };
};

/**
 * The haptics of the Game's changes (`createGameHaptics`) over the app's
 * haptics and the real clock. Those still to come are dropped when the screen
 * goes away.
 */
export function useGameHaptics(): GameHaptics {
  const haptics = useHaptics();
  const gameHaptics = useMemo(() => createGameHaptics({ haptics, schedule }), [haptics]);
  useEffect(
    () => () => {
      gameHaptics.stop();
    },
    [gameHaptics],
  );
  return gameHaptics;
}
