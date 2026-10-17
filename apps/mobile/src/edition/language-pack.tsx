import { createEntries, type Entries } from '@slovo/core';
import { openPack, type PackReader } from '@slovo/language-pack/reader';
import Constants from 'expo-constants';
import { importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import languagePack from 'slovo-edition/language-pack';
import { useMemo } from 'react';

import { edition } from './edition';
import { openOnce, useOpened } from '../opening';

const DATABASE_NAME = 'language-pack.db';

/** The Edition in the app's Expo config (see app.config.ts), if the build reports one. */
function nativeEditionId(): string | undefined {
  const reported: unknown = Constants.expoConfig?.extra?.['edition'];
  if (typeof reported !== 'object' || reported === null || !('id' in reported)) return undefined;
  return typeof reported.id === 'string' ? reported.id : undefined;
}

async function prepare(db: SQLiteDatabase): Promise<PackReader> {
  // expo-sqlite has no read-only open mode; this refuses every write instead.
  await db.execAsync('PRAGMA query_only = ON');
  const opening = await openPack(db, { bundle: edition.id, native: nativeEditionId() });
  if (!opening.ok) throw new Error(opening.reason);
  return opening.reader;
}

/**
 * The Language Pack bundled with the app, copied into place on every launch,
 * so the app always reads the pack it shipped with, and opened read-only. It
 * refuses to open when the pack is of another Edition than the app.
 */
async function openLanguagePack(): Promise<PackReader> {
  await importDatabaseFromAssetAsync(DATABASE_NAME, {
    assetId: languagePack,
    forceOverwrite: true,
  });
  const db = await openDatabaseAsync(DATABASE_NAME);
  try {
    return await prepare(db);
  } catch (error) {
    // Closed, so a retry copies the pack into place again.
    await db.closeAsync();
    throw error;
  }
}

/** The reader of the Language Pack of the app run, which the composition opens over; its gate is `Opened`. */
export const languagePackOpening = openOnce(openLanguagePack, {
  onError(error) {
    console.error('Could not open the Language Pack', error);
  },
});

/** The Core's Entries of this Edition, read from the bundled Language Pack. */
export function useEntries(): Entries {
  const content = useOpened(languagePackOpening);
  return useMemo(() => createEntries({ content, edition }), [content]);
}
