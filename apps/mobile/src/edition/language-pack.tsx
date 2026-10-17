import { createEntries, type Entries } from '@slovo/core';
import { openPack, type PackReader } from '@slovo/language-pack/reader';
import Constants from 'expo-constants';
import { importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import languagePack from 'slovo-edition/language-pack';
import { useMemo } from 'react';

import { edition } from './edition';
import { openDeviceContentUpdate } from '../content-update/device-content-updates';
import { devicePackFiles, type DevicePackFiles } from '../content-update/device-pack-files';
import {
  openLaunchPack,
  type ContentUpdates,
  type LaunchPack,
  type OpenedPack,
} from '../content-update/launch-pack';
import { openOnce, useOpened } from '../opening';

const DATABASE_NAME = 'language-pack.db';

/** The Edition in the app's Expo config (see app.config.ts), if the build reports one. */
function nativeEditionId(): string | undefined {
  const reported: unknown = Constants.expoConfig?.extra?.['edition'];
  if (typeof reported !== 'object' || reported === null || !('id' in reported)) return undefined;
  return typeof reported.id === 'string' ? reported.id : undefined;
}

/** Opens a pack read-only, refusing one of another Edition than the app; a refused pack is closed. */
async function prepare(db: SQLiteDatabase): Promise<OpenedPack<PackReader>> {
  try {
    // expo-sqlite has no read-only open mode; this refuses every write instead.
    await db.execAsync('PRAGMA query_only = ON');
    const opening = await openPack(db, { bundle: edition.id, native: nativeEditionId() });
    if (!opening.ok) throw new Error(opening.reason);
    return { reader: opening.reader, version: opening.metadata, close: () => db.closeAsync() };
  } catch (error) {
    // Closed, so a retry opens it again.
    await db.closeAsync();
    throw error;
  }
}

/**
 * The Language Pack bundled with the app, copied into place on every launch,
 * so the app always has the pack it shipped with, and opened.
 */
async function openBundled(): Promise<OpenedPack<PackReader>> {
  await importDatabaseFromAssetAsync(DATABASE_NAME, {
    assetId: languagePack,
    forceOverwrite: true,
  });
  return prepare(await openDatabaseAsync(DATABASE_NAME));
}

/** Content updates on a device that keeps downloaded packs; a kept pack opens as the bundled one does. */
function contentUpdatesOn(packFiles: DevicePackFiles): ContentUpdates<PackReader> {
  return {
    packFiles,
    open: (bundled) => openDeviceContentUpdate(packFiles, bundled),
    async openKept(version) {
      const { directory, name } = packFiles.open(version);
      return (await prepare(await openDatabaseAsync(name, undefined, directory))).reader;
    },
  };
}

/**
 * The Language Pack of the app run: the bundled one, or the newer one a
 * Content update kept, opened read-only, with the Content update module when
 * content updates are on (`openLaunchPack`). Either pack is refused when it
 * is of another Edition than the app.
 */
export const languagePackOpening = openOnce(
  (): Promise<LaunchPack<PackReader>> =>
    openLaunchPack({
      edition,
      // Off on a binary without the file-system module.
      contentUpdates: devicePackFiles === undefined ? undefined : contentUpdatesOn(devicePackFiles),
      openBundled,
      onError(error) {
        console.error('Content updates failed at launch', error);
      },
    }),
  {
    onError(error) {
      console.error('Could not open the Language Pack', error);
    },
  },
);

/** The Core's Entries of this Edition, read from the Language Pack of the app run. */
export function useEntries(): Entries {
  const content = useOpened(languagePackOpening).reader;
  return useMemo(() => createEntries({ content, edition }), [content]);
}
