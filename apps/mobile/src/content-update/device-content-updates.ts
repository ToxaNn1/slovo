import {
  createContentUpdate,
  systemRandom,
  type ContentUpdate,
  type PackFiles,
  type PackVersion,
  type TrackedUserState,
} from '@slovo/core';
import { PACK_FORMAT } from '@slovo/language-pack/reader';
import { systemSchedule } from '@slovo/ui';

import { apiClient } from '../api';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import type { Opening } from '../opening';
import { createContentApi } from './content-api';

/** The bytes of a file the API answered, read as React Native can: its `Blob` has no `arrayBuffer()`. */
function readBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not read a downloaded file'));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Opens the Content update module of the device over the version of the
 * bundled pack: the backend's content procedures, the pack files that keep a
 * downloaded pack, and the user state that keeps the time of the last check.
 */
export async function openDeviceContentUpdate(
  packFiles: PackFiles,
  bundled: PackVersion,
  userState: Opening<TrackedUserState>,
): Promise<ContentUpdate> {
  return createContentUpdate({
    contentApi: createContentApi({ client: apiClient, editionId: edition.id, readBytes }),
    packFiles,
    userState: await userState.opened(),
    clock: deviceClock,
    random: systemRandom,
    schedule: systemSchedule,
    bundled,
    readableFormats: [PACK_FORMAT],
  });
}
