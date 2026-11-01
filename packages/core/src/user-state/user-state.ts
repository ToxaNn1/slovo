import type { UserStateChanges, UserStatePort } from '../ports';
import type { UserStateMigration } from './user-state-migration';
import type { UserStateRecord, UserStateRecords } from './user-state-record';
import { SCHEMA_VERSION_KEY, userStateMigrations } from '../user-state-schema';

/**
 * The user state at the schema version this Core reads and writes, read and
 * written through the records the Core declares. Only `openUserState` makes
 * one, so no feature ever reads an older schema.
 */
export interface UserState {
  /** The value of the record, if it holds one of its schema. */
  read<T>(record: UserStateRecord<T>): Promise<T | undefined>;
  /**
   * The value of each record of the kind, by id. A record that holds no value
   * of its schema is left out.
   */
  list<T>(records: UserStateRecords<T>): Promise<ReadonlyMap<string, T>>;
  /** Applies every change at once, or none of them. */
  write(changes: UserStateChanges): Promise<void>;
}

/** Thrown when the user state was written by a newer Core than this one. */
export class UserStateTooNewError extends Error {
  override readonly name = 'UserStateTooNewError';
}

/**
 * Opens the user state, bringing an older schema forward one migration at a
 * time. Each step and its version are written at once, so an interrupted
 * upgrade resumes where it stopped. A schema newer than the migrations know
 * is refused and left untouched.
 */
export async function openUserState({
  port,
  migrations = userStateMigrations,
}: {
  port: UserStatePort;
  migrations?: readonly UserStateMigration[];
}): Promise<UserState> {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `User-state migration ${String(index + 1)} has version ${String(migration.version)}`,
      );
    }
  });
  const record = await port.get(SCHEMA_VERSION_KEY);
  const stored = record === undefined ? 0 : Number(record);
  if (!Number.isSafeInteger(stored) || stored < 0) {
    throw new Error(`The user state has an unreadable schema version "${String(record)}".`);
  }
  if (stored > migrations.length) {
    throw new UserStateTooNewError(
      `The user state has schema version ${String(stored)}, but this app knows only up to ${String(migrations.length)}.`,
    );
  }
  for (const migration of migrations.slice(stored)) {
    const changes = await migration.migrate(port);
    await port.write(new Map([...changes, [SCHEMA_VERSION_KEY, String(migration.version)]]));
  }
  return {
    read: async (record) => record.decode(await port.get(record.key)),
    async list<T>(records: UserStateRecords<T>) {
      const values = new Map<string, T>();
      for (const [key, text] of await port.list(records.prefix)) {
        const id = key.slice(records.prefix.length);
        const value = records.record(id).decode(text);
        if (value !== undefined) values.set(id, value);
      }
      return values;
    },
    write: (changes) => port.write(changes),
  };
}

/**
 * A user-state adapter that keeps the records in memory, for tests. Ports
 * opened over the same records see each other's writes, like reopening a
 * database.
 */
export function createMemoryUserStatePort(records = new Map<string, string>()): UserStatePort {
  return {
    get: (key) => Promise.resolve(records.get(key)),
    list: (prefix) =>
      Promise.resolve(new Map([...records].filter(([key]) => key.startsWith(prefix)))),
    write(changes) {
      for (const [key, value] of changes) {
        if (value === undefined) records.delete(key);
        else records.set(key, value);
      }
      return Promise.resolve();
    },
  };
}
