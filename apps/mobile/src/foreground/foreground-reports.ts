import { untilNextLocalDay, type Clock } from '@slovo/core';

import type { Opening } from '../opening';
import type { AppStateSource } from './foreground';

/**
 * What the foreground reports tell a listener: `launch` once its opening is
 * open, `return` each time the app comes back to the foreground, `new-day`
 * when the next local day starts while the app is open, and `background`
 * each time the app goes to the background.
 */
export type ForegroundMoment = 'launch' | 'return' | 'new-day' | 'background';

/** The shell's one report of the app's moments, to every listener. */
export interface ForegroundReports {
  /**
   * Tells `hear` each moment with what `opening` opened: `launch` once it is
   * open, after any retries, and every moment after, with what it reopened
   * once a reopen ends. Nothing is told before: the launch covers it. A
   * reopen is no moment: whoever reopens does what the launch did. Each
   * listener picks the moments it acts on; `hear` must not throw.
   */
  readonly listen: <T>(
    opening: Opening<T>,
    hear: (value: T, moment: ForegroundMoment) => void,
  ) => void;
  /** Stops every report: the timer, the listening to the device and the launches still to come. */
  readonly stop: () => void;
}

/**
 * Reports the app's moments over the device's app state and the clock. A
 * move between two states out of the foreground, such as from inactive to
 * the background, is no return; only the background itself is reported. The
 * timer holds no day rule: one that fires early reports anyway, and the
 * listener finds the same day. Listeners are told in the order their
 * openings opened.
 */
export function reportForeground({
  clock,
  appState,
}: {
  clock: Clock;
  appState: AppStateSource;
}): ForegroundReports {
  const listeners: ((moment: ForegroundMoment) => void)[] = [];
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function tell(moment: ForegroundMoment): void {
    for (const hear of listeners) hear(moment);
  }

  function waitForNextDay(): void {
    clearTimeout(timer);
    timer = setTimeout(() => {
      tell('new-day');
      waitForNextDay();
    }, untilNextLocalDay(clock));
  }

  waitForNextDay();
  let state = appState.currentState;
  const subscription = appState.addEventListener('change', (next) => {
    if (next === state) return;
    state = next;
    if (next === 'active') {
      tell('return');
      // Timers stop in the background, so the foreground starts the wait again.
      waitForNextDay();
    } else if (next === 'background') {
      tell('background');
    }
  });

  return {
    listen(opening, hear) {
      // An opening waits through its failures for a retry, so this never rejects.
      void opening.opened().then((value) => {
        if (stopped) return;
        listeners.push((moment) => {
          // Once open it stays open; a reopen only swaps what it opened.
          const { state } = opening;
          if (state.status === 'ready') hear(state.value, moment);
        });
        hear(value, 'launch');
      });
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      subscription.remove();
      listeners.length = 0;
    },
  };
}
