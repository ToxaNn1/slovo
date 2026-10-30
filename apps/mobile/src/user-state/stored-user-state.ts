import {
  createMemoryUserStatePort,
  openUserState,
  trackChanges,
  type TrackedUserState,
  type UserStatePort,
} from '@slovo/core';
import { openDatabaseAsync } from 'expo-sqlite';

import { deviceClock } from '../device/device-clock';
import { logError } from '../diagnostics/log';
import { openOnce, type Opening } from '../opening';
import { openSqliteUserState } from './user-state-sqlite';

/**
 * The user state lives in its own writable database in the app's documents
 * directory, never in the read-only Language Pack (spec #51).
 */
const DATABASE_NAME = 'user-state.db';

/** The user state over the port, tracked so each write of a synced record leaves its pending change (spec #378). */
async function openTracked(port: UserStatePort): Promise<TrackedUserState> {
  return trackChanges({ userState: await openUserState({ port }), clock: deviceClock });
}

async function openStoredUserState(): Promise<TrackedUserState> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  // Reads go on while a write commits on its own connection.
  await db.execAsync('PRAGMA journal_mode = WAL');
  return openTracked(await openSqliteUserState(db));
}

/**
 * The user state, opened once per app run, before the settings and the
 * composition, and shared by every feature, so each of their writes is
 * tracked. The app still works without it, on the Edition's defaults: choices
 * last until it quits.
 */
export function storedUserStateOpening(): Opening<TrackedUserState> {
  return openOnce(openStoredUserState, {
    onError(error) {
      logError('Could not open the user state; nothing will be kept', error);
    },
    fallback: () => openTracked(createMemoryUserStatePort()),
  });
}
