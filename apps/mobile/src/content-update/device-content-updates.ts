import {
  createContentUpdate,
  systemRandom,
  type ContentStore,
  type ContentUpdate,
} from '@slovo/core';
import { PATCH_FORMAT } from '@slovo/contracts/api';
import { systemSchedule } from '@slovo/ui';

import { backend } from '../api';
import { edition } from '../edition/edition';

/** Opens the Content update module of the device over the store of the open Language Pack. */
export function openDeviceContentUpdate(store: ContentStore): ContentUpdate {
  return createContentUpdate({
    backend,
    edition,
    store,
    random: systemRandom,
    schedule: systemSchedule,
    readableFormats: [PATCH_FORMAT],
  });
}
