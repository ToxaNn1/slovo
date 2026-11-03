import type { Clock } from '@slovo/core';

/**
 * The longest a screen is taken to be opening when it never reports that it
 * has settled. A normal push settles well within it, even on a loaded device;
 * the limit only keeps taps from being lost for good.
 */
export const SCREEN_OPEN_TIMEOUT_MS = 2000;

/** The part of the router that opens a screen. */
export interface ScreenRouter {
  push: (href: string) => void;
}

/**
 * Makes the one call that opens a screen from a tap: while a screen it opened
 * has not settled, further taps open nothing, on this row or any other. The
 * navigator reports `settled` when the transition ends, so the wait follows
 * the device's speed instead of a fixed time. A screen that never reports, or
 * a clock set back, ends the wait after `SCREEN_OPEN_TIMEOUT_MS`.
 */
export function createScreenOpener(clock: Clock) {
  let openedAt: number | undefined;
  return {
    open: (router: ScreenRouter, href: string) => {
      const now = clock.now().getTime();
      if (openedAt !== undefined && now >= openedAt && now - openedAt < SCREEN_OPEN_TIMEOUT_MS) {
        return;
      }
      openedAt = now;
      router.push(href);
    },
    /** The screen last opened has finished its transition. */
    settled: () => {
      openedAt = undefined;
    },
  };
}
