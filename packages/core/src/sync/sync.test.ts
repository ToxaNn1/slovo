import type { FeatureSwitch } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { createMemorySessionStore, openAccount, openSync } from '../index';
import { type RecordChange, type UserStateChanges } from '../ports';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
} from '../testing';
import { SYNC_AFTER_WRITE } from './sync';
import { switchedOn } from '../edition/edition';
import { fakeClock, randomOf, testSchedule } from '../test-support';
import { signInByCode } from '../fakes/fake-backend';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { trackChanges } from '../user-state/tracked-user-state';
import { userStateRecords } from '../user-state-schema';

const { favorites, syncCursor, syncSyncedAt, theme } = userStateRecords;

const HOUR = 60 * 60_000;
/** The cursor the fake backend answers the first pull with. */
const CURSOR_AFTER_FIRST_PULL = 0;

/**
 * One device signed into an Account on a fake backend, with the Edition's
 * `account` and `sync` switches on, unless the test says otherwise.
 */
async function device({
  signedIn = true,
  off = [],
  left = [],
  refuses = () => false,
}: {
  signedIn?: boolean;
  off?: FeatureSwitch[];
  /** Records an earlier run left on the device. */
  left?: [string, string][];
  /** Which writes the device's store refuses from the launch on. */
  refuses?: (changes: UserStateChanges) => boolean;
} = {}) {
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
  /** The cursor each pull that reached the backend asked the records after. */
  const pulledAfter: (number | undefined)[] = [];
  const googleSheet = createFakeGoogleSignInSheet();
  const appleSheet = createFakeAppleSignInSheet();
  const records = new Map<string, string>(left);
  /** Which writes the device's store refuses, none unless the test says, and what each waits for first. */
  const disk = {
    refuses,
    waits: (_changes: UserStateChanges): Promise<unknown> => Promise.resolve(),
  };
  const memory = createMemoryUserStatePort(records);
  const userState = trackChanges({
    userState: await openUserState({
      port: {
        ...memory,
        write: async (changes) => {
          await disk.waits(changes);
          if (disk.refuses(changes)) throw new Error('disk full');
          await memory.write(changes);
        },
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
    sessions: createMemorySessionStore(signedIn ? await signInByCode(server) : undefined),
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
        pull: (...request: Parameters<typeof pull>) => {
          if (!network.up) return unanswered();
          pulledAfter.push(request[0].after);
          return pull(...request);
        },
      },
    },
    account,
    edition: { id: 'uk', isFeatureEnabled: switchedOn((feature) => !switchedOff.has(feature)) },
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
    pulledAfter,
    /** How many times Sync said a pull wrote something. */
    changes: () => changes,
    /** How many syncs reached the backend: each starts with a pull. */
    syncs: () => server.calls.filter((call) => call === 'sync.pull').length,
    /** Pushes the changes as another device of the Account would. */
    pushFromElsewhere: async (changes: RecordChange[]) => {
      const { token } = await signInByCode(server);
      return server.backend.sync.push({ editionId: 'uk', changes }, { context: { token } });
    },
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

    expect(server.calls.filter((call) => call.startsWith('sync.'))).toEqual([
      'sync.pull',
      'sync.push',
    ]);
    expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
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
    expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
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
    expect([...server.sync.recordsOf('anna@mail.com').keys()]).toEqual([
      'favorites.w_one',
      'favorites.w_two',
    ]);
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
    expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
  });

  it('not before the first return to the foreground', async () => {
    const { addFavorite, advance, syncs } = await device();
    await addFavorite('w_one');
    await advance(HOUR);

    expect(syncs()).toBe(0);
  });

  it('not when a Session starts in the background, but at the next return to the foreground', async () => {
    const { sync, account, server, addFavorite, advance, syncs } = await device({
      signedIn: false,
    });
    await addFavorite('w_one');
    await account.requestCode('anna@mail.com');
    await account.verifyCode('100001');
    await advance(HOUR);
    expect(syncs()).toBe(0);

    sync.foreground();
    await advance(0);

    expect(syncs()).toBe(1);
    expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
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
    expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
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
    expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
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
    expect(server.sync.recordsOf('anna@mail.com').size).toBe(0);
  });
});

describe('Sync syncs nothing', () => {
  it('without a Session, and tells its subscribers nothing', async () => {
    const { sync, addFavorite, advance, syncs } = await device({ signedIn: false });
    let told = 0;
    sync.subscribe(() => {
      told += 1;
    });
    sync.foreground();
    await addFavorite('w_one');
    await advance(HOUR);

    expect(syncs()).toBe(0);
    expect(told).toBe(0);
    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: false,
      refused: undefined,
    });
  });

  it('when the Account changes without a sign-in or a sign-out', async () => {
    const { sync, account, advance, syncs } = await device();
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(1);

    await account.delete();
    await advance(HOUR);

    expect(syncs()).toBe(1);
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

describe('Sync pulls', () => {
  it('each next sync after the cursor the last one kept', async () => {
    const { sync, advance, pulledAfter } = await device();
    sync.foreground();
    await advance(0);
    sync.background();
    sync.foreground();
    await advance(0);

    expect(pulledAfter).toEqual([undefined, CURSOR_AFTER_FIRST_PULL]);
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
    expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
    expect(sync.state.running).toBe(false);
  });
});

// Spec #378: failures follow one rule.
describe('Sync tries a sync again', () => {
  it.each(['offline', 'server-error'] as const)(
    'when it fails with `%s`, with backoff and jitter',
    async (reason) => {
      const { sync, server, addFavorite, advance, syncs } = await device();
      await addFavorite('w_one');
      server.failNext({ procedure: 'sync.push', reason });
      sync.foreground();
      await advance(0);
      expect(server.calls.filter((call) => call.startsWith('sync.'))).toEqual([
        'sync.pull',
        'sync.push',
      ]);

      // The first wait is between half and all of 1 s: 750 ms with a draw of 0.5.
      await advance(749);
      expect(syncs()).toBe(1);
      await advance(1);

      expect(server.calls.filter((call) => call.startsWith('sync.'))).toEqual([
        'sync.pull',
        'sync.push',
        'sync.pull',
        'sync.push',
      ]);
      expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
      expect(sync.state).toMatchObject({ running: false, offline: false, refused: undefined });
    },
  );

  it('at most 3 times, and then says it waits for the network', async () => {
    const { sync, network, advance, syncs } = await device();
    network.up = false;
    sync.foreground();
    await advance(HOUR);

    expect(network.unanswered).toBe(4);
    expect(syncs()).toBe(0);
    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: true,
      refused: undefined,
    });

    network.up = true;
    sync.background();
    sync.foreground();
    await advance(0);
    expect(sync.state).toMatchObject({ running: false, offline: false, refused: undefined });
  });

  it.each(['unexpected', 'not-found', 'too-many-records'] as const)(
    'never when it fails with `%s`',
    async (reason) => {
      const { sync, server, addFavorite, advance } = await device();
      await addFavorite('w_one');
      server.failNext({ procedure: 'sync.push', reason });
      sync.foreground();
      await advance(HOUR);

      expect(server.calls.filter((call) => call.startsWith('sync.'))).toEqual([
        'sync.pull',
        'sync.push',
      ]);
      expect(sync.state).toEqual({
        syncedAt: undefined,
        running: false,
        offline: false,
        refused: reason,
      });
    },
  );

  it('says the Account refused the changes until a sync goes through, and sends them to the next Session', async () => {
    const { sync, server, account, addFavorite, advance } = await device();
    sync.foreground();
    await advance(0);
    expect(sync.state).toMatchObject({ refused: undefined });
    const syncedAt = sync.state.syncedAt;
    await addFavorite('w_one');
    server.failNext({ procedure: 'sync.push', reason: 'too-many-records' });
    await advance(SYNC_AFTER_WRITE);
    expect(sync.state).toEqual({
      syncedAt,
      running: false,
      offline: false,
      refused: 'too-many-records',
    });

    // The next moment pulls, sends the refused batch no more and still says so.
    const before = server.calls.length;
    sync.background();
    sync.foreground();
    await advance(0);
    expect(server.calls.slice(before)).toEqual(['sync.pull']);
    expect(sync.state).toMatchObject({ refused: 'too-many-records' });

    // The Session ends: nothing is refused, and the next Session gets the changes.
    await account.signOut();
    await advance(0);
    expect(sync.state).toMatchObject({ refused: undefined });
    await account.requestCode('borys@mail.com');
    await account.verifyCode(server.account.sentCodes.at(-1)?.code ?? '');
    await advance(0);
    expect(server.sync.recordsOf('borys@mail.com').has('favorites.w_one')).toBe(true);
  });
});

describe('Sync, when too many requests', () => {
  it('waits for the Retry-After and syncs then', async () => {
    const { sync, server, time, advance, syncs } = await device();
    server.failNext({ procedure: 'sync.pull', reason: 'too-many-requests', retryAfter: 60 });
    sync.foreground();
    await advance(59_999);
    expect(syncs()).toBe(1);
    await advance(1);

    expect(syncs()).toBe(2);
    expect(sync.state.syncedAt).toEqual(time.clock.now());
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
    expect(server.sync.recordsOf('anna@mail.com').has('favorites.w_one')).toBe(true);
  });

  it('does not sync when the Retry-After ends in the background', async () => {
    const { sync, server, advance, syncs } = await device();
    server.failNext({ procedure: 'sync.pull', reason: 'too-many-requests', retryAfter: 60 });
    const release = server.hold();
    sync.foreground();
    await advance(0);
    sync.background();
    release();
    await advance(HOUR);

    expect(syncs()).toBe(1);
  });

  it('holds a moment that came during the sync the Retry-After answered', async () => {
    const { sync, server, advance, syncs } = await device();
    server.failNext({ procedure: 'sync.pull', reason: 'too-many-requests', retryAfter: 60 });
    const release = server.hold();
    sync.foreground();
    await advance(0);
    sync.background();
    sync.foreground();
    release();
    await advance(59_999);
    expect(syncs()).toBe(1);
    await advance(1);

    expect(syncs()).toBe(2);
  });

  it('waits for the Retry-After of a later answer after one that said nothing of when', async () => {
    const { sync, server, addFavorite, advance, syncs } = await device();
    server.failNext({ procedure: 'sync.pull', reason: 'too-many-requests' });
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(1);

    server.failNext({ procedure: 'sync.pull', reason: 'too-many-requests', retryAfter: 60 });
    await addFavorite('w_one');
    await advance(SYNC_AFTER_WRITE);
    expect(syncs()).toBe(2);
    await advance(60_000);

    expect(syncs()).toBe(3);
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
    const { sync, pushFromElsewhere, disk, time, advance, syncs } = await device();
    await pushFromElsewhere([{ key: 'settings.theme', value: 'dark', changedAt: 1 }]);
    disk.refuses = () => true;
    sync.foreground();
    await advance(HOUR);
    expect(syncs()).toBe(1);
    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: false,
      refused: undefined,
    });

    disk.refuses = () => false;
    sync.background();
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(2);
    expect(sync.state.syncedAt).toEqual(time.clock.now());
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
    const { sync, account, userState, records, time, addFavorite, advance } = await device();
    sync.foreground();
    await advance(0);
    expect(sync.state.syncedAt).toEqual(time.clock.now());
    expect(await userState.cursor()).toBe(CURSOR_AFTER_FIRST_PULL);
    await addFavorite('w_one');

    await account.signOut();
    await advance(0);

    expect(await userState.cursor()).toBeUndefined();
    expect([...(await userState.pendingChanges()).keys()]).toEqual(['favorites.w_one']);
    expect(records.has('favorites.w_one')).toBe(true);
    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: false,
      refused: undefined,
    });
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
    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: false,
      refused: undefined,
    });
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
    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: false,
      refused: undefined,
    });
  });

  it('says nothing was refused of a Session that ended while its sync ran', async () => {
    const { sync, server, account, addFavorite, advance } = await device();
    await addFavorite('w_one');
    server.failNext({ procedure: 'sync.push', reason: 'unexpected' });
    const release = server.hold();
    sync.foreground();
    await advance(0);

    await account.signOut();
    release();
    await advance(0);

    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: false,
      refused: undefined,
    });
  });

  it('stops running when the Session ends while the time of its sync is kept', async () => {
    const { sync, account, disk, advance } = await device();
    disk.waits = (changes) =>
      changes.get(syncSyncedAt.key) === undefined ? Promise.resolve() : account.signOut();
    sync.foreground();
    await advance(0);

    expect(account.state).toMatchObject({ status: 'signed-out' });
    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: false,
      refused: undefined,
    });
  });

  it('syncs the next Account after a sign-out that left nothing to forget, even when the store refuses to forget', async () => {
    const { sync, account, server, disk, switchedOff, advance, syncs } = await device({
      off: ['sync'],
    });
    sync.foreground();
    await advance(0);
    disk.refuses = (changes) =>
      changes.has(syncCursor.key) && changes.get(syncCursor.key) === undefined;
    await account.signOut();
    await advance(0);

    switchedOff.delete('sync');
    await account.requestCode('borys@mail.com');
    await account.verifyCode(server.account.sentCodes.at(-1)?.code ?? '');
    await advance(0);

    expect(syncs()).toBe(1);
  });

  it('syncs no next Account from a cursor an ended Session left before the launch and the store failed to forget', async () => {
    const forgetting = (changes: UserStateChanges) =>
      changes.has(syncCursor.key) && changes.get(syncCursor.key) === undefined;
    const { sync, account, server, disk, advance, syncs, pulledAfter } = await device({
      signedIn: false,
      left: [[syncCursor.key, '7']],
      refuses: forgetting,
    });
    sync.foreground();
    await account.requestCode('borys@mail.com');
    await account.verifyCode(server.account.sentCodes.at(-1)?.code ?? '');
    await advance(0);
    expect(syncs()).toBe(0);

    disk.refuses = () => false;
    sync.background();
    sync.foreground();
    await advance(0);
    expect(pulledAfter).toEqual([undefined]);
  });

  it('syncs no next Account from the cursor of a Session that failed to be forgotten', async () => {
    const { sync, account, server, userState, disk, advance, syncs, pulledAfter } = await device();
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(1);
    // The store refuses to forget the cursor, and nothing else.
    disk.refuses = (changes) =>
      changes.has(syncCursor.key) && changes.get(syncCursor.key) === undefined;
    await account.signOut();
    await advance(0);
    expect(await userState.cursor()).toBe(CURSOR_AFTER_FIRST_PULL);

    await account.requestCode('borys@mail.com');
    await account.verifyCode(server.account.sentCodes.at(-1)?.code ?? '');
    await advance(0);
    expect(account.state).toMatchObject({ status: 'signed-in', email: 'borys@mail.com' });
    expect(syncs()).toBe(1);

    disk.refuses = () => false;
    sync.background();
    sync.foreground();
    await advance(0);
    expect(syncs()).toBe(2);
    expect(pulledAfter).toEqual([undefined, undefined]);
  });

  it.each([
    ['a cursor', syncCursor.key, '7'],
    ['the time of the last sync', syncSyncedAt.key, JSON.stringify('2026-10-17T09:00:00.000Z')],
  ])('forgets %s left from a Session that ended before the launch', async (_, key, value) => {
    const records = new Map([[key, value]]);
    const userState = trackChanges({
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: fakeClock().clock,
    });
    const time = fakeClock();
    const sync = await openSync({
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

    expect(sync.state.syncedAt).toBeUndefined();
    expect(await userState.cursor()).toBeUndefined();
    expect(await userState.read(syncSyncedAt)).toBeUndefined();
  });

  it('opens signed out even when the store fails to read what an ended Session left', async () => {
    const time = fakeClock();
    const kept = trackChanges({
      userState: await openUserState({ port: createMemoryUserStatePort() }),
      clock: time.clock,
    });
    const userState = {
      ...kept,
      read: () => Promise.reject(new Error('disk unreadable')),
      cursor: () => Promise.reject(new Error('disk unreadable')),
    };

    const sync = await openSync({
      userState,
      backend: createFakeBackend({ clock: time.clock }).backend,
      account: await openAccount({
        backend: createFakeBackend().backend,
        edition: { id: 'uk', isFeatureEnabled: () => false },
        googleSheet: createFakeGoogleSignInSheet(),
        appleSheet: createFakeAppleSignInSheet(),
        sessions: createMemorySessionStore(),
        userState: kept,
        clock: time.clock,
        schedule: testSchedule(time).schedule,
        random: randomOf(0.5),
      }),
      edition: { id: 'uk', isFeatureEnabled: () => true },
      clock: time.clock,
      schedule: testSchedule(time).schedule,
      random: randomOf(0.5),
    });

    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: false,
      offline: false,
      refused: undefined,
    });
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
    expect(sync.state).toEqual({
      syncedAt: undefined,
      running: true,
      offline: false,
      refused: undefined,
    });
    time.advance(2_000);
    release();
    await advance(0);

    expect(sync.state).toEqual({
      syncedAt: new Date('2026-10-18T09:00:02.000Z'),
      running: false,
      offline: false,
      refused: undefined,
    });
    expect(told).toEqual([
      { syncedAt: undefined, running: true, offline: false, refused: undefined },
      {
        syncedAt: new Date('2026-10-18T09:00:02.000Z'),
        running: false,
        offline: false,
        refused: undefined,
      },
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

    expect(relaunched.state).toEqual({
      syncedAt,
      running: false,
      offline: false,
      refused: undefined,
    });
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

  it('brings back no record a later version of the user state dropped', async () => {
    const { sync, pushFromElsewhere, records, advance, changes } = await device();
    await pushFromElsewhere([
      { key: 'mix.rarityFloor', value: 2, changedAt: 1 },
      { key: 'mix.rarityCeiling', value: 4, changedAt: 1 },
      { key: 'settings.theme', value: 'dark', changedAt: 1 },
    ]);

    sync.foreground();
    await advance(0);

    expect(records.get('settings.theme')).toBe(JSON.stringify('dark'));
    expect([...records.keys()].filter((key) => key.startsWith('mix.rarity'))).toEqual([]);
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
