import { createGameHaptics, type GameHaptics } from '@slovo/core';
import { useEffect, useMemo } from 'react';

import { useHaptics } from '../providers/HapticsProvider';
import { systemSchedule } from '../providers/system-schedule';

/**
 * The haptics of the Game's changes (`createGameHaptics`) over the app's
 * haptics and the real clock. Those still to come are dropped when the screen
 * goes away.
 */
export function useGameHaptics(): GameHaptics {
  const haptics = useHaptics();
  const gameHaptics = useMemo(
    () => createGameHaptics({ haptics, schedule: systemSchedule }),
    [haptics],
  );
  useEffect(
    () => () => {
      gameHaptics.stop();
    },
    [gameHaptics],
  );
  return gameHaptics;
}
