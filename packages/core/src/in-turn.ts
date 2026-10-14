/**
 * What the Core modules share to keep their changes one at a time and tell
 * their subscribers. Internal: `index.ts` does not export it.
 */

/**
 * Makes the queue of a module: the call it returns runs each change after the
 * one before it, so each one starts from what that one left. A change that
 * fails does not hold back the next.
 */
export function createInTurn(): <T>(change: () => Promise<T>) => Promise<T> {
  let lastChange: Promise<unknown> = Promise.resolve();
  return (change) => {
    const result = lastChange.then(change);
    lastChange = result.catch(() => undefined);
    return result;
  };
}

/** The subscribers of a module: `subscribe` is the module's own, `tell` calls every listener. */
export interface Subscribers {
  subscribe: (listener: () => void) => () => void;
  tell: () => void;
}

export function createSubscribers(): Subscribers {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    tell() {
      for (const listener of listeners) listener();
    },
  };
}

/** Newest first; things made at the same instant in a stable order. */
export function newestFirst<T>(time: (item: T) => Date, key: (item: T) => string) {
  return (first: T, second: T): number => {
    const byTime = time(second).getTime() - time(first).getTime();
    if (byTime !== 0) return byTime;
    return key(first) < key(second) ? -1 : 1;
  };
}
