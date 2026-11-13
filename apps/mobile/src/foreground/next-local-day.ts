import { untilNextLocalDay, type Clock } from '@slovo/core';

/**
 * Calls `onNewDay` at the start of each next local day by `clock`, until the
 * returned function stops it. It holds no day rule: a timer that fires early
 * calls anyway, and the caller finds the same day.
 */
export function everyNextLocalDay(clock: Clock, onNewDay: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  function wait(): void {
    timer = setTimeout(() => {
      onNewDay();
      wait();
    }, untilNextLocalDay(clock));
  }
  wait();
  return () => {
    clearTimeout(timer);
  };
}
