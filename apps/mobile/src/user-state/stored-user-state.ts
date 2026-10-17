import { createMemoryUserStatePort, openUserState, type UserState } from '@slovo/core';
import { openDatabaseAsync } from 'expo-sqlite';

import { openOnce } from '../opening';
import { openSqliteUserState } from './user-state-sqlite';

/**
 * The user state lives in its own writable database in the app's documents
 * directory, never in the read-only Language Pack (spec #51).
 */
const DATABASE_NAME = 'user-state.db';

async function openStoredUserState(): Promise<UserState> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL');
  return openUserState({ port: await openSqliteUserState(db) });
}

/**
 * The user state, opened once per app run and shared by every feature. The app
 * still works without it, on the Edition's defaults: choices last until it quits.
 */
export const storedUserState = openOnce(openStoredUserState, {
  onError(error) {
    console.error('Could not open the user state; nothing will be kept', error);
  },
  fallback: () => openUserState({ port: createMemoryUserStatePort() }),
});
