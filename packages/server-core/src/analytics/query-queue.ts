import type { Clock } from '../ports';

/** Waits the milliseconds, injected so a test needs no real timer. */
export type Wait = (ms: number) => Promise<void>;

const MINUTE_MS = 60_000;

/**
 * Runs the queries of an outside source within its limits: at most
 * `concurrency` at once, a further one waiting for one to end, and at most
 * `perMinute` started in any minute, a further one waiting for the minute to
 * pass.
 */
export interface QueryQueue {
  run<T>(query: () => Promise<T>): Promise<T>;
}

export function createQueryQueue({
  clock,
  wait,
  concurrency,
  perMinute,
}: {
  clock: Clock;
  wait: Wait;
  concurrency: number;
  perMinute: number;
}): QueryQueue {
  let running = 0;
  const waiting: (() => void)[] = [];
  // When each query of the last minute started, oldest first.
  const started: number[] = [];

  async function slot(): Promise<void> {
    if (running >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve));
    else running += 1;
    for (;;) {
      const now = clock.now().getTime();
      while (started.length > 0 && (started[0] ?? now) <= now - MINUTE_MS) started.shift();
      const oldest = started[0];
      if (started.length < perMinute || oldest === undefined) {
        started.push(now);
        return;
      }
      await wait(oldest + MINUTE_MS - now);
    }
  }

  function release(): void {
    const next = waiting.shift();
    // The slot passes to the next query waiting, so `running` stays.
    if (next === undefined) running -= 1;
    else next();
  }

  return {
    async run(query) {
      await slot();
      try {
        return await query();
      } finally {
        release();
      }
    },
  };
}
