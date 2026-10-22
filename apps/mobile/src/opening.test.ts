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

/** An opening whose every open the test settles in turn, counting them. */
function heldOpens<T = string>(
  onError: (error: unknown) => void = vi.fn(),
  close?: (old: T) => void,
) {
  const opens: ReturnType<typeof deferred<T>>[] = [];
  const opening = openOnce(
    () => {
      const open = deferred<T>();
      opens.push(open);
      return open.promise;
    },
    close === undefined ? { onError } : { onError, close },
  );
  return { opening, opens };
}

describe('a reopen', () => {
  it('keeps the old value until the new one is open, then tells its subscribers once', async () => {
    const { opening, opens } = heldOpens();
    opening.subscribe(vi.fn());
    opens[0]?.resolve('old');
    await settle();
    const seen: OpeningState<string>[] = [];
    opening.subscribe(() => seen.push(opening.state));

    const reopened = opening.reopen();
    await settle();
    expect(opens).toHaveLength(2);
    expect(opening.state).toEqual({ status: 'ready', value: 'old' });
    expect(await opening.opened()).toBe('old');
    expect(seen).toEqual([]);

    opens[1]?.resolve('new');
    await reopened;

    expect(seen).toEqual([{ status: 'ready', value: 'new' }]);
    expect(await opening.opened()).toBe('new');
  });

  it('keeps the old value and reports why when it fails', async () => {
    const onError = vi.fn();
    const { opening, opens } = heldOpens(onError);
    opening.subscribe(vi.fn());
    opens[0]?.resolve('old');
    await settle();
    const listener = vi.fn();
    opening.subscribe(listener);
    const failure = new Error('no user state');

    const reopened = opening.reopen();
    await settle();
    opens[1]?.reject(failure);
    await reopened;

    expect(opening.state).toEqual({ status: 'ready', value: 'old' });
    expect(listener).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('runs after the reopen before it, so the last one asked is the value', async () => {
    const { opening, opens } = heldOpens();
    opening.subscribe(vi.fn());
    opens[0]?.resolve('first');
    await settle();

    const second = opening.reopen();
    const third = opening.reopen();
    await settle();
    expect(opens).toHaveLength(2);

    opens[1]?.resolve('second');
    await second;
    await settle();
    expect(opening.state).toEqual({ status: 'ready', value: 'second' });
    expect(opens).toHaveLength(3);

    opens[2]?.resolve('third');
    await third;
    expect(opening.state).toEqual({ status: 'ready', value: 'third' });
  });

  it('waits for an opening still opening, then opens it again', async () => {
    const { opening, opens } = heldOpens();
    opening.subscribe(vi.fn());

    const reopened = opening.reopen();
    await settle();
    expect(opens).toHaveLength(1);

    opens[0]?.resolve('opened before the change');
    await settle();
    expect(opens).toHaveLength(2);
    opens[1]?.resolve('opened over the change');
    await reopened;

    expect(opening.state).toEqual({ status: 'ready', value: 'opened over the change' });
  });

  it('closes the old value once its subscribers are told of the new one, and keeps it on a failure', async () => {
    const said: string[] = [];
    const { opening, opens } = heldOpens(vi.fn(), (old) => said.push(`closed ${old}`));
    opening.subscribe(() => {
      if (opening.state.status === 'ready') said.push(`told ${opening.state.value}`);
    });
    opens[0]?.resolve('first');
    await settle();

    const failed = opening.reopen();
    await settle();
    opens[1]?.reject(new Error('no user state'));
    await failed;
    const reopened = opening.reopen();
    await settle();
    opens[2]?.resolve('third');
    await reopened;

    expect(said).toEqual(['told first', 'told third', 'closed first']);
  });

  it('opens nothing for an opening never read or failed: its first read or its retry opens it afresh', async () => {
    const { opening, opens } = heldOpens();

    await opening.reopen();
    expect(opens).toHaveLength(0);

    opening.subscribe(vi.fn());
    opens[0]?.reject(new Error('busy'));
    await settle();
    await opening.reopen();

    expect(opens).toHaveLength(1);
    expect(opening.state.status).toBe('failed');
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

  it('moves a screen bound to a module of what an opening opened to the reopened module', async () => {
    const { opening, opens } = heldOpens<{ counter: ReturnType<typeof createCounter> }>();
    // A screen binds the opening, as its gate does, and the module it reads, as `useComposition` gives it.
    const moduleOf = () => {
      const { state } = opening;
      if (state.status !== 'ready') throw new Error('expected the opening to be ready');
      return state.value.counter;
    };
    const screen = vi.fn();
    bind(opening, ({ state }) => state).subscribe(screen);
    opens[0]?.resolve({ counter: createCounter() });
    await settle();
    const before = bind(moduleOf(), ({ count }) => count);

    const reopened = opening.reopen();
    await settle();
    const reopenedCounter = createCounter();
    opens[1]?.resolve({ counter: reopenedCounter });
    await reopened;
    const after = bind(moduleOf(), ({ count }) => count);
    const listener = vi.fn();
    after.subscribe(listener);
    reopenedCounter.increment();

    expect(screen).toHaveBeenCalledTimes(2);
    expect(after.subscribe).not.toBe(before.subscribe);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(after.snapshot()).toBe(1);
  });
});
