import type { FeatureSwitch } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemorySessionStore,
  openAccount,
  openSync,
  type RecordChange,
  type UserStateChanges,
} from '../index';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
} from '../testing';
import { SYNC_AFTER_WRITE } from './sync';
import { fakeClock, randomOf, testSchedule } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { trackChanges } from '../user-state/tracked-user-state';
import { userStateRecords } from '../user-state/user-state-schema';

const { favorites, syncCursor, syncSyncedAt, theme } = userStateRecords;

const HOUR = 60 * 60_000;

/**
 * One device signed into an Account on a fake backend, with the Edition's
 * `account` and `sync` switches on, unless the test says otherwise.
 */
async function device({
  signedIn = true,
  off = [],
}: { signedIn?: boolean; off?: FeatureSwitch[] } = {}) {
  const time = fakeClock('2026-10-18T09:00:00.000Z');
  const timers = testSchedule(time);
  const server = createFakeBackend({ clock: time.clock });
  /** Whether the backend can be reached by Sync; without it every Sync request gets no answer, and counts. */
  const network = { up: true, unanswered: 0 };
  const unanswered = (): Promise<never> => {
    network.unanswered += 1;
    return Promise.reject(new TypeError('Network request failed'));
  };
  const { push, pull } = server.backend.sync;
  const googleSheet = createFakeGoogleSignInSheet();
  const appleSheet = createFakeAppleSignInSheet();
  const records = new Map<string, string>();
  /** Which writes the device's store refuses: none, unless the test says. */
  const disk = { refuses: (_changes: UserStateChanges) => false };
  const memory = createMemoryUserStatePort(records);
  const userState = trackChanges({
    userState: await openUserState({
      port: {
        ...memory,
        write: (changes) =>
          disk.refuses(changes) ? Promise.reject(new Error('disk full')) : memory.write(changes),
      },
    }),
    clock: time.clock,
  });
  // This install has run before, so the Account keeps the Session it finds.
  await userState.write(userStateRecords.installed.change(true));
  const account = await openAccount({
    backend: server.backend,
    edition: { id: 'uk', isFeatureEnabled: () => false },
    googleSheet,
    appleSheet,
    userState,
    sessions: createMemorySessionStore(
      signedIn ? { token: 'a-session', email: 'anna@mail.com' } : undefined,
    ),
    clock: time.clock,
    schedule: timers.schedule,
    random: randomOf(0.5),
  });
  const switchedOff = new Set<FeatureSwitch>(off);
  const sync = await openSync({
    userState,
    backend: {
      sync: {
        push: (...request: Parameters<typeof push>) =>
          network.up ? push(...request) : unanswered(),
        pull: (...request: Parameters<typeof pull>) =>
          network.up ? pull(...request) : unanswered(),
      },
    },
    account,
    edition: { id: 'uk', isFeatureEnabled: (feature) => !switchedOff.has(feature) },
    clock: time.clock,
    schedule: timers.schedule,
    random: randomOf(0.5),
  });
  let changes = 0;
  sync.onUserStateChange(() => {
    changes += 1;
  });
  return {
    sync,
    server,
    account,
    accountApi: server,
    googleSheet,
    appleSheet,
    userState,
    records,
    time,
    advance: timers.advance,
    switchedOff,
    network,
    disk,
    /** How many times Sync said a pull wrote something. */
    changes: () => changes,
    /** How many syncs reached the backend: each starts with a pull. */
    syncs: () => server.calls.filter((call) => call === 'sync.pull').length,
    /** Pushes the changes as another device of the Account would. */
    pushFromElsewhere: (changes: RecordChange[]) =>
      server.backend.sync.push(
        { editionId: 'uk', changes },
        { context: { token: 'another-session' } },
      ),
    /** Writes a Favorite, as the reader adding one does. */
    addFavorite: (id: string) =>
      userState.write(favorites.record(id).change(time.clock.now().toISOString())),
  };
}

// Spec #378, "The Sync module (Core)": when it syncs.
describe('Sync syncs', () => {
  it('at launch', async () => {
    const { sync, server, addFavorite, advance } = await device();
    await addFavorite('w_one');

    sync.foreground();
    await advance(0);

    expect(server.calls).toEqual(['sync.pull', 'sync.push']);
    expect(server.sync.records.has('favorites.w_one')).toBe(true);
  });

  it('on each return to the foreground', async () => {
    const { sync, server, addFavorite, advance, syncs } = await device();
    sync.foreground();
    await advance(0);
    sync.background();
    await addFavorite('w_one');
    await advance(HOUR);
    expect(syncs()).toBe(1);

    sync.foreground();
    await advance(0);

    expect(syncs()).toBe(2);
    expect(server.sync.records.has('favorites.w_one')).toBe(true);
  });

  it('5 s after the last write while in the foreground, once for a burst of writes', async () => {
    const { sync, server, addFavorite, advance, syncs } = await device();
    sync.foreground();
    await advance(0);

    await addFavorite('w_one');
    await advance(4_000);
    await addFavorite('w_two');
    await advance(4_999);
    expect(syncs()).toBe(1);
    await advance(1);

    expect(syncs()).toBe(2);
    expect([...server.sync.records.keys()]).toEqual(['favorites.w_one', 'favorites.w_two']);
    await advance(HOUR);
    expect(syncs()).toBe(2);
  });

  it('not after a write in the background, nor after one that left no pending change', async () => {
    const { sync, userState, addFavorite, advance, syncs } = await device();
    sync.foreground();
    await advance(0);
    await userState.write(userStateRecords.vibration.change(false));
    await addFavorite('w_one');
    sync.background();
    await advance(HOUR);

    expect(syncs()).toBe(1);
  });

  it('when a Session starts in the foreground', async () => {
    const { sync, account, server, addFavorite, advance, syncs } = await device({
      signedIn: false,
    });
    await addFavorite('w_one');
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(0);

    await account.requestCode('anna@mail.com');
    await account.verifyCode('100001');
    await advance(0);

    expect(syncs()).toBe(1);
    expect(server.sync.records.has('favorites.w_one')).toBe(true);
  });

  it('when a Session starts with Google in the foreground, so the first Google sign-in merges the device’s user state', async () => {
    const { sync, account, googleSheet, server, addFavorite, advance, syncs } = await device({
      signedIn: false,
    });
    await addFavorite('w_one');
    sync.foreground();
    googleSheet.signsIn('anna@mail.com');

    await account.signInWithGoogle();
    await advance(0);

    expect(syncs()).toBe(1);
    expect(server.sync.records.has('favorites.w_one')).toBe(true);
  });

  it('when a Session starts with Apple in the foreground, so the first Apple sign-in merges the device’s user state', async () => {
    const { sync, account, appleSheet, server, addFavorite, advance, syncs } = await device({
      signedIn: false,
    });
    await addFavorite('w_one');
    sync.foreground();
    appleSheet.signsIn('anna@mail.com');

    await account.signInWithApple();
    await advance(0);

    expect(syncs()).toBe(1);
    expect(server.sync.records.has('favorites.w_one')).toBe(true);
  });

  it('not when Apple refuses the token: the device stays signed out and nothing is merged', async () => {
    const { sync, account, appleSheet, server, addFavorite, advance, syncs } = await device({
      signedIn: false,
    });
    await addFavorite('w_one');
    sync.foreground();
    appleSheet.signsIn('anna@mail.com', { expired: true });

    await account.signInWithApple();
    await advance(0);

    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'refused' });
    expect(syncs()).toBe(0);
    expect(server.sync.records.size).toBe(0);
  });
});

describe('Sync syncs nothing', () => {
  it('without a Session', async () => {
    const { sync, addFavorite, advance, syncs } = await device({ signedIn: false });
    sync.foreground();
    await addFavorite('w_one');
    await advance(HOUR);

    expect(syncs()).toBe(0);
    expect(sync.state).toEqual({ syncedAt: undefined, running: false, offline: false });
  });

  it.each(['sync', 'account'] as const)('with `%s` off, read each time', async (feature) => {
    const { sync, switchedOff, addFavorite, advance, syncs } = await device({ off: [feature] });
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(0);

    switchedOff.delete(feature);
    sync.background();
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(1);

    switchedOff.add(feature);
    await addFavorite('w_one');
    await advance(HOUR);
    expect(syncs()).toBe(1);
  });
});

describe('Sync runs one sync at a time', () => {
  it('and one more after it for every moment during it', async () => {
    const { sync, server, addFavorite, advance, syncs } = await device();
    const release = server.hold();
    sync.foreground();
    await advance(0);
    expect(sync.state.running).toBe(true);

    await addFavorite('w_one');
    sync.background();
    sync.foreground();
    sync.background();
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(1);
    release();
    await advance(HOUR);

    expect(syncs()).toBe(2);
    expect(server.sync.records.has('favorites.w_one')).toBe(true);
    expect(sync.state.running).toBe(false);
  });
});

// Spec #378: failures follow ADR 0037's one rule.
describe('Sync tries a sync again', () => {
  it.each(['offline', 'server-error'] as const)(
    'when it fails with `%s`, with backoff and jitter',
    async (reason) => {
      const { sync, server, addFavorite, advance, syncs } = await device();
      await addFavorite('w_one');
      server.failNext({ procedure: 'sync.push', reason });
      sync.foreground();
      await advance(0);
      expect(server.calls).toEqual(['sync.pull', 'sync.push']);

      // The first wait is between half and all of 1 s: 750 ms with a draw of 0.5.
      await advance(749);
      expect(syncs()).toBe(1);
      await advance(1);

      expect(server.calls).toEqual(['sync.pull', 'sync.push', 'sync.pull', 'sync.push']);
      expect(server.sync.records.has('favorites.w_one')).toBe(true);
      expect(sync.state).toMatchObject({ running: false, offline: false });
    },
  );

  it('at most 3 times, and then says it waits for the network', async () => {
    const { sync, network, advance, syncs } = await device();
    network.up = false;
    sync.foreground();
    await advance(HOUR);

    expect(network.unanswered).toBe(4);
    expect(syncs()).toBe(0);
    expect(sync.state).toEqual({ syncedAt: undefined, running: false, offline: true });

    network.up = true;
    sync.background();
    sync.foreground();
    await advance(0);
    expect(sync.state).toMatchObject({ running: false, offline: false });
  });

  it.each(['unexpected', 'not-found', 'too-many-records'] as const)(
    'never when it fails with `%s`',
    async (reason) => {
      const { sync, server, addFavorite, advance } = await device();
      await addFavorite('w_one');
      server.failNext({ procedure: 'sync.push', reason });
      sync.foreground();
      await advance(HOUR);

      expect(server.calls).toEqual(['sync.pull', 'sync.push']);
      expect(sync.state).toEqual({ syncedAt: undefined, running: false, offline: false });
    },
  );
});

describe('Sync, when too many requests', () => {
  it('waits for the Retry-After and syncs then', async () => {
    const { sync, server, advance, syncs } = await device();
    server.failNext({ procedure: 'sync.pull', reason: 'too-many-requests', retryAfter: 60 });
    sync.foreground();
    await advance(59_999);
    expect(syncs()).toBe(1);
    await advance(1);

    expect(syncs()).toBe(2);
    expect(sync.state.syncedAt).toBeDefined();
  });

  it('syncs at no moment sooner', async () => {
    const { sync, server, addFavorite, advance, syncs } = await device();
    server.failNext({ procedure: 'sync.pull', reason: 'too-many-requests', retryAfter: 60 });
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(1);

    await addFavorite('w_one');
    await advance(30_000);
    sync.background();
    sync.foreground();
    await advance(29_999);
    expect(syncs()).toBe(1);
    await advance(1);

    expect(syncs()).toBe(2);
    expect(server.sync.records.has('favorites.w_one')).toBe(true);
  });

  it('syncs at the next moment when the answer says nothing of when', async () => {
    const { sync, server, advance, syncs } = await device();
    server.failNext({ procedure: 'sync.pull', reason: 'too-many-requests' });
    sync.foreground();
    await advance(HOUR);
    expect(syncs()).toBe(1);

    sync.background();
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(2);
  });
});

describe('Sync, when the device fails to write a sync', () => {
  it('stops it quietly and syncs at the next moment', async () => {
    const { sync, pushFromElsewhere, disk, advance, syncs } = await device();
    await pushFromElsewhere([{ key: 'settings.theme', value: 'dark', changedAt: 1 }]);
    disk.refuses = () => true;
    sync.foreground();
    await advance(HOUR);
    expect(syncs()).toBe(1);
    expect(sync.state).toEqual({ syncedAt: undefined, running: false, offline: false });

    disk.refuses = () => false;
    sync.background();
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(2);
    expect(sync.state.syncedAt).toBeDefined();
  });

  it('says the user state may have changed when it fails after a pull wrote', async () => {
    const { sync, pushFromElsewhere, disk, userState, addFavorite, advance, changes } =
      await device();
    await pushFromElsewhere([{ key: 'settings.theme', value: 'dark', changedAt: 1 }]);
    await addFavorite('w_one');
    // The store refuses only the deletion of the pending changes the push sent.
    disk.refuses = (changes) => [...changes.values()].every((value) => value === undefined);
    sync.foreground();
    await advance(0);

    expect(await userState.read(theme)).toBe('dark');
    expect(changes()).toBe(1);
  });
});

// Spec #378: a 401 goes to the Account; signing out keeps the words.
describe('Sync and the end of a Session', () => {
  it('signs out quietly when the backend says the Session has ended, and syncs no more', async () => {
    const { sync, server, account, userState, addFavorite, advance, syncs } = await device();
    sync.foreground();
    await advance(0);
    await addFavorite('w_one');
    server.failNext({ procedure: 'sync.pull', reason: 'unauthorized' });
    await advance(SYNC_AFTER_WRITE);

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(syncs()).toBe(2);
    expect(await userState.cursor()).toBeUndefined();
    expect([...(await userState.pendingChanges()).keys()]).toEqual(['favorites.w_one']);

    await addFavorite('w_two');
    await advance(HOUR);
    expect(syncs()).toBe(2);
  });

  it('forgets the cursor at a sign-out and keeps the pending changes and the words', async () => {
    const { sync, account, userState, records, addFavorite, advance } = await device();
    sync.foreground();
    await advance(0);
    expect(sync.state.syncedAt).toBeDefined();
    expect(await userState.cursor()).toBeDefined();
    await addFavorite('w_one');

    await account.signOut();
    await advance(0);

    expect(await userState.cursor()).toBeUndefined();
    expect([...(await userState.pendingChanges()).keys()]).toEqual(['favorites.w_one']);
    expect(records.has('favorites.w_one')).toBe(true);
    expect(sync.state).toEqual({ syncedAt: undefined, running: false, offline: false });
  });

  it('forgets the cursor and the time of the last sync when the Account is deleted', async () => {
    const { sync, account, userState, addFavorite, advance } = await device();
    sync.foreground();
    await advance(0);
    await addFavorite('w_one');

    await account.delete();
    await advance(0);

    expect(account.state).toMatchObject({ status: 'signed-out' });
    expect(await userState.cursor()).toBeUndefined();
    expect(await userState.read(syncSyncedAt)).toBeUndefined();
    expect([...(await userState.pendingChanges()).keys()]).toEqual(['favorites.w_one']);
  });

  it('tries no more once the Session ends while it waits to try again', async () => {
    const { sync, account, network, advance } = await device();
    network.up = false;
    sync.foreground();
    await advance(0);
    expect(network.unanswered).toBe(1);

    await account.signOut();
    await advance(HOUR);

    expect(network.unanswered).toBe(1);
    expect(sync.state).toEqual({ syncedAt: undefined, running: false, offline: false });
  });

  it('forgets the cursor once a sync running at the sign-out ends', async () => {
    const { sync, server, account, userState, advance, pushFromElsewhere } = await device();
    await pushFromElsewhere([{ key: 'settings.theme', value: 'dark', changedAt: 1 }]);
    const release = server.hold();
    sync.foreground();
    await advance(0);

    await account.signOut();
    release();
    await advance(0);

    expect(await userState.read(theme)).toBe('dark');
    expect(await userState.cursor()).toBeUndefined();
    expect(sync.state).toEqual({ syncedAt: undefined, running: false, offline: false });
  });

  it('forgets a cursor left from a Session that ended before the launch', async () => {
    const records = new Map([[syncCursor.key, '7']]);
    const userState = trackChanges({
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: fakeClock().clock,
    });
    const time = fakeClock();
    await openSync({
      userState,
      backend: createFakeBackend({ clock: time.clock }).backend,
      account: await openAccount({
        backend: createFakeBackend().backend,
        edition: { id: 'uk', isFeatureEnabled: () => false },
        googleSheet: createFakeGoogleSignInSheet(),
        appleSheet: createFakeAppleSignInSheet(),
        sessions: createMemorySessionStore(),
        userState,
        clock: time.clock,
        schedule: testSchedule(time).schedule,
        random: randomOf(0.5),
      }),
      edition: { id: 'uk', isFeatureEnabled: () => true },
      clock: time.clock,
      schedule: testSchedule(time).schedule,
      random: randomOf(0.5),
    });

    expect(await userState.cursor()).toBeUndefined();
  });
});

// Spec #378: the snapshot for the status line, and the changed signal.
describe('Sync says how it went', () => {
  it('while a sync runs, and when the last one went through', async () => {
    const { sync, server, time, advance } = await device();
    const told: unknown[] = [];
    sync.subscribe(() => told.push(sync.state));
    const release = server.hold();

    sync.foreground();
    await advance(0);
    expect(sync.state).toEqual({ syncedAt: undefined, running: true, offline: false });
    time.advance(2_000);
    release();
    await advance(0);

    expect(sync.state).toEqual({
      syncedAt: new Date('2026-10-18T09:00:02.000Z'),
      running: false,
      offline: false,
    });
    expect(told).toEqual([
      { syncedAt: undefined, running: true, offline: false },
      { syncedAt: new Date('2026-10-18T09:00:02.000Z'), running: false, offline: false },
    ]);
  });

  it('when the last sync went through, at the next launch too', async () => {
    const { sync, server, account, userState, time, advance } = await device();
    sync.foreground();
    await advance(0);
    const syncedAt = sync.state.syncedAt;
    expect(syncedAt).toEqual(new Date('2026-10-18T09:00:00.000Z'));

    const relaunched = await openSync({
      userState,
      backend: server.backend,
      account,
      edition: { id: 'uk', isFeatureEnabled: () => true },
      clock: time.clock,
      schedule: testSchedule(time).schedule,
      random: randomOf(0.5),
    });

    expect(relaunched.state).toEqual({ syncedAt, running: false, offline: false });
  });

  it('that the user state changed, once per sync whose pull wrote something', async () => {
    const { sync, pushFromElsewhere, time, addFavorite, advance, changes } = await device();
    sync.foreground();
    await advance(0);
    expect(changes()).toBe(0);

    time.advance(HOUR);
    await pushFromElsewhere([
      {
        key: 'favorites.w_one',
        value: '2026-10-18T10:00:00.000Z',
        changedAt: time.clock.now().getTime(),
      },
      { key: 'settings.theme', value: 'dark', changedAt: time.clock.now().getTime() },
    ]);
    sync.background();
    sync.foreground();
    await advance(0);
    expect(changes()).toBe(1);

    await addFavorite('w_two');
    await advance(SYNC_AFTER_WRITE);
    sync.background();
    sync.foreground();
    await advance(0);
    expect(changes()).toBe(1);
  });

  it('that the user state changed when a sync that wrote something fails after', async () => {
    const { sync, server, addFavorite, advance, changes, pushFromElsewhere } = await device();
    await pushFromElsewhere([{ key: 'settings.theme', value: 'dark', changedAt: 1 }]);
    await addFavorite('w_one');
    server.failNext({ procedure: 'sync.push', reason: 'not-found' });
    sync.foreground();
    await advance(HOUR);

    expect(changes()).toBe(1);
  });
});
