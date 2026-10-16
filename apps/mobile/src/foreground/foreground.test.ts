import type { AppStateStatus } from 'react-native';
import { describe, expect, it } from 'vitest';

import { createForeground } from './foreground';

/** The device's app state, moved by the test, counting its listeners. */
function fakeAppState(start: AppStateStatus = 'active') {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const source = {
    currentState: start,
    addEventListener(_type: 'change', listener: (state: AppStateStatus) => void) {
      listeners.add(listener);
      return {
        remove() {
          listeners.delete(listener);
        },
      };
    },
  };
  return {
    source,
    listeners,
    change(state: AppStateStatus) {
      source.currentState = state;
      // A snapshot, like the real source: a listener may unsubscribe while it runs.
      for (const listener of Array.from(listeners)) listener(state);
    },
  };
}

describe('the foreground', () => {
  it('reads whether the app is in the foreground', () => {
    const appState = fakeAppState('background');
    const foreground = createForeground(appState.source);
    expect(foreground.active()).toBe(false);

    appState.change('active');

    expect(foreground.active()).toBe(true);
  });

  it('listens to the device once for every reader, and tells them in the order they came', () => {
    const appState = fakeAppState();
    const foreground = createForeground(appState.source);
    const told: string[] = [];
    foreground.subscribe(() => told.push(`first: ${String(foreground.active())}`));
    foreground.subscribe(() => told.push(`second: ${String(foreground.active())}`));

    appState.change('background');

    expect(appState.listeners.size).toBe(1);
    expect(told).toEqual(['first: false', 'second: false']);
  });

  it('tells nothing when the app moves between states out of the foreground', () => {
    const appState = fakeAppState();
    const foreground = createForeground(appState.source);
    let told = 0;
    foreground.subscribe(() => (told += 1));

    appState.change('inactive');
    appState.change('background');
    appState.change('active');

    expect(told).toBe(2);
  });

  it('stops listening to the device once the last reader stops', () => {
    const appState = fakeAppState();
    const foreground = createForeground(appState.source);
    const stopFirst = foreground.subscribe(() => undefined);
    const stopSecond = foreground.subscribe(() => undefined);

    stopFirst();
    expect(appState.listeners.size).toBe(1);
    stopSecond();

    expect(appState.listeners.size).toBe(0);
  });
});
