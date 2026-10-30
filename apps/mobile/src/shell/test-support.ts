import {
  createMemoryUserStatePort,
  createSettings,
  openComposition,
  openCounterReads,
  openCounterSending,
  openMistakeReports,
  openRemoteSwitches,
  openUserState,
  trackChanges,
  type Clock,
  type FeatureSwitch,
  type Random,
  type Schedule,
} from '@slovo/core';
import {
  createFakeCountersApi,
  createFakeReportsApi,
  createMemoryContentPort,
} from '@slovo/core/testing';

import { edition } from '../edition/edition';
import { openOnce, type Opening } from '../opening';
import type { Shell } from '../shell-value';

// Helpers the Jest tests share to draw a route under `ShellProvider`. No screen or module of the app imports them.

/** An opening already open with `value`, as a screen under its gate reads it. */
export function opened<T>(value: T): Opening<T> {
  return {
    state: { status: 'ready', value },
    opened: () => Promise.resolve(value),
    reopen: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };
}

/** A random source that gives the same numbers on every run. */
function seeded(seed: number): Random {
  let state = seed;
  return {
    next() {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    },
  };
}

/** A schedule whose timers never fire, so nothing a test did not ask for runs in the background. */
const never: Schedule = () => () => undefined;

const clock: Clock = { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

/**
 * A Shell for a test, so a route renders under `ShellProvider` over the Core
 * itself: each opening the test gives, such as `opened(composition)`, and the
 * rest open on their first read, as on the device, over the Core's fakes, an
 * empty Language Pack, the user state in memory and the Edition as it ships,
 * at a fixed time. No Account, no Sync and no Share Card capture.
 */
export function testShell(overrides: Partial<Shell> = {}): Shell {
  const random = seeded(1);
  const onError = () => undefined;
  const userState =
    overrides.userState ??
    openOnce(
      async () =>
        trackChanges({
          userState: await openUserState({ port: createMemoryUserStatePort() }),
          clock,
        }),
      { onError },
    );
  const remoteSwitches =
    overrides.remoteSwitches ??
    openOnce(
      async () =>
        openRemoteSwitches({
          edition,
          api: { switches: () => Promise.resolve({ ok: false, reason: 'offline' }) },
          userState: await userState.opened(),
          schedule: never,
          random,
        }),
      { onError },
    );
  const languagePack =
    overrides.languagePack ??
    opened({
      reader: {
        ...createMemoryContentPort(),
        metadata: () => Promise.reject(new Error('A test pack has no metadata')),
        crosswordDay: () => Promise.resolve(undefined),
      },
      version: { contentVersion: 1, packFormat: 1 },
      contentUpdate: undefined,
    });
  /** The Edition in effect each time it is asked, as the shell hands it to the modules apart from the composition. */
  const switchedEdition = async () => {
    const switches = await remoteSwitches.opened();
    return {
      id: edition.id,
      isFeatureEnabled: (feature: FeatureSwitch) => switches.edition.isFeatureEnabled(feature),
    };
  };
  return {
    userState,
    settings: openOnce(
      async () => {
        const settings = createSettings({
          userState: await userState.opened(),
          defaults: edition.userSettingDefaults,
        });
        return { settings, current: await settings.read() };
      },
      { onError },
    ),
    remoteSwitches,
    languagePack,
    composition: openOnce(
      async () => {
        const content = (await languagePack.opened()).reader;
        return openComposition({
          content,
          crossword: content,
          edition: (await remoteSwitches.opened()).edition,
          userState: await userState.opened(),
          clock,
          random,
          schedule: never,
        });
      },
      { onError },
    ),
    account: undefined,
    sync: undefined,
    mistakeReports: openOnce(
      async () =>
        openMistakeReports({
          userState: await userState.opened(),
          api: createFakeReportsApi(),
          edition: await switchedEdition(),
          appVersion: 'test',
          contentVersion: (await languagePack.opened()).version.contentVersion,
          clock,
          schedule: never,
          random,
        }),
      { onError },
    ),
    counterReads: openOnce(
      async () =>
        openCounterReads({
          edition: await switchedEdition(),
          api: createFakeCountersApi(),
          userState: await userState.opened(),
          clock,
        }),
      { onError },
    ),
    counterSending: openOnce(
      async () =>
        openCounterSending({
          edition: await switchedEdition(),
          api: createFakeCountersApi(),
          userState: await userState.opened(),
          clock,
          schedule: never,
          random,
        }),
      { onError },
    ),
    shareCard: undefined,
    ...overrides,
  };
}
