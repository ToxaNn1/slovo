import type { Clock } from '@slovo/core';

/**
 * How long a screen takes to open: a push has not settled before this, and a
 * tap that comes sooner opens nothing. A little longer than the stack
 * animation, so a double tap is one tap and a deliberate second one is not lost.
 */
export const SCREEN_SETTLE_MS = 500;

/** The part of the router that opens a screen. */
export interface ScreenRouter {
  push: (href: string) => void;
}

/**
 * Makes the one call that opens a screen from a tap: while a screen it opened
 * has not settled, further taps open nothing, on this row or any other. A
 * clock set back counts as settled, so the taps are never lost for long.
 */
export function createScreenOpener(clock: Clock) {
  let openedAt = Number.NEGATIVE_INFINITY;
  return (router: ScreenRouter, href: string) => {
    const now = clock.now().getTime();
    if (now >= openedAt && now - openedAt < SCREEN_SETTLE_MS) return;
    openedAt = now;
    router.push(href);
  };
}
