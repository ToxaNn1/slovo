import { openTrackedUserState, type TrackedUserState } from '@slovo/core';
import { openDatabaseAsync } from 'expo-sqlite';

import { deviceClock } from '../device/device-clock';
import { logError } from '../diagnostics/log';
import { openOnce, type Opening } from '../opening';
import { openSqliteUserState, type UserStateDatabase } from './user-state-sqlite';

/** The id of the UA Edition, the one Edition of 0.x, whose reader's store is on the phone. */
const FIRST_EDITION_ID = 'uk';

/** The slice of expo-sqlite that opens a database by name. */
export type OpenDatabase = (name: string) => Promise<UserStateDatabase>;

/**
 * Each Edition's user state lives in its own writable database in the app's
 * documents directory, never in the read-only Language Pack (spec #51), so
 * History, Streak, XP, badges and Review are per Edition (ADR 0065). The UA
 * Edition keeps the database of 0.x, so a reader who updates in place finds
 * all of it as the UA Edition's, with nothing moved.
 */
export function userStateDatabaseName(editionId: string): string {
  return editionId === FIRST_EDITION_ID ? 'user-state.db' : `user-state-${editionId}.db`;
}

async function openStoredUserState(
  editionId: string,
  openDatabase: OpenDatabase,
): Promise<TrackedUserState> {
  const db = await openDatabase(userStateDatabaseName(editionId));
  // Reads go on while a write commits on its own connection.
  await db.execAsync('PRAGMA journal_mode = WAL');
  return openTrackedUserState({ port: await openSqliteUserState(db), clock: deviceClock });
}

/**
 * The user state of the active Edition, opened once per app run, before the settings and the
 * composition, and shared by every feature, so each of their writes is
 * tracked. The app still works without it, on the Edition's defaults: choices
 * last until it quits.
 */
export function storedUserStateOpening(
  editionId: string,
  openDatabase: OpenDatabase = openDatabaseAsync,
): Opening<TrackedUserState> {
  return openOnce(() => openStoredUserState(editionId, openDatabase), {
    onError(error) {
      logError('Could not open the user state; nothing will be kept', error);
    },
    fallback: () => openTrackedUserState({ clock: deviceClock }),
  });
}
