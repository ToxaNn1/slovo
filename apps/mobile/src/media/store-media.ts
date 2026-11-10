import type { Edition, Media } from '@slovo/core';

import { edition } from '../edition/edition';
import { openDeviceMedia } from './device-media';

/** The id of the Narrator Voice the Words are read in, as the cards last drew it (ADR 0083). */
let narratorVoice = edition.narratorVoiceOf(undefined).id;

/** Sets the Narrator Voice the media plays and downloads the Recordings in. */
export function setNarratorVoice(id: string): void {
  narratorVoice = id;
}

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
    media = openDeviceMedia({ store, edition: () => inEffect, voice: () => narratorVoice });
    mediaOfStore.set(store, media);
  }
  return media;
}
