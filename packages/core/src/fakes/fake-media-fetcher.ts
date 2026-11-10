import type { MediaFetcher } from '../ports';

/** A Media Store fetcher in memory: the URLs it was asked for, and the ones it cuts short or fails. */
export interface FakeMediaFetcher extends MediaFetcher {
  readonly asked: readonly string[];
  /** Serves a file of the size given at a URL. */
  serve(url: string, size: number): void;
  /** Makes the download of a URL end half-way, as a dropped connection does. */
  cutShort(url: string): void;
  /** Makes the download of a URL reject. */
  fail(url: string): void;
}

export function createFakeMediaFetcher(): FakeMediaFetcher {
  const sizes = new Map<string, number>();
  const short = new Set<string>();
  const failing = new Set<string>();
  const asked: string[] = [];
  return {
    asked,
    serve: (url, size) => void sizes.set(url, size),
    cutShort: (url) => void short.add(url),
    fail: (url) => void failing.add(url),
    download(url) {
      asked.push(url);
      const size = sizes.get(url);
      if (size === undefined || failing.has(url))
        return Promise.reject(new Error(`No file at ${url}`));
      return Promise.resolve(new Uint8Array(short.has(url) ? Math.floor(size / 2) : size));
    },
  };
}
