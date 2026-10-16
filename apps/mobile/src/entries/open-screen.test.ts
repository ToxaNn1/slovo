import type { Clock } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { createScreenOpener, SCREEN_SETTLE_MS } from './open-screen';

function setup() {
  let now = new Date('2026-10-15T09:00:00Z').getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  const pushed: string[] = [];
  const router = {
    push: (href: string) => {
      pushed.push(href);
    },
  };
  return {
    open: createScreenOpener(clock),
    router,
    pushed,
    wait: (ms: number) => {
      now += ms;
    },
  };
}

describe('opening a screen from a tap', () => {
  it('opens the screen on a tap', () => {
    const { open, router, pushed } = setup();

    open(router, '/saved/history/a');

    expect(pushed).toEqual(['/saved/history/a']);
  });

  it('ignores a second tap while the screen is still opening', () => {
    const { open, router, pushed, wait } = setup();

    open(router, '/saved/history/a');
    wait(SCREEN_SETTLE_MS - 1);
    open(router, '/saved/history/a');

    expect(pushed).toEqual(['/saved/history/a']);
  });

  it('ignores a tap on another row while the first screen is still opening', () => {
    const { open, router, pushed } = setup();

    open(router, '/saved/history/a');
    open(router, '/saved/history/b');

    expect(pushed).toEqual(['/saved/history/a']);
  });

  it('opens a screen again once the first one has settled', () => {
    const { open, router, pushed, wait } = setup();

    open(router, '/saved/history/a');
    wait(SCREEN_SETTLE_MS);
    open(router, '/settings/about');

    expect(pushed).toEqual(['/saved/history/a', '/settings/about']);
  });

  it('does not extend the wait by the taps it ignored', () => {
    const { open, router, pushed, wait } = setup();

    open(router, '/saved/history/a');
    wait(SCREEN_SETTLE_MS - 1);
    open(router, '/saved/history/a');
    wait(1);
    open(router, '/settings/about');

    expect(pushed).toEqual(['/saved/history/a', '/settings/about']);
  });

  it('is not stuck when the device clock is set back', () => {
    const { open, router, pushed, wait } = setup();

    open(router, '/saved/history/a');
    wait(-60 * 60 * 1000);
    open(router, '/settings/about');

    expect(pushed).toEqual(['/saved/history/a', '/settings/about']);
  });
});
