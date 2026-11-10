import {
  createMedia,
  type CachedMediaFile,
  type ContentStore,
  type Edition,
  type Media,
  type MediaCache,
  type MediaFetcher,
} from '@slovo/core';

import { deviceClock } from '../device/device-clock';
import { nativeModules } from '../device/device-native-modules';
import { activeEditionFiles } from '../edition/edition';

/** The cache's index: each cached file by its Media Store path, with its size and when it was last used. */
type Index = Record<string, { readonly size: number; readonly usedAt: string }>;

/**
 * The device's media cache over `expo-file-system` (ADR 0099): a folder of
 * the app's cache, each file named by its Media Store path and written to a
 * `.part` file first, then moved in place, so a file is whole or absent. An
 * index keeps the sizes and the times of use. A file the system purged reads
 * as absent. Undefined on a binary without the file-system module.
 */
function createFileMediaCache(): MediaCache | undefined {
  return nativeModules.load('contentUpdates', () => {
    const { Directory, File, Paths } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-file-system') as typeof import('expo-file-system');
    const folder = new Directory(Paths.cache, 'media');
    const indexFile = new File(folder, 'index.json');
    const fileOf = (path: string) => new File(folder, path.replaceAll('/', '~'));
    let index: Index | undefined;

    async function read(): Promise<Index> {
      if (index !== undefined) return index;
      if (!folder.exists) folder.create({ intermediates: true });
      try {
        index = indexFile.exists ? (JSON.parse(await indexFile.text()) as Index) : {};
      } catch {
        index = {};
      }
      return index;
    }

    async function save(next: Index): Promise<void> {
      index = next;
      await indexFile.write(JSON.stringify(next));
    }

    return {
      async get(path) {
        const known = (await read())[path];
        const file = fileOf(path);
        return known !== undefined && file.exists ? file.uri : undefined;
      },
      async put(path, bytes, usedAt) {
        const current = await read();
        const part = new File(folder, `${path.replaceAll('/', '~')}.part`);
        await part.write(bytes);
        await part.move(fileOf(path), { overwrite: true });
        await save({ ...current, [path]: { size: bytes.length, usedAt: usedAt.toISOString() } });
      },
      async touch(path, usedAt) {
        const current = await read();
        const known = current[path];
        if (known !== undefined)
          await save({ ...current, [path]: { ...known, usedAt: usedAt.toISOString() } });
      },
      async evict(path) {
        const { [path]: _evicted, ...rest } = await read();
        const file = fileOf(path);
        if (file.exists) file.delete();
        await save(rest);
      },
      async files() {
        return Object.entries(await read()).map(([path, { size, usedAt }]): CachedMediaFile => ({
          path,
          size,
          usedAt: new Date(usedAt),
        }));
      },
    };
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
 * Starter Media, the device's one file cache and `fetch`, in the Narrator
 * Voice given and by the Feature Switches in effect.
 */
export function openDeviceMedia({
  store,
  edition,
  voice,
}: {
  store: Pick<ContentStore, 'mediaOf'>;
  edition: () => Pick<Edition, 'isFeatureEnabled' | 'narratorVoiceOf'>;
  voice: () => string;
}): Media<number> {
  return createMedia({
    store,
    cache: deviceMediaCache(),
    fetcher: fetchMediaFetcher,
    starter,
    clock: deviceClock,
    voice,
    defaultVoice: edition().narratorVoiceOf(undefined).id,
    isOn: (name) => edition().isFeatureEnabled(name),
  });
}
