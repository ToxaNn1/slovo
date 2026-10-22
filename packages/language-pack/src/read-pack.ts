import { DatabaseSync, type StatementSync } from 'node:sqlite';

import { createPackReader, type PackDatabase, type PackReader } from './pack-reader';

/** A Language Pack opened read-only in Node, for tests and tooling. */
export interface NodeLanguagePack extends PackReader {
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

export function openLanguagePack(file: string): NodeLanguagePack {
  const db = new DatabaseSync(file, { readOnly: true });
  return {
    ...createPackReader(nodePackDatabase(db)),
    close: () => {
      db.close();
    },
  };
}
