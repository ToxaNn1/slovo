import type { Edition, Media } from '@slovo/core';

import { edition } from '../edition/edition';
import { openDeviceMedia } from './device-media';

/** The Edition in effect the last shell opened, whose Feature Switches the media follows. */
let inEffect: Pick<Edition, 'isFeatureEnabled' | 'narratorVoiceOf'> = edition;

/** Makes the media follow the Feature Switches of the Edition in effect. */
export function followEditionInEffect(
  next: Pick<Edition, 'isFeatureEnabled' | 'narratorVoiceOf'>,
): void {
  inEffect = next;
}

/** The Core media of each content store, opened at its first use. */
const mediaOfStore = new WeakMap<object, Media<number>>();

/** The Core media over a Language Pack's content store, one for each store. */
export function storeMedia(store: Parameters<typeof openDeviceMedia>[0]['store']): Media<number> {
  let media = mediaOfStore.get(store);
  if (media === undefined) {
    media = openDeviceMedia({ store, edition: () => inEffect });
    mediaOfStore.set(store, media);
  }
  return media;
}
