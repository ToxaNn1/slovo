import {
  createMemoryUserStatePort,
  openUserState,
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
      return { open: () => openSqliteUserState(nodeDriver(new DatabaseSync(file))) };
    },
  ],
];

/**
 * Puts `node:sqlite` behind the slice of expo-sqlite the adapter needs, so the
 * suite runs the same adapter code as the app.
 */
function nodeDriver(db: DatabaseSync): UserStateDatabase {
  databases.push(db);
  return {
    execAsync: (sql) => {
      db.exec(sql);
      return Promise.resolve();
    },
    getFirstAsync: <T>(sql: string, params: string[]) =>
      Promise.resolve((db.prepare(sql).get(...params) as T | undefined) ?? null),
    getAllAsync: <T>(sql: string, params: string[]) =>
      Promise.resolve(db.prepare(sql).all(...params) as T[]),
    runAsync: (sql, params) => Promise.resolve(db.prepare(sql).run(...params)),
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
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

  it("opens a new store at the Core's current schema", async () => {
    const store = createStore();
    const state = await openUserState({ port: await store.open() });
    await state.write(new Map([['kept', 'yes']]));

    const port = await store.open();
    await openUserState({ port });
    expect(await port.get('kept')).toBe('yes');
  });
});
