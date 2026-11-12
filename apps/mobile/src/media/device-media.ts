import {
  createMedia,
  type ContentStore,
  type Edition,
  type Media,
  type MediaCache,
  type MediaFetcher,
} from '@slovo/core';

import { deviceClock } from '../device/device-clock';
import { nativeModules } from '../device/device-native-modules';
import { activeEditionFiles } from '../edition/edition';
import { createIndexedMediaCache } from './indexed-media-cache';

/**
 * The device's media cache over `expo-file-system` (ADR 0099): a folder of
 * the app's cache, each file named by its Media Store path and written to a
 * `.part` file first, then moved in place, so a file is whole or absent. A
 * file the system purged reads as absent. Undefined on a binary without the
 * file-system module.
 */
function createFileMediaCache(): MediaCache | undefined {
  return nativeModules.load('contentUpdates', () => {
    const { Directory, File, Paths } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-file-system') as typeof import('expo-file-system');
    const folder = new Directory(Paths.cache, 'media');
    const indexFile = new File(folder, 'index.json');
    const nameOf = (path: string) => path.replaceAll('/', '~');
    const fileOf = (path: string) => new File(folder, nameOf(path));
    return createIndexedMediaCache({
      async readIndex() {
        if (!folder.exists) folder.create({ intermediates: true });
        return indexFile.exists ? await indexFile.text() : undefined;
      },
      async writeIndex(text) {
        await indexFile.write(text);
      },
      async write(path, bytes) {
        const part = new File(folder, `${nameOf(path)}.part`);
        await part.write(bytes);
        await part.move(fileOf(path), { overwrite: true });
      },
      uriOf(path) {
        const file = fileOf(path);
        return file.exists ? file.uri : undefined;
      },
      remove(path) {
        const file = fileOf(path);
        if (file.exists) file.delete();
      },
    });
  });
}

/** Downloads a Media Store file whole over `fetch`; a failed response rejects. */
const fetchMediaFetcher: MediaFetcher = {
  async download(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The download of ${url} answered ${String(response.status)}`);
    return new Uint8Array(await response.arrayBuffer());
  },
};

/** The Starter Media the app bundles, by Media Store path. */
const starter = {
  file: (path: string) => activeEditionFiles.starterMedia[path],
};

/** A media cache that holds nothing, for a binary without the file-system module: every file stays remote. */
const noCache: MediaCache = {
  get: () => Promise.resolve(undefined),
  put: () => Promise.resolve(),
  touch: () => Promise.resolve(),
  evict: () => Promise.resolve(),
  files: () => Promise.resolve([]),
};

/** Who hears of each file the cache takes in, as a card waits for its Illustration. */
const arrivalListeners = new Set<() => void>();

/** Calls `listener` after each file the media cache takes in; answers the stop. */
export function onMediaArrived(listener: () => void): () => void {
  arrivalListeners.add(listener);
  return () => {
    arrivalListeners.delete(listener);
  };
}

/** The one media cache of the device, opened at the first use, that tells of each file it takes in. */
let deviceCache: MediaCache | undefined;

function deviceMediaCache(): MediaCache {
  if (deviceCache !== undefined) return deviceCache;
  const cache = createFileMediaCache() ?? noCache;
  deviceCache = {
    ...cache,
    async put(path, bytes, usedAt) {
      await cache.put(path, bytes, usedAt);
      for (const listener of arrivalListeners) listener();
    },
  };
  return deviceCache;
}

/**
 * The Core media of the device over the Language Pack's content store: the
 * Starter Media, the device's one file cache and `fetch`, by the Feature
 * Switches in effect.
 */
export function openDeviceMedia({
  store,
  edition,
}: {
  store: Pick<ContentStore, 'mediaOf'>;
  edition: () => Pick<Edition, 'isFeatureEnabled' | 'narratorVoiceOf'>;
}): Media<number> {
  return createMedia({
    store,
    cache: deviceMediaCache(),
    fetcher: fetchMediaFetcher,
    starter,
    clock: deviceClock,
    defaultVoice: edition().narratorVoiceOf(undefined).id,
    isOn: (name) => edition().isFeatureEnabled(name),
  });
}
