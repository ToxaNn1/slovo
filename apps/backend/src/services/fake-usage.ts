import type { ServiceReading, UsagePort } from '@slovo/server-core';

/** A usage port a test sets the reading of, makes fail, and counts the reads of. */
export interface FakeUsage extends UsagePort {
  /** How many times the provider was read. */
  readonly calls: number;
  /** What the next reads answer. */
  set(reading: ServiceReading): void;
  /** Makes the next reads fail, as the provider being down. */
  fail(): void;
}

/** A fake provider of a metered Service, answering `used` of `limit` `unit` until set otherwise. */
export function createFakeUsage(
  name: string,
  unit: string,
  used: number,
  limit: number,
): FakeUsage {
  let reading: ServiceReading = { kind: 'metered', usage: [{ name, unit, used, limit }] };
  let failing = false;
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    set(next) {
      reading = next;
      failing = false;
    },
    fail() {
      failing = true;
    },
    read() {
      calls += 1;
      return Promise.resolve(
        failing ? { ok: false, reason: 'unavailable' } : { ok: true, value: reading },
      );
    },
  };
}
