/**
 * A named subject of the composition (ADR 0018): the composition creates it
 * before any module opens, a module publishes to it what happened and the
 * modules that follow subscribe, so no module returns a callback for the
 * composition to route. Internal: `index.ts` does not export it.
 */
export interface Subject<T> {
  /**
   * Calls `listener` with each value published from now on. Listeners run in
   * the order they subscribed, each awaited before the next, so the order the
   * composition opens its modules in is the order they follow in. Returns the
   * call that stops it.
   */
  subscribe(listener: (value: T) => void | Promise<void>): () => void;
  /**
   * Tells every listener, one after the other. Resolves once the last has
   * ended, and rejects with the first listener that fails; the listeners
   * after it are not called, so a publisher that awaits it knows every
   * listener followed, or none after the one that failed.
   */
  publish(value: T): Promise<void>;
}

/** Makes a subject with no listeners yet. */
export function createSubject<T>(): Subject<T> {
  const listeners = new Set<(value: T) => void | Promise<void>>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async publish(value) {
      for (const listener of listeners) await listener(value);
    },
  };
}
