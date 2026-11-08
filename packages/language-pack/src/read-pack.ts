import { DatabaseSync, type StatementSync } from 'node:sqlite';

import type { PackWriteDatabase } from './apply-patch';
import { createPackReader, type PackDatabase, type PackReader } from './pack-reader';

/** A Language Pack opened in Node, for tests and tooling; a writable one takes Patches (`applyPatch`). */
export interface NodeLanguagePack extends PackReader {
  readonly writer: PackWriteDatabase;
  close(): void;
}

/** Puts `node:sqlite` behind the driver interface the pack reader expects. */
export function nodePackDatabase(db: DatabaseSync): PackDatabase {
  const statements = new Map<string, StatementSync>();
  function prepare(sql: string): StatementSync {
    let statement = statements.get(sql);
    if (statement === undefined) {
      statement = db.prepare(sql);
      statements.set(sql, statement);
    }
    return statement;
  }
  return {
    getAllAsync: <T>(sql: string, params: (string | number)[]) =>
      Promise.resolve(prepare(sql).all(...params) as T[]),
  };
}

/** Puts `node:sqlite` behind the transaction a Patch is applied in. */
export function nodePackWriter(db: DatabaseSync): PackWriteDatabase {
  return {
    async transaction(run) {
      db.exec('BEGIN');
      try {
        await run({
          getAllAsync: <T>(sql: string, params: (string | number | null)[]) =>
            Promise.resolve(db.prepare(sql).all(...params) as T[]),
          runAsync: (sql, params) => Promise.resolve(db.prepare(sql).run(...params)),
        });
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export function openLanguagePack(
  file: string,
  { writable = false }: { writable?: boolean } = {},
): NodeLanguagePack {
  const db = new DatabaseSync(file, { readOnly: !writable });
  return {
    ...createPackReader(nodePackDatabase(db)),
    writer: nodePackWriter(db),
    close: () => {
      db.close();
    },
  };
}
