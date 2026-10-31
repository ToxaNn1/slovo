import { DatabaseSync } from 'node:sqlite';

import type { UserStateDatabase } from './user-state-sqlite';

/** A database of `node:sqlite` as the user state reads it, closed by the test. */
export interface NodeDriver extends UserStateDatabase {
  close(): void;
}

/**
 * Puts `node:sqlite` behind the slice of expo-sqlite the adapter needs, so the
 * suite runs the same adapter code as the app: the database in WAL mode, as
 * the app opens it, and each exclusive transaction on a connection of its own.
 * For tests only.
 */
export function nodeDriver(file: string): NodeDriver {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  return {
    close: () => db.close(),
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
