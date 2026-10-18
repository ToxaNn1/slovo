import { describe, expect, it } from 'vitest';

import {
  createFakeSyncApi,
  createMemoryContentPort,
  createMemoryUserStatePort,
  createSettings,
  createSyncExchange,
  openComposition,
  openUserState,
  trackChanges,
  userStateRecords,
  type UserStateChanges,
} from '../index';
import { fakeClock, randomOf, word } from '../test-support';

const { activeDays, favorites, gameBest, history } = userStateRecords;

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three'), word('w_sea', { categoryId: 'sea' })],
  corrections: [],
});

const edition = {
  id: 'test',
  isFeatureEnabled: () => false,
  languageTraits: { distractorRule: 'same-part-of-speech' as const },
  userSettingDefaults: {
    mix: { categoryIds: ['test', 'sea'], corrections: false },
    notificationTimes: [],
  },
};

/** One Account on a fake backend, and the devices signed into it, on one clock. */
function account(start = '2026-10-18T09:00:00.000Z') {
  const time = fakeClock(start);
  const server = createFakeSyncApi({ clock: time.clock });

  /** A device over its own user state: the records it keeps, as an older app may have left them. */
  async function device(records = new Map<string, string>()) {
    const userState = trackChanges({
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: time.clock,
    });
    const sync = createSyncExchange({ userState, api: server });
    return {
      records,
      userState,
      sync: () => sync.sync('a-session'),
      /** Opens the composition as a launch does, over the user state as it stands. */
      open: () =>
        openComposition({ content, edition, userState, clock: time.clock, random: randomOf(0.25) }),
      settings: createSettings({
        userState,
        defaults: { theme: 'system', fontSize: 'M', vibration: true },
      }),
      write: (changes: UserStateChanges) => userState.write(changes),
    };
  }

  /** Pushes the changes as another device of the Account would, with the clock's time. */
  async function pushFromElsewhere(...changes: { key: string; value: unknown }[]) {
    await server.push(
      'another-session',
      changes.map(({ key, value }) => ({
        key,
        value: value as never,
        changedAt: time.clock.now().getTime(),
      })),
    );
  }

  return { time, server, device, pushFromElsewhere };
}

const HOUR = 60 * 60_000;

// Spec #378, "Applying a pull" and "Pushing": two Cores over one Account.
describe('two devices of one Account', () => {
  it('see a Favorite, a Collection, a Hidden Entry, a Mix change and the Theme made on either', async () => {
    const { device } = account();
    const phone = await device();
    const tablet = await device();
    const app = await phone.open();
    await app.favorites.add('w_one');
    const created = await app.collections.create('Море', 'w_two');
    await app.hide({ kind: 'entry', entryId: 'w_three' });
    await app.mix.takeOut('sea');
    await phone.settings.update({ theme: 'dark' });

    expect(await phone.sync()).toEqual({ ok: true, changed: false });
    expect(await tablet.sync()).toEqual({ ok: true, changed: true });

    const other = await tablet.open();
    expect(other.favorites.has('w_one')).toBe(true);
    expect(other.collections.list.map(({ name }) => name)).toEqual(['Море']);
    if (!created.ok) throw new Error('The Collection was refused');
    expect(other.collections.has(created.collection.id, 'w_two')).toBe(true);
    expect(other.hiddenEntries.has('w_three')).toBe(true);
    expect(other.mix.state.categoryIds).toEqual(['test']);
    expect((await tablet.settings.read()).theme).toBe('dark');
    expect(await tablet.userState.pendingChanges()).toEqual(new Map());
  });

  it('keep a deletion deleted', async () => {
    const { device, server, time } = account();
    const phone = await device();
    const tablet = await device();
    await (await phone.open()).favorites.add('w_one');
    await phone.sync();
    await tablet.sync();
    time.advance(HOUR);

    await (await tablet.open()).favorites.remove('w_one');
    await tablet.sync();
    await phone.sync();
    await phone.sync();

    expect((await phone.open()).favorites.has('w_one')).toBe(false);
    expect(server.records.get('favorites.w_one')?.value).toBeNull();
  });

  it('let an older offline change lose to a newer one', async () => {
    const { device, server, time } = account();
    const phone = await device();
    const tablet = await device();
    await phone.settings.update({ theme: 'dark' });
    time.advance(HOUR);
    await tablet.settings.update({ theme: 'light' });
    await tablet.sync();
    time.advance(HOUR);

    await phone.sync();
    await tablet.sync();

    expect((await phone.settings.read()).theme).toBe('light');
    expect((await tablet.settings.read()).theme).toBe('light');
    expect(server.records.get('settings.theme')?.value).toBe('light');
  });

  it('keep a pending change newer than the Account’s through a pull, and it wins after the push', async () => {
    const { device, server, time } = account();
    const phone = await device();
    const tablet = await device();
    await tablet.settings.update({ theme: 'light' });
    await tablet.sync();
    time.advance(HOUR);
    await phone.settings.update({ theme: 'dark' });

    await phone.sync();
    await tablet.sync();

    expect((await phone.settings.read()).theme).toBe('dark');
    expect((await tablet.settings.read()).theme).toBe('dark');
    expect(server.records.get('settings.theme')).toMatchObject({
      value: 'dark',
      changedAt: new Date('2026-10-18T10:00:00.000Z').getTime(),
    });
  });

  it('keep the Active Days of both, even one deleted elsewhere, so the Streak is the same', async () => {
    const { device, time, pushFromElsewhere } = account('2026-10-16T09:00:00.000Z');
    const phone = await device();
    const tablet = await device();
    await phone.open();
    time.advance(24 * HOUR);
    await tablet.open();
    time.advance(24 * HOUR);
    await phone.sync();
    await tablet.sync();
    await pushFromElsewhere({ key: 'activeDays.2026-10-16', value: null });

    await phone.sync();
    await tablet.sync();

    expect((await phone.open()).progress.state.streak).toBe(3);
    expect((await tablet.open()).progress.state.streak).toBe(3);
    expect([...(await tablet.userState.list(activeDays)).keys()].sort()).toEqual([
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
  });

  it('keep the higher best Game result on both, even when the higher one is older', async () => {
    const { device, server, time } = account();
    const phone = await device();
    const tablet = await device();
    await phone.write(gameBest.change(9));
    time.advance(HOUR);
    await tablet.write(gameBest.change(5));
    await tablet.sync();
    time.advance(HOUR);

    expect(await phone.sync()).toEqual({ ok: true, changed: false });
    await tablet.sync();

    expect(await phone.userState.read(gameBest)).toBe(9);
    expect(await tablet.userState.read(gameBest)).toBe(9);
    // The phone wrote its result again, so it won on the server with a new change time.
    expect(server.records.get('game.best')).toMatchObject({
      value: 9,
      changedAt: new Date('2026-10-18T11:00:00.000Z').getTime(),
    });
  });

  it('keep the higher best Game result when the Account’s is higher', async () => {
    const { device, time } = account();
    const phone = await device();
    const tablet = await device();
    await phone.write(gameBest.change(12));
    await phone.sync();
    time.advance(HOUR);
    await tablet.write(gameBest.change(4));

    await tablet.sync();
    await phone.sync();

    expect(await tablet.userState.read(gameBest)).toBe(12);
    expect(await phone.userState.read(gameBest)).toBe(12);
  });

  it('leave `device-only` records on each device, also those the Account holds', async () => {
    const { device, server, pushFromElsewhere } = account();
    const phone = await device();
    const tablet = await device();
    await phone.settings.update({ vibration: false });
    await (await phone.open()).notifications.setSound(false);
    await phone.sync();
    await pushFromElsewhere(
      { key: 'settings.vibration', value: false },
      { key: 'sync.cursor', value: 999 },
      { key: 'sync.pending.favorites.w_one', value: { changedAt: 0, value: null } },
      { key: 'schema.version', value: 99 },
    );

    await tablet.sync();

    expect(server.records.has('notifications.sound')).toBe(false);
    expect((await tablet.settings.read()).vibration).toBe(true);
    expect(tablet.records.get('schema.version')).toBe('4');
    expect(await tablet.userState.pendingChanges()).toEqual(new Map());
    expect(await tablet.userState.cursor()).not.toBe(999);
  });

  it('keep a record of a key it doesn’t know as it is, and never push it back', async () => {
    const { device, server, pushFromElsewhere } = account();
    const tablet = await device();
    await pushFromElsewhere({ key: 'badges.firstWeek', value: { level: 2, at: [1, 2] } });

    await tablet.sync();
    await tablet.sync();

    expect(JSON.parse(tablet.records.get('badges.firstWeek') ?? 'null')).toEqual({
      level: 2,
      at: [1, 2],
    });
    expect(await tablet.userState.pendingChanges()).toEqual(new Map());
    expect(server.records.get('badges.firstWeek')?.sequence).toBe(1);
  });

  it('report a change only when a pull wrote something', async () => {
    const { device } = account();
    const phone = await device();
    const tablet = await device();
    await (await phone.open()).favorites.add('w_one');

    expect(await phone.sync()).toEqual({ ok: true, changed: false });
    // The pull brings back what the phone pushed, which changes nothing.
    expect(await phone.sync()).toEqual({ ok: true, changed: false });
    expect(await tablet.sync()).toEqual({ ok: true, changed: true });
    expect(await tablet.sync()).toEqual({ ok: true, changed: false });
  });

  it('read a value whose object keys come back in another order as the same', async () => {
    const { device, time, pushFromElsewhere } = account();
    const phone = await device();
    await phone.write(
      history.record('w_one').change({ seenAt: '2026-10-18T08:00:00.000Z', wordOfTheDay: false }),
    );
    await phone.sync();
    time.advance(HOUR);
    await pushFromElsewhere({
      key: 'history.w_one',
      value: { wordOfTheDay: false, seenAt: '2026-10-18T08:00:00.000Z' },
    });

    expect(await phone.sync()).toEqual({ ok: true, changed: false });
  });
});

// Spec #378, "The first sign-in rule": a sync without a cursor.
describe('the first sign-in', () => {
  /** The user state an 0.7 app left: schema version 3, nothing tracked. */
  const from07 = (records: Record<string, unknown>) =>
    new Map([
      ['schema.version', '3'],
      ...Object.entries(records).map(([key, value]): [string, string] => [
        key,
        JSON.stringify(value),
      ]),
    ]);

  it('lets the Account’s values win over a device’s and adds what the Account lacks', async () => {
    const { device, server } = account();
    const phone = await device();
    await phone.settings.update({ theme: 'dark' });
    await (await phone.open()).favorites.add('w_one');
    await phone.sync();
    const tablet = await device(
      from07({
        'settings.theme': 'light',
        'settings.fontSize': 'L',
        'favorites.w_two': '2026-10-01T08:00:00.000Z',
      }),
    );

    await tablet.sync();
    await phone.sync();

    for (const each of [phone, tablet]) {
      expect(await each.settings.read()).toMatchObject({ theme: 'dark', fontSize: 'L' });
      expect([...(await each.userState.list(favorites)).keys()].sort()).toEqual(['w_one', 'w_two']);
    }
    expect(server.records.get('favorites.w_two')).toMatchObject({ changedAt: 0 });
    expect(server.records.get('settings.theme')?.value).toBe('dark');
  });

  it('keeps the time of the changes made while signed out', async () => {
    const { device, server, time } = account('2026-10-18T08:00:00.000Z');
    const tablet = await device();
    await tablet.settings.update({ fontSize: 'L' });
    time.advance(HOUR);
    const phone = await device();
    await phone.settings.update({ theme: 'dark', fontSize: 'S' });
    await phone.sync();
    time.advance(HOUR);
    await tablet.settings.update({ theme: 'light' });

    await tablet.sync();
    await phone.sync();

    for (const each of [phone, tablet]) {
      expect(await each.settings.read()).toMatchObject({ theme: 'light', fontSize: 'S' });
    }
    expect(server.records.get('settings.theme')?.changedAt).toBe(
      new Date('2026-10-18T10:00:00.000Z').getTime(),
    );
  });

  it('starts again with the rule when a device forgets its cursor', async () => {
    const { device, server } = account();
    const records = new Map<string, string>();
    const phone = await device(records);
    await phone.settings.update({ theme: 'dark' });
    await phone.sync();
    // Signed out and in again: the cursor is forgotten, the words kept.
    records.delete('sync.cursor');
    const kept = server.records.get('settings.theme');

    await phone.sync();

    expect(await phone.userState.pendingChanges()).toEqual(new Map());
    expect(server.records.get('settings.theme')).toEqual(kept);
  });
});

/** An Entry id and the Seen time of a History entry, `minute` minutes after 08:00. */
const seenAt = (minute: number) => new Date(Date.UTC(2026, 9, 18, 8, minute)).toISOString();

describe('History and paging', () => {
  it('trims merged History to the newest 500 on both devices', async () => {
    const { device } = account();
    const phone = await device();
    const tablet = await device();
    const ids = (from: number, to: number, prefix: string) =>
      Array.from({ length: to - from }, (_, index) => `${prefix}${String(from + index)}`);
    // The phone's entries at even minutes, the tablet's at odd ones.
    await phone.write(
      new Map(
        ids(0, 300, 'p_').flatMap((id, index) => [
          ...history.record(id).change({ seenAt: seenAt(2 * index), wordOfTheDay: false }),
        ]),
      ),
    );
    await tablet.write(
      new Map(
        ids(0, 300, 't_').flatMap((id, index) => [
          ...history.record(id).change({ seenAt: seenAt(2 * index + 1), wordOfTheDay: false }),
        ]),
      ),
    );

    await tablet.sync();
    await phone.sync();
    await tablet.sync();

    const newest500 = [...ids(50, 300, 'p_'), ...ids(50, 300, 't_')].sort();
    expect([...(await phone.userState.list(history)).keys()].sort()).toEqual(newest500);
    expect([...(await tablet.userState.list(history)).keys()].sort()).toEqual(newest500);
  });

  it('trims once the whole pull is in, so a newer entry on a later page is kept', async () => {
    const { device, server, time, pushFromElsewhere } = account();
    const phone = await device();
    // The phone's 500 entries; `w_0` is the oldest.
    await phone.write(
      new Map(
        Array.from({ length: 500 }, (_, index) => [
          ...history
            .record(`w_${String(index)}`)
            .change({ seenAt: seenAt(index), wordOfTheDay: false }),
        ]).flat(),
      ),
    );
    await phone.sync();
    time.advance(HOUR);
    // The first page brings 100 newer entries; the second, `w_0` Seen again, newest of all.
    await pushFromElsewhere(
      ...Array.from({ length: 100 }, (_, index) => ({
        key: `history.n_${String(index)}`,
        value: { seenAt: seenAt(600 + index), wordOfTheDay: false },
      })),
      ...Array.from({ length: 400 }, (_, index) => ({
        key: `favorites.f_${String(index)}`,
        value: '2026-10-18T08:00:00.000Z',
      })),
    );
    await pushFromElsewhere({
      key: 'history.w_0',
      value: { seenAt: seenAt(900), wordOfTheDay: false },
    });
    time.advance(HOUR);

    await phone.sync();

    const kept = await phone.userState.list(history);
    expect(kept.size).toBe(500);
    expect(kept.get('w_0')?.seenAt).toBe(seenAt(900));
    expect(server.records.get('history.w_0')?.value).not.toBeNull();
    expect(kept.has('w_100')).toBe(false);
    expect(kept.has('w_101')).toBe(true);
  });

  it('pushes more than 500 changes in batches of 500 and pulls them page by page', async () => {
    const { device, server } = account();
    const phone = await device();
    const tablet = await device();
    await phone.write(
      new Map(
        Array.from({ length: 1_200 }, (_, index) => [
          ...favorites.record(`w_${String(index)}`).change('2026-10-18T08:00:00.000Z'),
        ]).flat(),
      ),
    );

    await phone.sync();
    const phoneCalls = [...server.calls];
    await tablet.sync();

    expect(phoneCalls).toEqual(['pull', 'push', 'push', 'push']);
    expect(server.calls.slice(phoneCalls.length)).toEqual(['pull', 'pull', 'pull']);
    expect((await tablet.userState.list(favorites)).size).toBe(1_200);
    expect(await phone.userState.pendingChanges()).toEqual(new Map());
  });
});

describe('an interrupted sync', () => {
  it('resumes between the pull and the push without loss or duplicates', async () => {
    const { device, server } = account();
    const phone = await device();
    await (await phone.open()).favorites.add('w_one');
    await phone.sync();
    const tablet = await device(
      new Map([
        ['schema.version', '3'],
        ['favorites.w_two', '"2026-10-01T08:00:00.000Z"'],
      ]),
    );
    server.failNext('push', 'offline');

    // The pull wrote the phone's Favorite before the push failed.
    expect(await tablet.sync()).toEqual({ ok: false, reason: 'offline', changed: true });
    expect([...(await tablet.userState.list(favorites)).keys()].sort()).toEqual(['w_one', 'w_two']);
    const kept = server.records.size;

    expect(await tablet.sync()).toEqual({ ok: true, changed: false });
    await phone.sync();

    expect([...(await phone.userState.list(favorites)).keys()].sort()).toEqual(['w_one', 'w_two']);
    // Only the tablet's record joined the Account, once.
    expect(server.records.size).toBe(kept + 1);
    expect(await tablet.userState.pendingChanges()).toEqual(new Map());
  });

  it('writes nothing of a pull that fails, and pushes nothing', async () => {
    const { device, server, pushFromElsewhere } = account();
    const tablet = await device();
    await tablet.settings.update({ theme: 'dark' });
    await pushFromElsewhere({ key: 'favorites.w_one', value: '2026-10-18T08:00:00.000Z' });
    server.failNext('pull', 'server-error');

    expect(await tablet.sync()).toEqual({ ok: false, reason: 'server-error', changed: false });

    expect(server.calls).toEqual(['push', 'pull']);
    expect(await tablet.userState.read(favorites.record('w_one'))).toBeUndefined();
    expect(await tablet.userState.cursor()).toBeUndefined();
    expect([...(await tablet.userState.pendingChanges()).keys()]).toEqual(['settings.theme']);
  });
});

describe('the device’s own rewrites', () => {
  it('track a History entry the trim deletes, so the deletion syncs', async () => {
    const { device, server, time } = account();
    const phone = await device();
    await phone.write(
      new Map(
        Array.from({ length: 500 }, (_, index) => [
          ...history
            .record(`w_${String(index)}`)
            .change({ seenAt: seenAt(index + 1), wordOfTheDay: false }),
        ]).flat(),
      ),
    );
    const tablet = await device();
    await tablet.write(history.record('w_old').change({ seenAt: seenAt(0), wordOfTheDay: false }));
    await tablet.sync();
    time.advance(HOUR);

    await phone.sync();

    expect(await phone.userState.read(history.record('w_old'))).toBeUndefined();
    expect(server.records.get('history.w_old')?.value).toBeNull();
  });
});
