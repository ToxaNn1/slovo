import { afterEach, describe, expect, it, jest } from '@jest/globals';
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
        contentVersion: () => 7,
        contentUpdate: undefined,
      }),
  };
});

/** How the remote Feature Switches open in a test: as the Core opens them, or failing, or never. */
let mockRemoteSwitches: 'open' | 'fails' | 'hangs' = 'open';
jest.mock('@slovo/core', () => {
  const core = jest.requireActual<typeof import('@slovo/core')>('@slovo/core');
  return {
    ...core,
    openRemoteSwitches: (...args: Parameters<typeof core.openRemoteSwitches>) => {
      switch (mockRemoteSwitches) {
        case 'open':
          return core.openRemoteSwitches(...args);
        case 'fails':
          return Promise.reject(new Error('The remote Feature Switches failed'));
        case 'hangs':
          return new Promise<never>(() => undefined);
      }
    },
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

/** A user state in memory, which a second Shell opens over as the next launch does. */
const userStateInMemory = () =>
  openOnce(() => seedUserState({}, { clock }), { onError: () => undefined });

/** The Shell of the Edition opened over the Core's fake backend and a user state in memory. */
function shellOverFakes({
  userState = userStateInMemory(),
  rulesNeverAnswer = false,
}: { userState?: ReturnType<typeof userStateInMemory>; rulesNeverAnswer?: boolean } = {}) {
  const fake = createFakeBackend({ clock });
  const shell = createShell(edition.id, {
    backend: rulesNeverAnswer
      ? {
          ...fake.backend,
          edition: { ...fake.backend.edition, switches: () => new Promise<never>(() => undefined) },
        }
      : fake.backend,
    clock,
    schedule: atOnce,
    random,
    userState,
  });
  /** Turns `features` off on the backend, and the Shell asks for the switches as at a return to the foreground. */
  async function turnOffRemotely(...features: FeatureSwitch[]) {
    fake.switches.turnOff(...features);
    await (await shell.remoteSwitches.opened()).ask();
  }
  return { fake, shell, turnOffRemotely };
}

describe('the Shell of the device', () => {
  afterEach(() => {
    mockRemoteSwitches = 'open';
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

  it('opens neither the Account nor Sync while the Account is switched off remotely', async () => {
    const { shell, turnOffRemotely } = shellOverFakes();

    await turnOffRemotely('account');

    await expect(shell.account?.opened()).rejects.toThrow('account');
    await expect(shell.sync?.opened()).rejects.toThrow('sync');
    expect(shell.account?.state.status).toBe('failed');
    expect(shell.sync?.state.status).toBe('failed');
  });

  it('opens the Account and leaves Sync closed while Sync alone is switched off remotely', async () => {
    const { shell, turnOffRemotely } = shellOverFakes();

    await turnOffRemotely('sync');

    expect((await shell.account?.opened())?.state.status).toBe('signed-out');
    await expect(shell.sync?.opened()).rejects.toThrow('sync');
  });

  it('opens the Account and Sync once they are switched back on remotely', async () => {
    const { shell, turnOffRemotely } = shellOverFakes();
    await turnOffRemotely('account');
    await expect(shell.account?.opened()).rejects.toThrow('account');
    await expect(shell.sync?.opened()).rejects.toThrow('sync');

    await turnOffRemotely();

    expect((await shell.account?.opened())?.state.status).toBe('signed-out');
    expect((await shell.sync?.opened())?.state.running).toBe(false);
  });

  it('follows the remote switches once however often the Account is read while switched off', async () => {
    const { shell, turnOffRemotely } = shellOverFakes();
    await turnOffRemotely('account');
    const switches = await shell.remoteSwitches.opened();
    const subscribe = switches.subscribe.bind(switches);
    let following = 0;
    jest.spyOn(switches, 'subscribe').mockImplementation((listener) => {
      following += 1;
      const stop = subscribe(listener);
      return () => {
        following -= 1;
        stop();
      };
    });

    for (const _read of [1, 2, 3]) await expect(shell.account?.opened()).rejects.toThrow('account');

    expect(following).toBe(1);
  });

  it('sends a Mistake Report with the Session of an Account switched back on after the reports opened', async () => {
    const { fake, shell, turnOffRemotely } = shellOverFakes();
    await turnOffRemotely('account');
    const reports = await shell.mistakeReports.opened();

    await turnOffRemotely();
    const account = await shell.account?.opened();
    await account?.requestCode('olena@ukr.net');
    await account?.verifyCode(fake.account.sentCodes[0]?.code ?? '');
    expect(account?.state.status).toBe('signed-in');
    await reports.report({ entryId: 'w_one', type: 'typo', comment: '' });

    expect(fake.reports.sessions).toEqual([expect.any(String)]);
  });

  it('opens by the Rules the device read last when the next launch is offline', async () => {
    const userState = userStateInMemory();
    await shellOverFakes({ userState }).turnOffRemotely('account');

    const { fake, shell } = shellOverFakes({ userState });
    fake.online = false;

    await expect(shell.account?.opened()).rejects.toThrow('account');
    await expect(shell.sync?.opened()).rejects.toThrow('sync');
  });

  it('holds the launch up for no answer when the Rules never answer', async () => {
    const { shell } = shellOverFakes({ rulesNeverAnswer: true });
    // Asked as at launch; the backend never answers.
    void (await shell.remoteSwitches.opened()).ask();

    expect((await shell.account?.opened())?.state.status).toBe('signed-out');
    expect((await shell.sync?.opened())?.state.running).toBe(false);
    expect((await shell.mistakeReports.opened()).available()).toBe(true);
    await expect(shell.counterSending.opened()).resolves.toEqual(
      expect.objectContaining({ foreground: expect.any(Function) }),
    );
  });

  it.each(['fails', 'hangs'] as const)(
    'opens the Account, Sync, Mistake Reports and the Community Counters when the remote Feature Switches %s',
    async (opening) => {
      mockRemoteSwitches = opening;
      const { shell } = shellOverFakes();

      const account = await shell.account?.opened();
      expect(account?.state.status).toBe('signed-out');
      const sync = await shell.sync?.opened();
      expect(sync?.state.running).toBe(false);
      const reports = await shell.mistakeReports.opened();
      expect(reports.available()).toBe(true);
      await expect(shell.counterSending.opened()).resolves.toEqual(
        expect.objectContaining({ foreground: expect.any(Function) }),
      );
    },
  );
});
