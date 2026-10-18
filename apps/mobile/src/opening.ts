import { useSyncExternalStore } from 'react';

/** A source a screen can subscribe to, such as a Core module: it tells its listeners when it changes. */
export interface Source {
  subscribe(listener: () => void): () => void;
}

export type OpeningState<T> =
  | { readonly status: 'loading' }
  | {
      readonly status: 'failed';
      /** Opens it again, for every screen that shows it. */
      readonly retry: () => void;
    }
  | { readonly status: 'ready'; readonly value: T };

/**
 * Something the shell opens once per app run and every screen shares, such as
 * the Language Pack or the Core composition, and may reopen while the app
 * runs. It is a source like a Core module: its snapshot is `state`, and it
 * tells its subscribers of each change.
 */
export interface Opening<T> extends Source {
  /** Where the opening stands; the first read starts it. */
  readonly state: OpeningState<T>;
  /** What it opened, once it is ready, after any retries; the first call starts it. */
  opened(): Promise<T>;
  /**
   * Opens it again, such as the composition over a user state a sync
   * changed. It stays ready with what it opened until the new value is open,
   * then is ready with that and tells its subscribers once. A reopen that
   * fails is reported and keeps the old value; the fallback is not used.
   * Reopens run in turn, each after the one before ends. One asked while the
   * opening still opens waits for it; an opening not read yet or failed has
   * nothing to reopen, since its first read or its retry opens it afresh.
   * Settles once it ends, and never rejects.
   */
  reopen(): Promise<void>;
}

const loading = { status: 'loading' } as const;

/**
 * Opens `open` on the first read and shares it for the app run, until a
 * reopen opens it again. A failure
 * is reported to `onError`; then the opening is ready with `fallback` when it
 * has one, or it fails with a retry that opens it again. Once ready it stays
 * ready, also through a reopen, so the fallback is used at most once.
 */
export function openOnce<T>(
  open: () => Promise<T>,
  { onError, fallback }: { onError: (error: unknown) => void; fallback?: () => Promise<T> },
): Opening<T> {
  let state: OpeningState<T> | undefined;
  const listeners = new Set<() => void>();
  /** The last reopen asked, which the next one waits for. */
  let reopening = Promise.resolve();

  function change(changed: OpeningState<T>): void {
    state = changed;
    for (const listener of listeners) listener();
  }

  async function attempt(): Promise<T> {
    try {
      return await open();
    } catch (error) {
      if (fallback === undefined) throw error;
      onError(error);
      return fallback();
    }
  }

  function start(): void {
    attempt().then(
      (value) => {
        change({ status: 'ready', value });
      },
      (error: unknown) => {
        onError(error);
        const failed: OpeningState<T> = {
          status: 'failed',
          retry() {
            // Only the failure on screen opens again; a second tap finds it loading.
            if (state !== failed) return;
            change(loading);
            start();
          },
        };
        change(failed);
      },
    );
  }

  /** Resolves once the opening is not loading: ready, failed, or never read. */
  function settled(): Promise<void> {
    return new Promise((resolve) => {
      if (state?.status !== 'loading') {
        resolve();
        return;
      }
      const unsubscribe = opening.subscribe(() => {
        if (state?.status === 'loading') return;
        unsubscribe();
        resolve();
      });
    });
  }

  async function reopenWhenSettled(): Promise<void> {
    await settled();
    if (state?.status !== 'ready') return;
    let value: T;
    try {
      value = await open();
    } catch (error) {
      onError(error);
      return;
    }
    change({ status: 'ready', value });
  }

  function current(): OpeningState<T> {
    if (state === undefined) {
      state = loading;
      start();
    }
    return state;
  }

  const opening: Opening<T> = {
    get state() {
      return current();
    },
    opened() {
      const now = current();
      if (now.status === 'ready') return Promise.resolve(now.value);
      return new Promise((resolve) => {
        const unsubscribe = opening.subscribe(() => {
          if (state?.status !== 'ready') return;
          unsubscribe();
          resolve(state.value);
        });
      });
    },
    reopen() {
      reopening = reopening.then(reopenWhenSettled);
      return reopening;
    },
    subscribe(listener) {
      current();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return opening;
}

/** The two calls `useSyncExternalStore` takes to keep a screen on one snapshot of a source. */
export interface Binding<T> {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => T;
}

/** One subscription per source, so a screen that binds again on every render never resubscribes. */
const subscriptions = new WeakMap<Source, Binding<unknown>['subscribe']>();

/**
 * Binds a snapshot of a source: a Core module of the composition, a module
 * that opens apart from it, or an opening. `snapshot` must return one value
 * until the source changes (a module's own state or list, not a new object).
 */
export function bind<S extends Source, T>(source: S, snapshot: (source: S) => T): Binding<T> {
  let subscribe = subscriptions.get(source);
  if (subscribe === undefined) {
    subscribe = (listener) => source.subscribe(listener);
    subscriptions.set(source, subscribe);
  }
  return { subscribe, snapshot: () => snapshot(source) };
}

/** Reads a snapshot of a source and keeps the screen subscribed to it. */
export function useSubscribed<S extends Source, T>(source: S, snapshot: (source: S) => T): T {
  const binding = bind(source, snapshot);
  return useSyncExternalStore(binding.subscribe, binding.snapshot);
}

/**
 * What an opening opened, for a screen drawn under the gate that waits for it
 * (`Opened`), so the screen never sees it loading or failed.
 */
export function useOpened<T>(opening: Opening<T>): T {
  const state = useSubscribed(opening, ({ state }) => state);
  if (state.status !== 'ready') throw new Error('Draw this screen under the gate of its opening.');
  return state.value;
}
