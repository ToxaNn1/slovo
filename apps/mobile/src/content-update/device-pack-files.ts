import { PackMetadataSchema } from '@slovo/contracts';
import type { PackFiles, PackVersion } from '@slovo/core';

import { nativeModules } from '../device/device-native-modules';

/** The record of the kept pack's version, beside its file. */
const KeptVersionSchema = PackMetadataSchema.pick({ contentVersion: true, packFormat: true });

/** The `PackFiles` of the device, which also tell expo-sqlite where the kept pack is. */
export interface DevicePackFiles extends PackFiles {
  /**
   * Where the kept pack of the version is, for expo-sqlite to open: the
   * directory as a path and the file's name. Call it at launch, before any
   * pack opens: it throws away every other pack file.
   */
  prepareToOpen(version: PackVersion): { readonly directory: string; readonly name: string };
}

/**
 * The downloaded Language Pack, kept in the app's documents directory through
 * `expo-file-system`: one file per content version and a record of the kept
 * one's version. Keeping a pack never touches the file of the pack open in
 * this run, so it never changes while it is open (ADR 0015). Undefined when
 * the installed binary lacks the module (a dev client built before the 0.6
 * batch); it is required here and nowhere else, as a static import would stop
 * the app at start.
 */
export const devicePackFiles = nativeModules.load('contentUpdates', (): DevicePackFiles => {
  const { Directory, File, Paths } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-file-system') as typeof import('expo-file-system');

  const folder = new Directory(Paths.document, 'content-update');
  const record = new File(folder, 'kept.json');
  const packFile = ({ contentVersion }: PackVersion) =>
    new File(folder, `language-pack-${String(contentVersion)}.db`);

  /** Throws away every pack file but the one named. */
  function removePacks(but?: string): void {
    if (!folder.exists) return;
    for (const item of folder.list()) {
      if (item instanceof File && item.extension === '.db' && item.name !== but) item.delete();
    }
  }

  return {
    keep(version, bytes) {
      folder.create({ intermediates: true, idempotent: true });
      // The file first, so a record always names a whole file.
      packFile(version).write(bytes);
      record.write(JSON.stringify(KeptVersionSchema.parse(version)));
      return Promise.resolve();
    },
    read() {
      if (!record.exists) return Promise.resolve(undefined);
      let kept: PackVersion | undefined;
      try {
        kept = KeptVersionSchema.parse(JSON.parse(record.textSync()));
      } catch {
        // A record cut short reads as none.
      }
      return Promise.resolve(kept !== undefined && packFile(kept).exists ? kept : undefined);
    },
    forget() {
      if (record.exists) record.delete();
      removePacks();
      return Promise.resolve();
    },
    prepareToOpen(version) {
      const { name } = packFile(version);
      removePacks(name);
      return { directory: decodeURI(folder.uri.replace(/^file:\/\//, '')), name };
    },
  };
});
