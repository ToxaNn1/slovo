import {
  createAnalytics,
  createSettings,
  openComposition,
  openCounterReads,
  openCounterSending,
  openMistakeReports,
  evaluateSwitches,
  openRemoteSwitches,
  type ReaderFacts,
  type AnalyticsPort,
  type AnalyticsSink,
  type Clock,
  type Edition,
  type Random,
  type Schedule,
  type UserSettings,
} from '@slovo/core';
import { createFakeBackend, createMemoryContentPort, seedUserState } from '@slovo/core/testing';

import type { FeatureSwitch } from '@slovo/contracts';

import { edition } from '../edition/edition';
import { openOnce, type Opening } from '../opening';
import type { EditionSwitches, OpenedSettings, Shell } from '../shell-value';

// Helpers the Jest tests share to draw a route under `ShellProvider`. No screen or module of the app imports them.

/** A backend that answers nothing, as when offline. */
function unreachableBackend() {
  const fake = createFakeBackend();
  fake.online = false;
  return fake.backend;
}

/** An opening already open with `value`, as a screen under its gate reads it. */
export function opened<T>(value: T): Opening<T> {
  return {
    state: { status: 'ready', value },
    opened: () => Promise.resolve(value),
    reopen: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };
}

/**
 * The Feature Switches of the Games boards (spec #1674). A test of the Game tab
 * starts with each of them off and turns on the ones it needs, so it does not
 * hang on whether the UA Edition ships them.
 */
export const GAMES_BOARD_SWITCHES: readonly FeatureSwitch[] = [
  'crossingCrossword',
  'crosswordHint',
  'crosswordSolveTime',
  'crosswordSolvedScreen',
  'crosswordBadgeStamp',
  'gameAnswerCard',
  'letterTiles',
  'survivalStreak',
  'finishPoster',
];

/**
 * The remote Feature Switches already open, with the Edition in effect as
 * `edition` has it, for a screen drawn under the Language Pack's gate, so a
 * test says which switches are on by the Edition it loads.
 */
export function switchedTo(edition: Edition): Opening<EditionSwitches> {
  return opened(switchesOf(edition));
}

/** The remote Feature Switches of the test device, with no Rule, as `edition` has them. */
function switchesOf(edition: Edition): EditionSwitches {
  return {
    edition,
    verdicts: evaluateSwitches({
      rules: [],
      states: edition.featureSwitches,
      facts: { ...testReader, clock, clockOffsetMs: 0 },
    }),
    installId: TEST_INSTALL_ID,
    minimums: {},
    subscribe: () => () => undefined,
    ask: () => Promise.resolve(false),
    start: () => () => undefined,
  };
}

/** Analytics into `port` from the test device, with no Rule, so no Variant. */
export const analyticsInto = (port: AnalyticsPort): AnalyticsSink => ({
  port,
  switches: switchesOf(edition),
});

/** An Analytics port a test reads: the events the Core sent it, and whether it was told to stop. */
export interface RecordedAnalytics {
  readonly port: AnalyticsPort;
  /** The events the Core sent, in order, each with its properties. */
  readonly events: readonly { readonly event: string; readonly properties: unknown }[];
  /** Whether the Core told the port sharing was turned off. */
  stopped(): boolean;
}

/** An Analytics port that keeps what the Core sends it, in place of PostHog. */
export function recordedAnalytics(): RecordedAnalytics {
  const events: { event: string; properties: unknown }[] = [];
  let stopped = false;
  return {
    port: {
      track: (event, properties) => void events.push({ event, properties }),
      stop: () => {
        stopped = true;
      },
    },
    events,
    stopped: () => stopped,
  };
}

/**
 * The settings already open over a user state of their own, at the Edition's
 * defaults with `changes`, for a screen drawn under `SettingsProvider`; what
 * the screen changes, `settings.read()` gives back. With `analytics`, a
 * changed setting is told to that port through the Core's gate, as on the device.
 */
export async function settingsAt(
  changes: Partial<UserSettings> = {},
  analytics?: AnalyticsPort,
): Promise<Opening<OpenedSettings>> {
  const userState = await seedUserState();
  const settings = createSettings({
    userState,
    defaults: edition.userSettingDefaults,
    ...(analytics === undefined
      ? {}
      : {
          analytics: createAnalytics({ edition, userState, sink: analyticsInto(analytics) }),
        }),
  });
  return opened({ settings, current: await settings.update(changes) });
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

/** The Install id of the test device, which the Analytics events carry. */
export const TEST_INSTALL_ID = 'test-install';

/** A reader of 1.0.0 on iOS, signed out, with no region: one no targeted Rule matches. */
const testReader: ReaderFacts = {
  appVersion: '1.0.0',
  platform: 'ios',
  region: undefined,
  signedIn: false,
  installId: TEST_INSTALL_ID,
};

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
    overrides.userState ?? openOnce(() => seedUserState({}, { clock }), { onError });
  const remoteSwitches =
    overrides.remoteSwitches ??
    openOnce(
      async () =>
        openRemoteSwitches({
          edition,
          states: edition.featureSwitches,
          facts: () => testReader,
          backend: unreachableBackend(),
          userState: await userState.opened(),
          schedule: never,
          random,
          clock,
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
          backend: createFakeBackend().backend,
          edition: (await remoteSwitches.opened()).edition,
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
          edition: (await remoteSwitches.opened()).edition,
          backend: createFakeBackend().backend,
          userState: await userState.opened(),
          clock,
        }),
      { onError },
    ),
    counterSending: openOnce(
      async () =>
        openCounterSending({
          edition: (await remoteSwitches.opened()).edition,
          backend: createFakeBackend().backend,
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
