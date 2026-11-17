import type { NbuPort, NbuRate } from '@slovo/server-core';

/** An NBU for tests: it answers each day the rate set for it, and counts its reads. */
export interface FakeNbu extends NbuPort {
  /** The days read, oldest first. */
  readonly asked: readonly string[];
  /** Sets the rate the day answers. */
  answer(day: string, uahPerUsd: number): void;
  /** Answers that the NBU can't answer, or answers again. */
  down(isDown: boolean): void;
}

export function createFakeNbu(): FakeNbu {
  const asked: string[] = [];
  const rates = new Map<string, NbuRate>();
  let isDown = false;
  return {
    asked,
    answer: (day, uahPerUsd) => rates.set(day, { uahPerUsd, on: day }),
    down: (value) => {
      isDown = value;
    },
    usdRate(day) {
      asked.push(day);
      const rate = rates.get(day);
      return Promise.resolve(isDown || rate === undefined ? { ok: false } : { ok: true, rate });
    },
  };
}
