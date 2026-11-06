import { describe, expect, it, jest } from '@jest/globals';
import type { Clock, FeatureSwitch, Random, Schedule } from '@slovo/core';
import { createFakeBackend, seedUserState } from '@slovo/core/testing';

import { edition } from '../edition/edition';
import { openOnce } from '../opening';
import { createShell } from './app-shell';

// The Language Pack opens from the device's SQLite; this Shell has one already open.
jest.mock('../content-update/language-pack', () => {
  const { opened } = jest.requireActual<typeof import('./test-support')>('./test-support');
  return {
    languagePackOpening: () =>
      opened({
        reader: {},
        version: { contentVersion: 7, packFormat: 1 },
        contentUpdate: undefined,
      }),
  };
});

// The version the build declares, which each Mistake Report carries.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3' } },
}));

const clock: Clock = { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };
/** A schedule that runs each wait at once, so a request and its retries end before the test reads. */
const atOnce: Schedule = (run) => {
  const timer = setTimeout(run, 0);
  return () => {
    clearTimeout(timer);
  };
};
const random: Random = { next: () => 0.5 };

/** The Shell of the Edition opened over the Core's fake backend and a user state in memory. */
function shellOverFakes() {
  const fake = createFakeBackend({ clock });
  const shell = createShell(edition.id, {
    backend: fake.backend,
    clock,
    schedule: atOnce,
    random,
    userState: openOnce(() => seedUserState({}, { clock }), { onError: () => undefined }),
  });
  /** Turns `features` off on the backend, and the Shell asks for the switches as at a return to the foreground. */
  async function turnOffRemotely(...features: FeatureSwitch[]) {
    fake.switches.turnOff(...features);
    await (await shell.remoteSwitches.opened()).ask();
  }
  return { fake, shell, turnOffRemotely };
}

describe('the Shell of the device', () => {
  it('reads the Community Counters from its backend until they are switched off remotely', async () => {
    const { fake, shell, turnOffRemotely } = shellOverFakes();
    const reads = await shell.counterReads.opened();

    await reads.lines(['w_one']);
    expect(fake.counters.asked).toEqual([['w_one']]);

    await turnOffRemotely('communityCounters');
    expect(await reads.lines(['w_two'])).toEqual(new Map());
    expect(fake.counters.asked).toEqual([['w_one']]);
  });

  it('sends a Mistake Report with the content version of its Language Pack until they are switched off remotely', async () => {
    const { fake, shell, turnOffRemotely } = shellOverFakes();
    const reports = await shell.mistakeReports.opened();

    expect(reports.available()).toBe(true);
    await reports.report({ entryId: 'w_one', type: 'typo', comment: 'Наголос' });
    expect(fake.reports.received).toEqual([
      expect.objectContaining({ entryId: 'w_one', appVersion: '1.2.3', contentVersion: 7 }),
    ]);

    await turnOffRemotely('mistakeReports');
    expect(reports.available()).toBe(false);
    expect(await reports.report({ entryId: 'w_two', type: 'typo', comment: '' })).toBe(
      'switched-off',
    );
  });

  it('opens the sending of the Community Counters, the Account and Sync over the same ports', async () => {
    const { shell } = shellOverFakes();

    await expect(shell.counterSending.opened()).resolves.toEqual(
      expect.objectContaining({ foreground: expect.any(Function) }),
    );
    const account = await shell.account?.opened();
    expect(account?.state.status).toBe('signed-out');
    const sync = await shell.sync?.opened();
    expect(sync?.state.running).toBe(false);
  });
});
