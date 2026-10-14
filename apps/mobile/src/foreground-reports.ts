import { untilNextLocalDay, type Clock } from '@slovo/core';

/**
 * Reports to `resume` each time the app is in the foreground: when it comes
 * back (`onForeground` calls its listener then), and on a timer when the next
 * local day starts in the clock's time zone while the app is open. It holds
 * no day rule: a timer that fires early reports anyway, and the composition
 * finds the same day. Returns the call that stops it.
 */
export function reportForeground({
  resume,
  clock,
  onForeground,
}: {
  resume: () => void;
  clock: Clock;
  /** Calls the listener each time the app comes back to the foreground; returns the call that stops it. */
  onForeground: (listener: () => void) => () => void;
}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function waitForNextDay(): void {
    clearTimeout(timer);
    timer = setTimeout(() => {
      resume();
      waitForNextDay();
    }, untilNextLocalDay(clock));
  }
  waitForNextDay();
  // Timers stop in the background, so the foreground starts the wait again.
  const stop = onForeground(() => {
    resume();
    waitForNextDay();
  });
  return () => {
    clearTimeout(timer);
    stop();
  };
}
