import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  openAccount,
  openSync,
  systemRandom,
  type Composition,
  type Schedule,
  type Sync,
} from '@slovo/core';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  seedUserState,
} from '@slovo/core/testing';
import { waitFor } from '@testing-library/react-native';
import type { AppStateStatus } from 'react-native';

import { edition } from '../edition/edition';
import { openOnce, type Opening, type OpeningState } from '../opening';
import { listen } from './lifecycle';
import { opened, switchedTo, testShell } from './test-support';

const clock = { now: () => new Date('2026-10-18T09:00:00.000Z'), timeZone: () => 'Europe/Kyiv' };

const schedule: Schedule = (run, delay) => {
  const timer = setTimeout(run, delay);
  return () => {
    clearTimeout(timer);
  };
};

/** The device's app state, in the foreground. */
const appState = {
  currentState: 'active' as AppStateStatus,
  addEventListener: () => ({ remove: () => undefined }),
};

/** The opening, telling `events` when a reopen is asked and when it ends. */
function recorded<T>(name: string, opening: Opening<T>, events: string[]): Opening<T> {
  return {
    get state() {
      return opening.state;
    },
    opened: () => opening.opened(),
    subscribe: (listener) => opening.subscribe(listener),
    async reopen() {
      events.push(`reopen ${name}`);
      await opening.reopen();
      events.push(`${name} reopened`);
    },
  };
}

/**
 * The Shell of an app over one Account's records on a fake backend, which
 * another session changed: the Mix and the Theme. Sync opens once the test
 * lets it (`openSyncModule`), after the launch.
 */
async function app() {
  const server = createFakeBackend({ clock });
  // This install has run before, so the Account keeps the Session it finds.
  const userState = await seedUserState({ installed: true }, { clock });
  const account = await openAccount({
    backend: server.backend,
    edition,
    googleSheet: createFakeGoogleSignInSheet(),
    appleSheet: createFakeAppleSignInSheet(),
    sessions: createMemorySessionStore({ token: 'a-session', email: 'anna@mail.com' }),
    userState,
    clock,
    schedule,
    random: systemRandom,
  });
  const changedAt = clock.now().getTime() + 1_000;
  const elsewhere = { context: { token: 'another-session' } };
  await server.backend.sync.push(
    { editionId: edition.id, changes: [{ key: 'mix.corrections', value: false, changedAt }] },
    elsewhere,
  );
  await server.backend.sync.push(
    { editionId: edition.id, changes: [{ key: 'settings.theme', value: 'dark', changedAt }] },
    elsewhere,
  );
  let openSyncModule!: () => void;
  const syncLet = new Promise<void>((resolve) => {
    openSyncModule = resolve;
  });
  const sync = openOnce<Sync>(
    async () => {
      await syncLet;
      return openSync({
        userState,
        backend: server.backend,
        account,
        edition,
        clock,
        schedule,
        random: systemRandom,
      });
    },
    { onError: () => undefined },
  );
  const events: string[] = [];
  const base = testShell({ userState: opened(userState), sync });
  const shell = {
    ...base,
    settings: recorded('settings', base.settings, events),
    composition: recorded('composition', base.composition, events),
  };
  const widgetWrites: Composition['widget'][] = [];
  const stop = listen(shell, {
    clock,
    appState,
    writeWidgetSnapshot(widget) {
      events.push('write the Widget Snapshot');
      widgetWrites.push(widget);
    },
    spotlight: { replace: () => Promise.resolve() },
  });
  return { shell, events, widgetWrites, openSyncModule, stop };
}

describe('the lifecycle', () => {
  it('reopens the settings and the composition after a sync changed the user state, then writes the Widget Snapshot of the composition reopened', async () => {
    const { shell, events, widgetWrites, openSyncModule, stop } = await app();
    const first = await shell.composition.opened();
    await shell.settings.opened();
    // The launch wrote the Widget Snapshot of the composition opened.
    await waitFor(() => {
      expect(widgetWrites).toEqual([first.widget]);
    });
    events.length = 0;

    openSyncModule();

    await waitFor(() => {
      expect(events).toContain('write the Widget Snapshot');
    });
    expect(events.slice(0, 2)).toEqual(['reopen settings', 'reopen composition']);
    expect(events.slice(2, 4).sort()).toEqual(['composition reopened', 'settings reopened']);
    expect(events.slice(4)).toEqual(['write the Widget Snapshot']);
    const second = await shell.composition.opened();
    expect(second).not.toBe(first);
    expect(second.mix.state.kinds.correction).toBe(false);
    expect((await shell.settings.opened()).current.theme).toBe('dark');
    expect(widgetWrites.at(-1)).toBe(second.widget);
    stop();
  });

  it('logs a Widget Snapshot write that throws after a remote switch changed and the composition reopened', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const base = testShell({
      remoteSwitches: opened({
        ...(await switchedTo(edition).opened()),
        ask: () => Promise.resolve(true),
      }),
    });
    let reopened = false;
    const composition = await base.composition.opened();
    let state: OpeningState<Composition> = { status: 'ready', value: composition };
    const shell = {
      ...base,
      composition: {
        opened: () => Promise.resolve(composition),
        subscribe: () => () => undefined,
        get state() {
          return state;
        },
        reopen() {
          reopened = true;
          // A composition opened anew over the switches.
          state = { status: 'ready', value: composition };
          return Promise.resolve();
        },
      },
    };
    const stop = listen(shell, {
      clock,
      appState,
      writeWidgetSnapshot() {
        if (reopened) throw new Error('No App Group');
      },
      spotlight: { replace: () => Promise.resolve() },
    });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Could not follow the remote Feature Switches',
        expect.any(Error),
      );
    });
    stop();
    consoleError.mockRestore();
  });

  it('asks for the remote Feature Switches every two minutes from launch, reopens the composition when they change, and stops with the app', async () => {
    const asking: string[] = [];
    let changed: () => void = () => undefined;
    const stub = await switchedTo(edition).opened();
    const base = testShell({
      remoteSwitches: opened({
        ...stub,
        start(onChange: () => void) {
          asking.push('start');
          changed = onChange;
          return () => {
            asking.push('stop');
          };
        },
      }),
    });
    const events: string[] = [];
    const shell = { ...base, composition: recorded('composition', base.composition, events) };
    const stop = listen(shell, {
      clock,
      appState,
      writeWidgetSnapshot() {
        events.push('write the Widget Snapshot');
      },
      spotlight: { replace: () => Promise.resolve() },
    });
    await waitFor(() => {
      expect(asking).toEqual(['start']);
    });
    await waitFor(() => {
      expect(events).toContain('write the Widget Snapshot');
    });
    events.length = 0;

    changed();

    await waitFor(() => {
      expect(events).toEqual([
        'reopen composition',
        'composition reopened',
        'write the Widget Snapshot',
      ]);
    });
    stop();
    expect(asking).toEqual(['start', 'stop']);
  });
});
