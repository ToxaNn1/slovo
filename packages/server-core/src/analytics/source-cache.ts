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
  const kept = new Map<string, Promise<Fetched<T>>>();
  return {
    async read(key, fetch) {
      const now = clock.now().getTime();
      const found = kept.get(key);
      // A read still running counts as fresh: its fetchedAt comes after now.
      if (found !== undefined && now - (await found).fetchedAt.getTime() < freshForMs) {
        return found;
      }
      const reading = fetch().then((value) => ({ value, fetchedAt: clock.now() }));
      kept.set(key, reading);
      reading.catch(() => {
        if (kept.get(key) === reading) kept.delete(key);
      });
      return reading;
    },
  };
}
