import {
  createFakeAccountApi,
  createFakeNotificationScheduler,
  createFakeSyncApi,
  createMemoryContentPort,
  createMemorySessionStore,
  createMemoryUserStatePort,
  createSettings,
  openAccount,
  openComposition,
  openSync,
  openUserState,
  systemRandom,
  trackChanges,
  type Composition,
  type Schedule,
  type Sync,
} from '@slovo/core';
import type { WidgetSnapshot } from '@slovo/contracts';
import type { AppStateStatus } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reportForeground } from '../foreground/foreground-reports';
import { openOnce, type Opening } from '../opening';
import { fakeClock, ukrainian } from '../test-support';
import { reopenAfterSync, syncInBackground } from './background-sync';

const schedule: Schedule = (run, delay) => {
  const timer = setTimeout(run, delay);
  return () => {
    clearTimeout(timer);
  };
};

/** The device's app state, moved by the test. */
function fakeAppState() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const source = {
    currentState: 'active' as AppStateStatus,
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
    change(state: AppStateStatus) {
      source.currentState = state;
      for (const listener of Array.from(listeners)) listener(state);
    },
  };
}

const settled = () => vi.advanceTimersByTimeAsync(0);

/** What an opening holds once it is open, as a screen under its gate reads it. */
async function held<T>(opening: Opening<T>): Promise<T> {
  void opening.opened();
  await settled();
  const { state } = opening;
  if (state.status !== 'ready') throw new Error('The opening is not ready.');
  return state.value;
}

/**
 * An app over one Account's records on a fake backend: the user state, the
 * settings and the composition open as the shell opens them, and Sync opens
 * apart, when the test lets it (`openSyncModule`).
 */
async function app() {
  const time = fakeClock('2026-10-18T09:00:00.000Z');
  const server = createFakeSyncApi({ clock: time.clock });
  const userState = trackChanges({
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: time.clock,
  });
  const account = await openAccount({
    api: createFakeAccountApi(),
    sessions: createMemorySessionStore({ token: 'a-session', email: 'anna@mail.com' }),
    clock: time.clock,
    schedule,
    random: systemRandom,
  });
  const scheduler = createFakeNotificationScheduler();
  const plans: unknown[] = [];
  const replacePlan = scheduler.replacePlan.bind(scheduler);
  scheduler.replacePlan = (plan) => {
    plans.push(plan);
    return replacePlan(plan);
  };
  const composition = openOnce(
    () =>
      openComposition({
        content: createMemoryContentPort(),
        edition: ukrainian,
        userState,
        clock: time.clock,
        random: systemRandom,
        schedule,
        scheduling: { scheduler, ellipsis: '…' },
      }),
    { onError: () => undefined },
  );
  const settings = openOnce(
    async () => {
      const kept = createSettings({ userState, defaults: ukrainian.userSettingDefaults });
      return { kept, current: await kept.read() };
    },
    { onError: () => undefined },
  );
  let openSyncModule!: () => void;
  const opening = new Promise<void>((resolve) => {
    openSyncModule = resolve;
  });
  const syncOpening = openOnce<Sync>(
    async () => {
      await opening;
      return openSync({
        userState,
        api: server,
        account,
        edition: ukrainian,
        clock: time.clock,
        schedule,
        random: systemRandom,
      });
    },
    { onError: () => undefined },
  );
  const widgetWrites: (() => Promise<WidgetSnapshot>)[] = [];
  const appState = fakeAppState();
  const reports = reportForeground({ clock: time.clock, appState: appState.source });
  syncInBackground({
    reports,
    sync: syncOpening,
    reopen: reopenAfterSync({
      settings,
      composition,
      writeWidgetSnapshot: (snapshot) => widgetWrites.push(snapshot),
    }),
  });
  return {
    server,
    composition,
    settings,
    appState,
    reports,
    plans,
    widgetWrites,
    time,
    openSyncModule,
  };
}

const pulls = (server: { calls: readonly string[] }) =>
  server.calls.filter((call) => call === 'pull').length;

describe('the shell syncs in the background', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("doesn't make the launch wait for the Sync module", async () => {
    const { composition, reports, openSyncModule, server } = await app();
    const heard: Composition[] = [];
    reports.listen(composition, (opened) => heard.push(opened));

    await held(composition);

    // The composition is open and has heard the launch while Sync is not yet open.
    expect(heard).toHaveLength(1);
    expect(server.calls).toEqual([]);

    openSyncModule();
    await settled();
    expect(pulls(server)).toBe(1);
    reports.stop();
  });

  it('starts a sync at the launch and at each return to the foreground', async () => {
    const { appState, reports, openSyncModule, server } = await app();
    openSyncModule();
    await settled();
    expect(pulls(server)).toBe(1);

    appState.change('background');
    await settled();
    expect(pulls(server)).toBe(1);
    appState.change('active');
    await settled();

    expect(pulls(server)).toBe(2);
    reports.stop();
  });

  it('reopens the settings and the composition, plans the notifications and writes the Widget Snapshot after a sync changed the user state', async () => {
    const { server, composition, settings, plans, widgetWrites, time, openSyncModule, reports } =
      await app();
    const first = await held(composition);
    await held(settings);
    expect(first.mix.state.corrections).toBe(true);
    const plansBefore = plans.length;
    const changedAt = time.clock.now().getTime() + 1_000;
    await server.push('another-session', [{ key: 'mix.corrections', value: false, changedAt }]);
    await server.push('another-session', [{ key: 'settings.theme', value: 'dark', changedAt }]);

    openSyncModule();
    await settled();

    const second = await held(composition);
    expect(second).not.toBe(first);
    expect(second.mix.state.corrections).toBe(false);
    expect((await held(settings)).current.theme).toBe('dark');
    expect(plans.length).toBeGreaterThan(plansBefore);
    expect(widgetWrites).toHaveLength(1);
    await expect(widgetWrites[0]?.()).resolves.toMatchObject({});
    reports.stop();
  });

  it('leaves the composition as it is after a sync that changed nothing', async () => {
    const { composition, widgetWrites, openSyncModule, reports } = await app();
    const first = await held(composition);

    openSyncModule();
    await settled();

    expect(await held(composition)).toBe(first);
    expect(widgetWrites).toEqual([]);
    reports.stop();
  });

  it('writes no Widget Snapshot when the composition fails to reopen, and keeps the old one', async () => {
    let opens = 0;
    const composition = openOnce(
      () => (++opens === 1 ? Promise.resolve({ opens }) : Promise.reject(new Error('refused'))),
      { onError: () => undefined },
    );
    const first = await held(composition);
    const written: unknown[] = [];

    await reopenAfterSync({
      settings: { reopen: () => Promise.resolve() },
      composition: composition as unknown as Opening<Composition>,
      writeWidgetSnapshot: (snapshot) => written.push(snapshot),
    })();

    expect(written).toEqual([]);
    expect(await held(composition)).toBe(first);
  });
});
