import { createSourceCache } from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

// The server Core has no test runner of its own; its analytics are tested here.
describe('the source cache', () => {
  /** A cache fresh for a second, on a clock the test moves, and how often it fetched. */
  function cacheAt() {
    const clock = { ms: 0, now: () => new Date(clock.ms) };
    const cache = createSourceCache<number>({ clock, freshForMs: 1000 });
    let fetches = 0;
    const fetch = () => Promise.resolve(++fetches);
    return { clock, read: () => cache.read('k', fetch), fetches: () => fetches };
  }

  it('fetches a stale key once for reads that arrive together', async () => {
    const { clock, read, fetches } = cacheAt();
    await read();
    clock.ms = 5000;

    const [first, second] = await Promise.all([read(), read()]);

    expect(fetches()).toBe(2);
    expect(first).toEqual({ value: 2, fetchedAt: new Date(5000) });
    expect(second).toEqual(first);
  });

  it('answers a fresh key from what it kept, without fetching', async () => {
    const { clock, read, fetches } = cacheAt();
    await read();
    clock.ms = 999;

    expect(await read()).toEqual({ value: 1, fetchedAt: new Date(0) });
    expect(fetches()).toBe(1);
  });
});
