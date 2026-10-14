import type { Clock } from '@slovo/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reportForeground } from './foreground-reports';

const MINUTE = 60 * 1000;

/** The device clock in Kyiv, on the test's fake time. */
const clock: Clock = { now: () => new Date(), timeZone: () => 'Europe/Kyiv' };

/** Starts the reports, with the app's return in the test's hands. */
function start() {
  const resume = vi.fn();
  let comeBack: () => void = () => undefined;
  const stopListening = vi.fn();
  const stop = reportForeground({
    resume,
    clock,
    onForeground(listener) {
      comeBack = listener;
      return stopListening;
    },
  });
  return {
    resume,
    comeBack: () => {
      comeBack();
    },
    stop,
    stopListening,
  };
}

describe('the foreground reports', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T23:58:00+03:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports when the next local day starts while the app is open, and each day after', () => {
    const { resume } = start();

    vi.advanceTimersByTime(2 * MINUTE - 1);
    expect(resume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(resume).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(24 * 60 * MINUTE);
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('reports the return to the foreground, and waits for the next local day from then', () => {
    const { resume, comeBack } = start();
    // The app sleeps in the background past midnight, with its timer stopped.
    vi.setSystemTime(new Date('2026-10-15T08:00:00+03:00'));

    comeBack();
    expect(resume).toHaveBeenCalledTimes(1);

    // The old timer is gone: the next report comes at the next midnight.
    vi.advanceTimersByTime(16 * 60 * MINUTE - 1);
    expect(resume).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('reports nothing more once stopped', () => {
    const { resume, stop, stopListening } = start();

    stop();
    vi.advanceTimersByTime(24 * 60 * MINUTE);

    expect(resume).not.toHaveBeenCalled();
    expect(stopListening).toHaveBeenCalledTimes(1);
  });
});
