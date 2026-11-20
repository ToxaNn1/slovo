import type { UsdRate } from '@slovo/contracts/admin-api';

import type { Clock } from '../ports';
import { kyivDateOf } from './money';

/** The NBU's official rate of the dollar for a day. */
export interface NbuRate {
  /** Hryvnias for one dollar. */
  readonly uahPerUsd: number;
  /** The day `YYYY-MM-DD` the NBU set the rate for. */
  readonly on: string;
}

/** The NBU's rates: the rate of the dollar for a day, or that it can't answer. */
export interface NbuPort {
  usdRate(day: string): Promise<{ ok: true; rate: NbuRate } | { ok: false }>;
}

/** What one Kyiv day's read of the NBU found: its rate, or `failed`. */
export type NbuRead = NbuRate | 'failed';

/** Where the NBU reads are kept, one a Kyiv day, so a restart reads no second time. */
export interface UsdRateStore {
  /** The read of the Kyiv day, or `undefined` while none was made. */
  readOf(day: string): Promise<NbuRead | undefined>;
  /** Keeps the read of the Kyiv day. */
  keep(day: string, read: NbuRead): Promise<void>;
  /** The rate of the latest Kyiv day whose read found one. */
  lastKnown(): Promise<NbuRate | undefined>;
}

/** The rate the UAH figures are counted at. */
export interface UsdRates {
  /** The rate of the clock's Kyiv day, else the last known one; `null` while no read found one. */
  current(): Promise<UsdRate | null>;
}

/**
 * Reads the NBU at most once a Kyiv day: the first ask of the day reads it and
 * keeps what it found, a failure included, and every later ask of the day
 * answers what was kept. A failed day answers the last known rate.
 */
export function createUsdRates({
  nbu,
  store,
  clock,
}: {
  nbu: NbuPort;
  store: UsdRateStore;
  clock: Clock;
}): UsdRates {
  // The day being read now, so asks that arrive together share one read.
  let reading: { day: string; read: Promise<NbuRead> } | undefined;

  async function readOnce(day: string): Promise<NbuRead> {
    const kept = await store.readOf(day);
    if (kept !== undefined) return kept;
    const answer = await nbu.usdRate(day);
    const read: NbuRead = answer.ok ? answer.rate : 'failed';
    await store.keep(day, read);
    return read;
  }

  return {
    async current() {
      const day = kyivDateOf(clock.now());
      if (reading?.day !== day) {
        const read = readOnce(day);
        reading = { day, read };
        // A store failure is not kept: the next ask tries again.
        read.catch(() => {
          if (reading?.read === read) reading = undefined;
        });
      }
      const read = await reading.read;
      if (read !== 'failed') return { ...read, state: 'today' };
      const last = await store.lastKnown();
      return last === undefined ? null : { ...last, state: 'last-known' };
    },
  };
}
