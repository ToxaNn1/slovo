import { createEntries, type Entries, type TrackedUserState } from '@slovo/core';
import { openPack, type PackReader } from '@slovo/language-pack/reader';
import { importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { useMemo } from 'react';

import { logError } from '../diagnostics/log';
import { activeEditionFiles, edition } from '../edition/edition';
import { reportedEditionId } from '../edition/reported-edition';
import { openDeviceContentUpdate } from './device-content-updates';
import { devicePackFiles, type DevicePackFiles } from './device-pack-files';
import {
  openLaunchPack,
  type ContentUpdates,
  type LaunchPack,
  type OpenedPack,
} from './launch-pack';
import { openOnce, useOpened, type Opening } from '../opening';
import { useEditionInEffect } from '../edition/remote-switches';
import { useShell, type EditionSwitches } from '../shell-value';

const DATABASE_NAME = 'language-pack.db';

/** Opens a pack read-only, refusing one of another Edition than the app; a refused pack is closed. */
async function prepare(db: SQLiteDatabase): Promise<OpenedPack<PackReader>> {
  try {
    // expo-sqlite has no read-only open mode; this refuses every write instead.
    await db.execAsync('PRAGMA query_only = ON');
    const opening = await openPack(db, { bundle: edition.id, native: reportedEditionId });
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
    assetId: activeEditionFiles.languagePack,
    forceOverwrite: true,
  });
  return prepare(await openDatabaseAsync(DATABASE_NAME));
}

/** Content updates on a device that keeps downloaded packs; a kept pack opens as the bundled one does. */
function contentUpdatesOn(
  packFiles: DevicePackFiles,
  userState: Opening<TrackedUserState>,
): ContentUpdates<PackReader> {
  return {
    open: (bundled) => openDeviceContentUpdate(packFiles, bundled, userState),
    async openKeptPack(version) {
      const { directory, name } = packFiles.throwAwayAllBut(version);
      return (await prepare(await openDatabaseAsync(name, undefined, directory))).reader;
    },
  };
}

/**
 * The Language Pack of the app run: the bundled one, or the newer one a
 * Content update kept, opened read-only, with the Content update module when
 * content updates are on in effect at launch (`openLaunchPack`), so after the
 * remote Feature Switches. Either pack is refused when it is of another
 * Edition than the app.
 */
export function languagePackOpening({
  remoteSwitches,
  userState,
}: {
  remoteSwitches: Opening<EditionSwitches>;
  userState: Opening<TrackedUserState>;
}): Opening<LaunchPack<PackReader>> {
  return openOnce(
    async () =>
      openLaunchPack({
        edition: (await remoteSwitches.opened()).edition,
        // Off on a binary without the file-system module.
        contentUpdates:
          devicePackFiles === undefined ? undefined : contentUpdatesOn(devicePackFiles, userState),
        openBundled,
        onError(error) {
          logError('Content updates failed at launch', error);
        },
      }),
    {
      onError(error) {
        logError('Could not open the Language Pack', error);
      },
    },
  );
}

/** The Core's Entries of this Edition, read from the Language Pack of the app run. */
export function useEntries(): Entries {
  const content = useOpened(useShell().languagePack).reader;
  const inEffect = useEditionInEffect();
  return useMemo(() => createEntries({ content, edition: inEffect }), [content, inEffect]);
}
