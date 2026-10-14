import { untilNextLocalDay, type ProgressState } from '@slovo/core';
import { StatsPill, StatsSheet } from '@slovo/ui';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useComposed, useModule } from './composition';
import { deviceClock } from './device-clock';

/** The progress, kept up to date; nothing until the composition is open. */
function useProgress(): ProgressState | undefined {
  return useComposed(
    (composition) => composition.progress,
    (progress) => progress.state,
    undefined,
  );
}

/**
 * The Stats pill with the Streak, and the stats sheet it opens, both kept up
 * to date while they show; nothing until the composition is open.
 */
export function StatsPillAndSheet() {
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  if (progress === undefined) return null;
  return (
    <>
      <StatsPill
        streak={progress.streak}
        onPress={() => {
          setOpen(true);
        }}
      />
      <StatsSheet
        visible={open}
        stats={progress}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

/**
 * Keeps today an Active Day while the app runs: it tells the composition when
 * the app returns to the foreground and when a new local day starts while the
 * app is open, so the Streak moves on without a restart. Draws nothing.
 */
export function ActiveDays() {
  const composition = useModule((open) => open);
  useEffect(() => {
    if (composition === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resume = () => {
      composition.resume().catch((error: unknown) => {
        console.error('Could not record today as an Active Day', error);
      });
    };
    // A timer that fires early finds the same day and waits again for the rest.
    function waitForNextDay(): void {
      clearTimeout(timer);
      timer = setTimeout(() => {
        resume();
        waitForNextDay();
      }, untilNextLocalDay(deviceClock));
    }
    waitForNextDay();
    // Timers stop in the background, so the foreground starts the wait again.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      resume();
      waitForNextDay();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [composition]);
  return null;
}
