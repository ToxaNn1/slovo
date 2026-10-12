import type { z } from 'zod';

import type { UserStateChanges, UserStatePort } from './ports';

/** The record that holds the schema version of the user state. */
const VERSION_KEY = 'schema.version';

/**
 * The user state at the schema version this Core reads and writes. Only
 * `openUserState` makes one, so no feature ever reads an older schema.
 */
export interface UserState {
  get(key: string): Promise<string | undefined>;
  write(changes: UserStateChanges): Promise<void>;
}

/** A JSON record of the user state, if it holds a value of the schema. */
export async function readRecord<T>(
  userState: Pick<UserState, 'get'>,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | undefined> {
  const record = await userState.get(key);
  if (record === undefined) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(record));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One forward-only step of the user-state schema: the changes that bring the
 * records of the version before up to `version`.
 */
export interface UserStateMigration {
  readonly version: number;
  migrate(state: Pick<UserState, 'get'>): Promise<UserStateChanges>;
}

/**
 * The user-state schema, one step per version. Append a step to change it;
 * never edit or remove one that has shipped.
 */
export const userStateMigrations: readonly UserStateMigration[] = [
  // 0.2: the user settings (Theme, font size). A new store has nothing to bring forward.
  { version: 1, migrate: () => Promise.resolve(new Map()) },
];

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
  const record = await port.get(VERSION_KEY);
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
    await port.write(new Map([...changes, [VERSION_KEY, String(migration.version)]]));
  }
  return { get: (key) => port.get(key), write: (changes) => port.write(changes) };
}

/**
 * A user-state adapter that keeps the records in memory, for tests. Ports
 * opened over the same records see each other's writes, like reopening a
 * database.
 */
export function createMemoryUserStatePort(records = new Map<string, string>()): UserStatePort {
  return {
    get: (key) => Promise.resolve(records.get(key)),
    write(changes) {
      for (const [key, value] of changes) {
        if (value === undefined) records.delete(key);
        else records.set(key, value);
      }
      return Promise.resolve();
    },
  };
}
