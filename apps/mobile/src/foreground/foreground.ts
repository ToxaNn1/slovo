import type { AppStateStatus, NativeEventSubscription } from 'react-native';

/** The device's app state, as React Native's `AppState` gives it. */
export interface AppStateSource {
  readonly currentState: AppStateStatus;
  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void,
  ): NativeEventSubscription;
}

/**
 * Whether the app is in the foreground, read from one subscription for every
 * reader of it, such as the Feed. The app's moments come from `reportForeground`.
 */
export interface Foreground {
  /** Whether the app is in the foreground now. */
  readonly active: () => boolean;
  /**
   * Calls `listener` each time the app comes to the foreground or leaves it,
   * after the listeners that came before it. Returns the call that stops it.
   */
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * The foreground over one subscription to the device's app state, which it
 * holds while anyone listens. A move between two states out of the
 * foreground, such as from inactive to the background, tells nothing.
 */
export function createForeground(source: AppStateSource): Foreground {
  const listeners = new Set<() => void>();
  let subscription: NativeEventSubscription | undefined;
  let active = false;
  return {
    active: () => (subscription === undefined ? source.currentState === 'active' : active),
    subscribe(listener) {
      if (subscription === undefined) {
        active = source.currentState === 'active';
        subscription = source.addEventListener('change', (state) => {
          if ((state === 'active') === active) return;
          active = state === 'active';
          // A snapshot: a listener may unsubscribe or subscribe while they are told.
          for (const tell of Array.from(listeners)) tell();
        });
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        subscription?.remove();
        subscription = undefined;
      };
    },
  };
}
