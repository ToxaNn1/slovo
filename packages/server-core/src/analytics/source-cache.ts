import type { Clock } from '../ports';

/** A value read from an outside source, with when it was read. */
export interface Fetched<T> {
  readonly value: T;
  readonly fetchedAt: Date;
}

/**
 * Keeps what one outside source (PostHog, Sentry) answered, per query key, for
 * a freshness: a read within it answers the kept value and its `fetchedAt`,
 * and calls the source no second time; a read while the same key is still
 * being read waits for that read. Kept in memory, so a restart forgets it. A
 * failed read is not kept.
 */
export interface SourceCache<T> {
  read(key: string, fetch: () => Promise<T>): Promise<Fetched<T>>;
}

export function createSourceCache<T>({
  clock,
  freshForMs,
}: {
  clock: Clock;
  freshForMs: number;
}): SourceCache<T> {
  // A key's read, and its fetchedAt once it is done: the check below stays
  // synchronous, so reads that arrive together share one fetch.
  const kept = new Map<string, { reading: Promise<Fetched<T>>; fetchedAt?: number }>();
  return {
    read(key, fetch) {
      const now = clock.now().getTime();
      const found = kept.get(key);
      // A read still running counts as fresh.
      if (
        found !== undefined &&
        (found.fetchedAt === undefined || now - found.fetchedAt < freshForMs)
      ) {
        return found.reading;
      }
      const entry: { reading: Promise<Fetched<T>>; fetchedAt?: number } = {
        reading: Promise.resolve()
          .then(fetch)
          .then((value) => {
            const fetched = { value, fetchedAt: clock.now() };
            entry.fetchedAt = fetched.fetchedAt.getTime();
            return fetched;
          }),
      };
      kept.set(key, entry);
      entry.reading.catch(() => {
        if (kept.get(key) === entry) kept.delete(key);
      });
      return entry.reading;
    },
  };
}
