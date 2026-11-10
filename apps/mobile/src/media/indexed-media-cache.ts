import type { CachedMediaFile, MediaCache } from '@slovo/core';
import { z } from 'zod';

/** The cache's index: each cached file by its Media Store path, with its size and when it was last used. */
const IndexSchema = z.record(
  z.string(),
  z.object({ size: z.number().int().nonnegative(), usedAt: z.iso.datetime() }),
);
type Index = z.infer<typeof IndexSchema>;

/** The index in the text saved, or an empty one when the text is none or not an index. */
function parseIndex(text: string | undefined): Index {
  if (text === undefined) return {};
  try {
    return IndexSchema.safeParse(JSON.parse(text)).data ?? {};
  } catch {
    return {};
  }
}

/** The disk under the device media cache: the files by Media Store path and the index text. */
export interface MediaDisk {
  /** The index text saved last, undefined before the first save. */
  readIndex(): Promise<string | undefined>;
  writeIndex(text: string): Promise<void>;
  /** Writes a file whole or not at all. */
  write(path: string, bytes: Uint8Array): Promise<void>;
  /** The local URI of a file on disk, undefined when absent. */
  uriOf(path: string): string | undefined;
  remove(path: string): void;
}

/**
 * The device's media cache over a disk, with an index of the sizes and the
 * times of use (ADR 0099). Every change of the files and the index runs one
 * after another, each from the index the one before left, so changes that
 * overlap, as a prefetch, a tap and a card shown do, never drop an entry.
 */
export function createIndexedMediaCache(disk: MediaDisk): MediaCache {
  let index: Promise<Index> | undefined;
  const read = () => (index ??= disk.readIndex().then(parseIndex));

  /** The last change queued; each change waits for it, then saves the index it answers. */
  let changes: Promise<unknown> = Promise.resolve();

  function change(next: (current: Index) => Promise<Index>): Promise<void> {
    const run = changes.then(async () => {
      const current = await read();
      const saved = await next(current);
      if (saved === current) return;
      index = Promise.resolve(saved);
      await disk.writeIndex(JSON.stringify(saved));
    });
    changes = run.catch(() => undefined);
    return run;
  }

  return {
    async get(path) {
      const known = (await read())[path];
      return known === undefined ? undefined : disk.uriOf(path);
    },
    put: (path, bytes, usedAt) =>
      change(async (current) => {
        await disk.write(path, bytes);
        return { ...current, [path]: { size: bytes.length, usedAt: usedAt.toISOString() } };
      }),
    touch: (path, usedAt) =>
      change((current) => {
        const known = current[path];
        return Promise.resolve(
          known === undefined
            ? current
            : { ...current, [path]: { ...known, usedAt: usedAt.toISOString() } },
        );
      }),
    evict: (path) =>
      change(({ [path]: _evicted, ...rest }) => {
        disk.remove(path);
        return Promise.resolve(rest);
      }),
    async files() {
      return Object.entries(await read()).map(([path, { size, usedAt }]): CachedMediaFile => ({
        path,
        size,
        usedAt: new Date(usedAt),
      }));
    },
  };
}
