import { describe, expect, it, vi } from 'vitest';

import { bind, openOnce, type OpeningState } from './opening';

/** A promise and the calls that settle it, so a test decides when an opening ends. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** Lets every settled promise run its callbacks. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const statusOf = <T>(state: OpeningState<T>) => state.status;

describe('an opening', () => {
  it('opens once, however many readers and subscribers ask, and is ready with what it opened', async () => {
    const open = vi.fn(() => Promise.resolve('pack'));
    const opening = openOnce(open, { onError: vi.fn() });

    expect(open).not.toHaveBeenCalled();
    expect(opening.state).toEqual({ status: 'loading' });
    opening.subscribe(vi.fn());
    opening.subscribe(vi.fn());
    expect(await Promise.all([opening.opened(), opening.opened()])).toEqual(['pack', 'pack']);

    expect(opening.state).toEqual({ status: 'ready', value: 'pack' });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('tells its subscribers when it is ready', async () => {
    const pack = deferred<string>();
    const opening = openOnce(() => pack.promise, { onError: vi.fn() });
    const seen: string[] = [];
    opening.subscribe(() => seen.push(statusOf(opening.state)));

    pack.resolve('pack');
    await settle();

    expect(seen).toEqual(['ready']);
  });

  it('fails with a retry and reports why', async () => {
    const onError = vi.fn();
    const failure = new Error('no pack');
    const opening = openOnce(() => Promise.reject(failure), { onError });

    expect(opening.state.status).toBe('loading');
    await settle();

    expect(opening.state.status).toBe('failed');
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('opens again on a retry and tells every subscriber, until it is ready', async () => {
    const busy = deferred<string>();
    const free = deferred<string>();
    const open = vi.fn(() => (open.mock.calls.length === 1 ? busy.promise : free.promise));
    const opening = openOnce(open, { onError: vi.fn() });
    const first: string[] = [];
    const second: string[] = [];
    opening.subscribe(() => first.push(statusOf(opening.state)));
    opening.subscribe(() => second.push(statusOf(opening.state)));
    const opened = opening.opened();

    busy.reject(new Error('busy'));
    await settle();
    const { state } = opening;
    if (state.status !== 'failed') throw new Error('expected the opening to fail');
    state.retry();
    // A second tap on the same retry opens nothing more.
    state.retry();
    free.resolve('pack');

    expect(await opened).toBe('pack');
    expect(open).toHaveBeenCalledTimes(2);
    expect(first).toEqual(['failed', 'loading', 'ready']);
    expect(second).toEqual(first);
  });

  it('stays ready with its fallback when the opening fails, using it once', async () => {
    const onError = vi.fn();
    const open = vi.fn(() => Promise.reject(new Error('no database')));
    const fallback = vi.fn(() => Promise.resolve('in memory'));
    const opening = openOnce(open, { onError, fallback });

    expect(await opening.opened()).toBe('in memory');
    expect(await opening.opened()).toBe('in memory');
    opening.subscribe(vi.fn());

    expect(opening.state).toEqual({ status: 'ready', value: 'in memory' });
    expect(open).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('fails with a retry when its fallback fails too', async () => {
    const onError = vi.fn();
    const opening = openOnce(() => Promise.reject(new Error('no database')), {
      onError,
      fallback: () => Promise.reject(new Error('no memory')),
    });

    expect(opening.state.status).toBe('loading');
    await settle();

    expect(opening.state.status).toBe('failed');
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('tells a listener nothing once it unsubscribed', async () => {
    const pack = deferred<string>();
    const opening = openOnce(() => pack.promise, { onError: vi.fn() });
    const kept = vi.fn();
    const left = vi.fn();
    opening.subscribe(kept);
    opening.subscribe(left)();

    pack.resolve('pack');
    await settle();

    expect(kept).toHaveBeenCalledTimes(1);
    expect(left).not.toHaveBeenCalled();
  });
});

/** A Core module as the shell sees it: a snapshot and the subscribers it tells of each change. */
function createCounter() {
  const listeners = new Set<() => void>();
  let count = 0;
  return {
    get count() {
      return count;
    },
    increment() {
      count += 1;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

describe('a binding', () => {
  it('reads the snapshot of its source and tells its listener of each change', () => {
    const counter = createCounter();
    const binding = bind(counter, ({ count }) => count);
    const listener = vi.fn();
    binding.subscribe(listener);

    counter.increment();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(binding.snapshot()).toBe(1);
  });

  it('tells a listener nothing once it unsubscribed', () => {
    const counter = createCounter();
    const binding = bind(counter, ({ count }) => count);
    const listener = vi.fn();
    binding.subscribe(listener)();

    counter.increment();

    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribes the same way to one source on every render, whatever it reads from it', () => {
    const counter = createCounter();

    // A screen binds again each time it renders; one subscription serves them all.
    expect(bind(counter, ({ count }) => count).subscribe).toBe(
      bind(counter, ({ count }) => count > 0).subscribe,
    );
    expect(bind(createCounter(), ({ count }) => count).subscribe).not.toBe(
      bind(counter, ({ count }) => count).subscribe,
    );
  });

  it('binds a source outside the composition, such as an opening, the same way', async () => {
    const pack = deferred<string>();
    const opening = openOnce(() => pack.promise, { onError: vi.fn() });
    const binding = bind(opening, ({ state }) => state);
    const listener = vi.fn();
    binding.subscribe(listener);
    const loading = binding.snapshot();

    pack.resolve('pack');
    await settle();

    expect(loading).toEqual({ status: 'loading' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(binding.snapshot()).toEqual({ status: 'ready', value: 'pack' });
    // The snapshot stays one value until the next change, as `useSyncExternalStore` needs.
    expect(binding.snapshot()).toBe(binding.snapshot());
  });
});
