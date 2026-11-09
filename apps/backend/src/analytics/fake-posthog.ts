import type { AnalyticsQuery, AnalyticsRow, PostHogPort } from '@slovo/server-core';

/** A PostHog for tests: it answers each kind of query its fixture, and can hold the queries it is given. */
export interface FakePostHog extends PostHogPort {
  /** The queries asked, oldest first. */
  readonly asked: readonly AnalyticsQuery[];
  /** The queries running now. */
  running(): number;
  /** Sets the rows a kind of query answers. */
  answer(kind: AnalyticsQuery['kind'], rows: readonly AnalyticsRow[]): void;
  /** Holds every query from now on until `release`. */
  hold(): void;
  /** Answers the oldest query held. */
  release(): void;
  /** Answers every query held, and holds no more. */
  releaseAll(): void;
  /** Answers that PostHog can't answer, or answers again. */
  down(isDown: boolean): void;
}

export function createFakePostHog(): FakePostHog {
  const asked: AnalyticsQuery[] = [];
  const fixtures = new Map<AnalyticsQuery['kind'], readonly AnalyticsRow[]>();
  const held: (() => void)[] = [];
  let holding = false;
  let isDown = false;
  let running = 0;
  return {
    asked,
    running: () => running,
    answer: (kind, rows) => fixtures.set(kind, rows),
    hold: () => {
      holding = true;
    },
    release: () => held.shift()?.(),
    releaseAll: () => {
      holding = false;
      for (const resolve of held.splice(0)) resolve();
    },
    down: (value) => {
      isDown = value;
    },
    async query(query) {
      asked.push(query);
      running += 1;
      if (holding) await new Promise<void>((resolve) => held.push(resolve));
      running -= 1;
      if (isDown) return { ok: false };
      return { ok: true, rows: fixtures.get(query.kind) ?? [] };
    },
  };
}
