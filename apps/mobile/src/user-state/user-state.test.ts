import {
  createMemoryUserStatePort,
  openUserState,
  userStateRecords,
  UserStateTooNewError,
  type UserStateMigration,
  type UserStatePort,
} from '@slovo/core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterAll, describe, expect, it } from 'vitest';

import { openSqliteUserState, type UserStateDatabase } from './user-state-sqlite';

/** A place the user state lives, which can be opened again and again. */
interface Store {
  open(): Promise<UserStatePort>;
}

const adapters: [string, () => Store][] = [
  [
    'in memory',
    () => {
      const records = new Map<string, string>();
      return { open: () => Promise.resolve(createMemoryUserStatePort(records)) };
    },
  ],
  [
    'in SQLite',
    () => {
      const file = join(mkdtempSync(join(tmpdir(), 'slovo-user-state-')), 'user-state.db');
      return { open: () => openSqliteUserState(nodeDriver(file)) };
    },
  ],
];

/**
 * Puts `node:sqlite` behind the slice of expo-sqlite the adapter needs, so the
 * suite runs the same adapter code as the app: the database in WAL mode, as
 * the app opens it, and each exclusive transaction on a connection of its own.
 */
function nodeDriver(file: string): UserStateDatabase {
  const db = new DatabaseSync(file);
  databases.push(db);
  db.exec('PRAGMA journal_mode = WAL');
  return {
    execAsync: (sql) => {
      db.exec(sql);
      return Promise.resolve();
    },
    getFirstAsync: <T>(sql: string, params: string[]) =>
      Promise.resolve((db.prepare(sql).get(...params) as T | undefined) ?? null),
    getAllAsync: <T>(sql: string, params: string[]) =>
      Promise.resolve(db.prepare(sql).all(...params) as T[]),
    async withExclusiveTransactionAsync(task) {
      const txn = new DatabaseSync(file);
      txn.exec('BEGIN');
      try {
        await task({ runAsync: (sql, params) => Promise.resolve(txn.prepare(sql).run(...params)) });
        txn.exec('COMMIT');
      } catch (error) {
        txn.exec('ROLLBACK');
        throw error;
      } finally {
        txn.close();
      }
    },
  };
}

const databases: DatabaseSync[] = [];
afterAll(() => {
  for (const db of databases) db.close();
});

const greet: UserStateMigration = {
  version: 1,
  migrate: () => Promise.resolve(new Map([['greeting', 'hello']])),
};
// Renames a record, so running it twice would show.
const expand: UserStateMigration = {
  version: 2,
  migrate: async ({ get }) =>
    new Map([
      ['greeting', undefined],
      ['message', `${String(await get('greeting'))}, world`],
    ]),
};

// The user-state contract (spec #51, seam 2): every adapter passes this suite.
describe.each(adapters)('the user state %s', (_, createStore) => {
  it('has no record under a key never written', async () => {
    const port = await createStore().open();

    expect(await port.get('missing')).toBeUndefined();
  });

  it('reads back what was written, replaces it and deletes it', async () => {
    const port = await createStore().open();

    await port.write(
      new Map([
        ['a', 'one'],
        ['b', 'two'],
      ]),
    );
    expect([await port.get('a'), await port.get('b')]).toEqual(['one', 'two']);

    await port.write(
      new Map([
        ['a', 'uno'],
        ['b', undefined],
      ]),
    );
    expect([await port.get('a'), await port.get('b')]).toEqual(['uno', undefined]);
  });

  it('keeps the records when it is opened again', async () => {
    const store = createStore();
    await (await store.open()).write(new Map([['kept', 'yes']]));

    expect(await (await store.open()).get('kept')).toBe('yes');
  });

  it('lists every record under a prefix, and only those', async () => {
    const port = await createStore().open();
    await port.write(
      new Map([
        ['favorites.w_1', 'one'],
        ['favorites.w_2', 'two'],
        ['favorites', 'no dot'],
        ['Favorites.w_3', 'other case'],
        ['old.favorites.w_4', 'prefix inside'],
        ['history', 'other kind'],
      ]),
    );

    expect(await port.list('favorites.')).toEqual(
      new Map([
        ['favorites.w_1', 'one'],
        ['favorites.w_2', 'two'],
      ]),
    );
    expect(await port.list('collections.')).toEqual(new Map());
  });

  it('lists what is kept now: a deleted record is gone, a replaced one has its new value', async () => {
    const port = await createStore().open();
    await port.write(
      new Map([
        ['favorites.w_1', 'one'],
        ['favorites.w_2', 'two'],
      ]),
    );
    await port.write(
      new Map([
        ['favorites.w_1', undefined],
        ['favorites.w_2', 'zwei'],
      ]),
    );

    expect(await port.list('favorites.')).toEqual(new Map([['favorites.w_2', 'zwei']]));
  });

  it('reads no character of a prefix as a wildcard', async () => {
    const port = await createStore().open();
    await port.write(
      new Map([
        ['a%b.1', 'percent'],
        ['axb.1', 'x'],
        ['a_b.1', 'underscore'],
        ['ayb.1', 'y'],
      ]),
    );

    expect(await port.list('a%b.')).toEqual(new Map([['a%b.1', 'percent']]));
    expect(await port.list('a_b.')).toEqual(new Map([['a_b.1', 'underscore']]));
  });

  it('applies writes made at the same time in the order they were made', async () => {
    const port = await createStore().open();

    await Promise.all(['1', '2', '3'].map((value) => port.write(new Map([['n', value]]))));

    expect(await port.get('n')).toBe('3');
  });

  it('shows a read made while a write is applied all of the write or none of it', async () => {
    const port = await createStore().open();
    const before = new Map([
      ['pair.a', 'old'],
      ['pair.b', 'old'],
    ]);
    const after = new Map([
      ['pair.a', 'new'],
      ['pair.b', 'new'],
    ]);
    await port.write(before);

    const written = port.write(after);
    const reads: Promise<ReadonlyMap<string, string>>[] = [];
    // A read at each turn of the write, from before its first change to after its last.
    for (let turn = 0; turn < 8; turn++) {
      reads.push(port.list('pair.'));
      await Promise.resolve();
    }
    await written;

    const whole = [Object.fromEntries(before), Object.fromEntries(after)];
    for (const read of await Promise.all(reads))
      expect(whole).toContainEqual(Object.fromEntries(read));
    expect(await port.list('pair.')).toEqual(after);
  });

  it('keeps the 0.4 records, whole lists included, and finds each kind by its prefix', async () => {
    const { activeDays, notificationTimes, notificationSound, notificationPlan } = userStateRecords;
    const { onboardingFinished } = userStateRecords;
    const store = createStore();
    await (
      await store.open()
    ).write(
      new Map([
        ...activeDays.record('2026-10-13').change(true),
        ...activeDays.record('2026-10-14').change(true),
        ...notificationTimes.change(['09:00', '13:00', '19:00']),
        ...notificationSound.change(false),
        ...onboardingFinished.change('2026-10-14T06:30:00.000Z'),
      ]),
    );

    const port = await store.open();
    expect(notificationTimes.decode(await port.get('notifications.times'))).toEqual([
      '09:00',
      '13:00',
      '19:00',
    ]);
    expect(notificationSound.decode(await port.get('notifications.sound'))).toBe(false);
    expect(onboardingFinished.decode(await port.get('onboarding.finished'))).toBe(
      '2026-10-14T06:30:00.000Z',
    );
    expect([...(await port.list(activeDays.prefix)).keys()].sort()).toEqual([
      'activeDays.2026-10-13',
      'activeDays.2026-10-14',
    ]);
    // A prefix that several kinds share still finds them all; the plan's prefix finds neither.
    expect(await port.list('notifications.')).toHaveProperty('size', 2);
    expect(await port.list(notificationPlan.prefix)).toEqual(new Map());
    expect(await port.list('onboarding.')).toHaveProperty('size', 1);
  });

  it('keeps the best Game result when it is opened again', async () => {
    const { gameBest } = userStateRecords;
    const store = createStore();
    await (await store.open()).write(gameBest.change(13));

    expect(gameBest.decode(await (await store.open()).get('game.best'))).toBe(13);
  });

  it('stores an empty list of notification times as a record, so it never reads as absent', async () => {
    const { notificationTimes } = userStateRecords;
    const store = createStore();
    await (await store.open()).write(notificationTimes.change([]));

    expect(notificationTimes.decode(await (await store.open()).get('notifications.times'))).toEqual(
      [],
    );
  });

  it('brings an older schema forward, running each pending migration once and keeping the data', async () => {
    const store = createStore();
    const v1 = await openUserState({ port: await store.open(), migrations: [greet] });
    await v1.write(new Map([['kept', 'yes']]));

    for (let run = 0; run < 2; run++) {
      const port = await store.open();
      await openUserState({ port, migrations: [greet, expand] });
      expect(await port.get('message')).toBe('hello, world');
      expect(await port.get('greeting')).toBeUndefined();
      expect(await port.get('kept')).toBe('yes');
    }
  });

  it('refuses a schema newer than the Core knows, and leaves it untouched', async () => {
    const store = createStore();
    await openUserState({ port: await store.open(), migrations: [greet, expand] });

    await expect(openUserState({ port: await store.open(), migrations: [greet] })).rejects.toThrow(
      UserStateTooNewError,
    );
    const port = await store.open();
    await openUserState({ port, migrations: [greet, expand] });
    expect(await port.get('message')).toBe('hello, world');
  });

  it('brings a 0.7 user state forward: each Seen record holds the id of the current Cycle', async () => {
    const store = createStore();
    await (
      await store.open()
    ).write(
      new Map([
        ['schema.version', '3'],
        ['feed.cycle', '{"id":4,"seed":7}'],
        ['feed.seen.w_1', 'true'],
        ['feed.seen.c_1', 'true'],
      ]),
    );

    await openUserState({ port: await store.open() });

    const port = await store.open();
    expect(await port.list(userStateRecords.seen.prefix)).toEqual(
      new Map([
        ['feed.seen.w_1', '4'],
        ['feed.seen.c_1', '4'],
      ]),
    );
    expect(userStateRecords.schemaVersion.decode(await port.get('schema.version'))).toBe(4);
  });

  it("opens a new store at the Core's current schema", async () => {
    const store = createStore();
    const state = await openUserState({ port: await store.open() });
    await state.write(new Map([['kept', 'yes']]));

    const port = await store.open();
    await openUserState({ port });
    expect(await port.get('kept')).toBe('yes');
  });
});
