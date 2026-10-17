import { openPack, type AppEditions, type PackReader } from '@slovo/language-pack/reader';
import type { SQLiteDatabase } from 'expo-sqlite';

/** The reader of each open Language Pack, by the database it is open over. */
const readers = new WeakMap<SQLiteDatabase, PackReader>();

/**
 * Opens the Language Pack over `db` for the running app, and keeps its reader
 * for every screen. Throws on a pack of another Edition than the app.
 */
export async function openPackOver(db: SQLiteDatabase, app: AppEditions): Promise<void> {
  const opening = await openPack(db, app);
  if (!opening.ok) throw new Error(opening.reason);
  readers.set(db, opening.reader);
}

/**
 * The reader of the Language Pack open over `db`. The Language Pack provider
 * opens it before it draws any screen.
 */
export function openedPack(db: SQLiteDatabase): PackReader {
  const reader = readers.get(db);
  if (reader === undefined) throw new Error('The Language Pack is not open yet');
  return reader;
}
