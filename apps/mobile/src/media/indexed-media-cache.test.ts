import { describe, expect, it } from 'vitest';

import { createIndexedMediaCache, type MediaDisk } from './indexed-media-cache';

/** A disk in memory whose every write ends a tick later, as a real file write does. */
function memoryDisk(indexText?: string) {
  const files = new Map<string, Uint8Array>();
  let index = indexText;
  const later = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const disk: MediaDisk = {
    readIndex: () => Promise.resolve(index),
    async writeIndex(text) {
      await later();
      index = text;
    },
    async write(path, bytes) {
      await later();
      files.set(path, bytes);
    },
    uriOf: (path) => (files.has(path) ? `file://${path}` : undefined),
    remove: (path) => void files.delete(path),
  };
  return { disk, files, index: () => index };
}

const at = (minute: number) => new Date(Date.UTC(2026, 10, 10, 12, minute));

describe('the device media cache', () => {
  it('keeps every file in its index when puts, touches and evictions overlap', async () => {
    const { disk } = memoryDisk();
    const cache = createIndexedMediaCache(disk);
    await cache.put('a', new Uint8Array(1), at(0));

    await Promise.all([
      cache.put('b', new Uint8Array(2), at(1)),
      cache.touch('a', at(2)),
      cache.put('c', new Uint8Array(3), at(3)),
      cache.evict('a'),
      cache.put('d', new Uint8Array(4), at(4)),
    ]);

    expect(await cache.files()).toEqual([
      { path: 'b', size: 2, usedAt: at(1) },
      { path: 'c', size: 3, usedAt: at(3) },
      { path: 'd', size: 4, usedAt: at(4) },
    ]);
    expect(await cache.get('a')).toBeUndefined();
    expect(await cache.get('d')).toBe('file://d');
  });

  it('reads the index the app saved before', async () => {
    const first = memoryDisk();
    await createIndexedMediaCache(first.disk).put('a', new Uint8Array(5), at(0));

    const reopened = createIndexedMediaCache({ ...first.disk });

    expect(await reopened.files()).toEqual([{ path: 'a', size: 5, usedAt: at(0) }]);
  });

  it('starts empty from an index that is not one', async () => {
    const { disk } = memoryDisk(JSON.stringify({ a: { size: 'big', usedAt: 'yesterday' } }));

    expect(await createIndexedMediaCache(disk).files()).toEqual([]);
  });

  it('answers a file the system purged as absent', async () => {
    const { disk, files } = memoryDisk();
    const cache = createIndexedMediaCache(disk);
    await cache.put('a', new Uint8Array(1), at(0));
    files.delete('a');

    expect(await cache.get('a')).toBeUndefined();
  });
});
