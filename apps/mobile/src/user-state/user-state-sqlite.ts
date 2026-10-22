import type { UserStatePort } from '@slovo/core';

/**
 * The slice of an asynchronous SQLite driver the user state needs.
 * expo-sqlite's database matches it as is; other drivers, such as
 * `node:sqlite` in tests, need a thin wrapper.
 */
export interface UserStateDatabase {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params: string[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: string[]): Promise<T[]>;
  /**
   * Runs `task` in a transaction on a connection of its own, so the reads of
   * this one see none of its changes until it commits.
   */
  withExclusiveTransactionAsync(task: (txn: UserStateTransaction) => Promise<void>): Promise<void>;
}

/** The slice of a transaction's own connection a write needs. */
export interface UserStateTransaction {
  runAsync(sql: string, params: string[]): Promise<unknown>;
}

/**
 * One table of text records by key. The layout never changes: the Core owns
 * the keys and the schema version of what is stored in it.
 */
const LAYOUT = `
CREATE TABLE IF NOT EXISTS records (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
`;

const SQL = {
  get: 'SELECT value FROM records WHERE key = ?',
  // instr, not LIKE: LIKE ignores case and reads % and _ as wildcards.
  list: 'SELECT key, value FROM records WHERE instr(key, ?) = 1',
  set: 'INSERT INTO records (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
  delete: 'DELETE FROM records WHERE key = ?',
};

/**
 * The user-state adapter over a writable SQLite database, apart from the
 * Language Pack. Free of Node and Expo APIs, so the app and the tests run the
 * same code.
 */
export async function openSqliteUserState(db: UserStateDatabase): Promise<UserStatePort> {
  await db.execAsync(LAYOUT);
  // One transaction at a time: a write waits for the one before it. Each
  // runs on its own connection, so a read made meanwhile sees all of it or none.
  let lastWrite: Promise<unknown> = Promise.resolve();

  return {
    async get(key) {
      const row = await db.getFirstAsync<{ value: string }>(SQL.get, [key]);
      return row?.value;
    },
    async list(prefix) {
      const rows = await db.getAllAsync<{ key: string; value: string }>(SQL.list, [prefix]);
      return new Map(rows.map(({ key, value }) => [key, value]));
    },
    write(changes) {
      const write = lastWrite.then(() =>
        db.withExclusiveTransactionAsync(async (txn) => {
          for (const [key, value] of changes) {
            await (value === undefined
              ? txn.runAsync(SQL.delete, [key])
              : txn.runAsync(SQL.set, [key, value]));
          }
        }),
      );
      lastWrite = write.catch(() => undefined);
      return write;
    },
  };
}
