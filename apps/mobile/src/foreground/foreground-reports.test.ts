import type { Clock } from '@slovo/core';
import type { AppStateStatus } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openOnce } from '../opening';
import { reportForeground, type ForegroundMoment } from './foreground-reports';

const MINUTE = 60 * 1000;

/** The device clock in Kyiv, on the test's fake time. */
const clock: Clock = { now: () => new Date(), timeZone: () => 'Europe/Kyiv' };

/** The device's app state, moved by the test, counting its listeners. */
function fakeAppState(start: AppStateStatus = 'active') {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const source = {
    currentState: start,
    addEventListener(_type: 'change', listener: (state: AppStateStatus) => void) {
      listeners.add(listener);
      return {
        remove() {
          listeners.delete(listener);
        },
      };
    },
  };
  return {
    source,
    listeners,
    change(state: AppStateStatus) {
      source.currentState = state;
      for (const listener of Array.from(listeners)) listener(state);
    },
  };
}

/** An opening the test opens, or fails, when it chooses, once a listener started it. */
function heldOpening<T>(value: T) {
  let open: (() => void) | undefined;
  let fail: (() => void) | undefined;
  const opening = openOnce(
    () =>
      new Promise<T>((resolve, reject) => {
        open = () => {
          resolve(value);
        };
        fail = () => {
          reject(new Error('could not open'));
        };
      }),
    { onError: () => undefined },
  );
  return {
    opening,
    open: async () => {
      open?.();
      await settled();
    },
    fail: async () => {
      fail?.();
      await settled();
    },
  };
}

/** Lets every pending opening finish. */
const settled = () => vi.advanceTimersByTimeAsync(0);

/** Starts the reports with one listener over an open opening, collecting what it hears. */
async function start(appState = fakeAppState()) {
  const reports = reportForeground({ clock, appState: appState.source });
  const heard: ForegroundMoment[] = [];
  reports.listen(
    openOnce(() => Promise.resolve('value'), { onError: () => undefined }),
    (_, moment) => heard.push(moment),
  );
  await settled();
  return { reports, heard, appState };
}

describe('the foreground reports', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T23:58:00+03:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tells a listener the launch once its opening is open, with what it opened, and nothing before', async () => {
    const appState = fakeAppState();
    const reports = reportForeground({ clock, appState: appState.source });
    const account = heldOpening('the Account');
    const heard: string[] = [];
    reports.listen(account.opening, (value, moment) => heard.push(`${moment}: ${value}`));

    appState.change('background');
    appState.change('active');
    await settled();
    expect(heard).toEqual([]);

    await account.open();
    appState.change('background');

    expect(heard).toEqual(['launch: the Account', 'background: the Account']);
  });

  it('tells the launch after a retry opens an opening that failed', async () => {
    const reports = reportForeground({ clock, appState: fakeAppState().source });
    const composition = heldOpening('the composition');
    const heard: string[] = [];
    reports.listen(composition.opening, (value, moment) => heard.push(`${moment}: ${value}`));

    await composition.fail();
    expect(heard).toEqual([]);
    const { state } = composition.opening;
    if (state.status === 'failed') state.retry();
    await composition.open();

    expect(heard).toEqual(['launch: the composition']);
  });

  it('tells each return to the foreground and each move to the background', async () => {
    const { heard, appState } = await start();

    appState.change('inactive');
    appState.change('background');
    appState.change('active');
    // The control centre, pulled down and put back.
    appState.change('inactive');
    appState.change('active');

    expect(heard).toEqual(['launch', 'background', 'return', 'return']);
  });

  it('tells the first move to the foreground of an app that launched out of it as a return', async () => {
    const { heard, appState } = await start(fakeAppState('unknown'));

    appState.change('active');
    appState.change('active');

    expect(heard).toEqual(['launch', 'return']);
  });

  it('tells every listener, in the order their openings opened, each with what its own opened', async () => {
    const appState = fakeAppState();
    const reports = reportForeground({ clock, appState: appState.source });
    const heard: string[] = [];
    reports.listen(
      openOnce(() => Promise.resolve('first'), { onError: () => undefined }),
      (value, moment) => heard.push(`${moment}: ${value}`),
    );
    reports.listen(
      openOnce(() => Promise.resolve(2), { onError: () => undefined }),
      (value, moment) => heard.push(`${moment}: ${String(value + 1)}`),
    );
    await settled();
    heard.length = 0;

    appState.change('background');

    expect(heard).toEqual(['background: first', 'background: 3']);
  });

  it('tells each moment after a reopen with what the opening reopened', async () => {
    const appState = fakeAppState();
    const reports = reportForeground({ clock, appState: appState.source });
    const values = ['the composition', 'the reopened composition'];
    const opening = openOnce(() => Promise.resolve(values.shift()), { onError: () => undefined });
    const heard: string[] = [];
    reports.listen(opening, (value, moment) => heard.push(`${moment}: ${String(value)}`));
    await settled();

    await opening.reopen();
    appState.change('background');

    // A reopen is no launch: the caller that reopens does what the launch did.
    expect(heard).toEqual(['launch: the composition', 'background: the reopened composition']);
  });

  it('tells when the next local day starts while the app is open, and each day after', async () => {
    const { heard } = await start();
    heard.length = 0;

    await vi.advanceTimersByTimeAsync(2 * MINUTE - 1);
    expect(heard).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(heard).toEqual(['new-day']);

    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);
    expect(heard).toEqual(['new-day', 'new-day']);
  });

  it('waits for the next local day from the return to the foreground', async () => {
    const { heard, appState } = await start();
    appState.change('background');
    // The app sleeps in the background past midnight, with its timer stopped.
    vi.setSystemTime(new Date('2026-10-15T08:00:00+03:00'));
    appState.change('active');
    heard.length = 0;

    // The old timer is gone: the next report comes at the next midnight.
    await vi.advanceTimersByTimeAsync(16 * 60 * MINUTE - 1);
    expect(heard).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(heard).toEqual(['new-day']);
  });

  it('tells nothing more once stopped, also to a listener whose opening opens later', async () => {
    const { reports, heard, appState } = await start();
    const late = heldOpening('late');
    const heardLate: ForegroundMoment[] = [];
    reports.listen(late.opening, (_, moment) => heardLate.push(moment));
    heard.length = 0;

    reports.stop();
    await late.open();
    appState.change('background');
    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);

    expect(heard).toEqual([]);
    expect(heardLate).toEqual([]);
    expect(appState.listeners.size).toBe(0);
  });
});
