import type { ContentStore } from '@slovo/core';
import { openPack, type PackReader, type PackWriteDatabase } from '@slovo/language-pack/reader';
import {
  deleteDatabaseAsync,
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { nativeModules } from '../device/device-native-modules';
import { logError } from '../diagnostics/log';
import { activeEditionFiles, activeEditionId } from '../edition/edition';
import { storeMedia } from '../media/store-media';
import { openOnce, type Opening } from '../opening';
import type { EditionSwitches } from '../shell-value';
import { openDeviceContentUpdate } from './device-content-updates';
import { openLaunchPack, type LaunchPack, type OpenedPack } from './launch-pack';
import { openPackContentStore } from './pack-content-store';

/** The copy of the bundled pack builds before made on every launch to read its version. */
const OLD_BUNDLED_NAME = 'language-pack.bundled.db';
/** The pack the app reads, which takes Patches (ADR 0090). */
const PATCHED_NAME = 'language-pack.db';

/** A writable pack over expo-sqlite: a Patch runs in one exclusive transaction. */
function writerOf(db: SQLiteDatabase): PackWriteDatabase {
  return {
    transaction: (run) => db.withExclusiveTransactionAsync((txn) => run(txn)),
  };
}

/**
 * Evicts the media files of the rows a Patch retired; a failed eviction
 * leaves them to the cache's limit, and the Patch stays applied.
 */
async function evictRetiredMedia(
  store: ContentStore,
  patch: Parameters<ContentStore['apply']>[0],
): Promise<void> {
  try {
    await storeMedia(store).patchApplied(patch);
  } catch (error) {
    logError('Could not evict the media a Patch retired', error);
  }
}

/** Opens a pack, refusing one of another Edition than the app; a refused pack is closed. */
async function open(name: string): Promise<OpenedPack<PackReader>> {
  const db = await openDatabaseAsync(name);
  try {
    // The one app carries no Edition in its native config (ADR 0065): the pack must be the active Edition's.
    const opening = await openPack(db, { bundle: activeEditionId, native: undefined });
    if (!opening.ok) throw new Error(opening.reason);
    return {
      reader: opening.reader,
      version: opening.metadata,
      store: await openPackContentStore(writerOf(db), evictRetiredMedia),
      close: () => db.closeAsync(),
    };
  } catch (error) {
    // Closed, so a retry opens it again.
    await db.closeAsync();
    throw error;
  }
}

/** Copies the bundled pack over the patched one. */
async function replaceWithBundled(): Promise<void> {
  await importDatabaseFromAssetAsync(PATCHED_NAME, {
    assetId: activeEditionFiles.languagePack,
    forceOverwrite: true,
  });
}

/**
 * Throws away what builds before kept and nothing reads any more: the copy of
 * the bundled pack, gone after the first launch of this build (deleting it
 * then fails, unheard), and the folder of downloaded packs that content
 * updates kept before Patches (ADR 0090), not on a binary without the
 * file-system module.
 */
function removeOldPacks(): void {
  deleteDatabaseAsync(OLD_BUNDLED_NAME).catch(() => undefined);
  nativeModules.load('contentUpdates', () => {
    const { Directory, Paths } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-file-system') as typeof import('expo-file-system');
    const folder = new Directory(Paths.document, 'content-update');
    if (folder.exists) folder.delete();
  });
}

/**
 * The Language Pack of the app run: the patched pack, which takes Patches
 * while it is open, with the Content update module when content updates are
 * on in effect at launch (`openLaunchPack`), so after the remote Feature
 * Switches. A pack of another Edition than the app is refused.
 */
export function languagePackOpening({
  remoteSwitches,
}: {
  remoteSwitches: Opening<EditionSwitches>;
}): Opening<LaunchPack<PackReader>> {
  return openOnce(
    async () => {
      removeOldPacks();
      return openLaunchPack({
        edition: (await remoteSwitches.opened()).edition,
        bundledContentVersion: activeEditionFiles.bundledContentVersion,
        openPatched: () => open(PATCHED_NAME),
        replaceWithBundled,
        openContentUpdate: openDeviceContentUpdate,
        onError(error) {
          logError('Could not close a Language Pack at launch', error);
        },
      });
    },
    {
      onError(error) {
        logError('Could not open the Language Pack', error);
      },
    },
  );
}
