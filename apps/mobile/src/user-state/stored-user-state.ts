import { createMemoryUserStatePort, openUserState, type UserState } from '@slovo/core';
import { openDatabaseAsync } from 'expo-sqlite';

import { openSqliteUserState } from './user-state-sqlite';

/**
 * The user state lives in its own writable database in the app's documents
 * directory, never in the read-only Language Pack (spec #51).
 */
const DATABASE_NAME = 'user-state.db';

async function openStoredUserState(): Promise<UserState> {
  try {
    const db = await openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL');
    return await openUserState({ port: await openSqliteUserState(db) });
  } catch (error) {
    // The app still works on the Edition's defaults; choices last until it quits.
    console.error('Could not open the user state; nothing will be kept', error);
    return openUserState({ port: createMemoryUserStatePort() });
  }
}

let opening: Promise<UserState> | undefined;

/** The user state, opened once per app run and shared by every feature. */
export function storedUserState(): Promise<UserState> {
  opening ??= openStoredUserState();
  return opening;
}
