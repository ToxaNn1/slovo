import type { CachedMediaFile, MediaCache } from '../ports';

/** A media cache in memory; a file's URI is `memory://` and its path. */
export function createMemoryMediaCache(): MediaCache {
  const files = new Map<string, CachedMediaFile>();
  return {
    get: (path) => Promise.resolve(files.has(path) ? `memory://${path}` : undefined),
    put(path, bytes, usedAt) {
      files.set(path, { path, size: bytes.length, usedAt });
      return Promise.resolve();
    },
    touch(path, usedAt) {
      const file = files.get(path);
      if (file !== undefined) files.set(path, { ...file, usedAt });
      return Promise.resolve();
    },
    evict(path) {
      files.delete(path);
      return Promise.resolve();
    },
    files: () => Promise.resolve([...files.values()]),
  };
}
