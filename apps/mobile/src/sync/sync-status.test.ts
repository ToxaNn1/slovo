import type { SyncState } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { fakeClock, strings } from '../test-support';
import { syncStatusLine } from './sync-status';

const idle: SyncState = { syncedAt: undefined, running: false, offline: false };

function lineOf(state: Partial<SyncState>, clock = fakeClock('2026-10-18T12:00:00Z').clock) {
  return syncStatusLine({
    state: { ...idle, ...state },
    strings: strings.account.sync,
    months: strings.dates.shortMonths,
    clock,
  });
}

describe('the status line of the SLOVO ID screen', () => {
  it('says a sync runs, whatever else is known', () => {
    expect(
      lineOf({ running: true, offline: true, syncedAt: new Date('2026-10-18T09:00:00Z') }),
    ).toBe('Синхронізація…');
  });

  it('says sync waits for the network when the last attempt found none', () => {
    expect(lineOf({ offline: true, syncedAt: new Date('2026-10-18T09:00:00Z') })).toBe(
      'Синхронізація чекає на мережу',
    );
  });

  it('gives the local time of a sync made today', () => {
    // 09:05 UTC is 12:05 in Kyiv in October.
    expect(lineOf({ syncedAt: new Date('2026-10-18T09:05:00Z') })).toBe(
      'Синхронізовано сьогодні о 12:05',
    );
  });

  it('gives the day and month of a sync made another day of this year', () => {
    expect(lineOf({ syncedAt: new Date('2026-03-02T09:05:00Z') })).toBe('Синхронізовано 2 бер.');
  });

  it('gives the year of a sync made in another year', () => {
    expect(lineOf({ syncedAt: new Date('2025-12-31T09:05:00Z') })).toBe(
      'Синхронізовано 31 груд. 2025',
    );
  });

  it('follows the local day, not the UTC one', () => {
    // 22:30 UTC on the 17th is already the 18th in Kyiv.
    expect(lineOf({ syncedAt: new Date('2026-10-17T22:30:00Z') })).toBe(
      'Синхронізовано сьогодні о 01:30',
    );
  });

  it('has no line before a first sync has gone through', () => {
    expect(lineOf({})).toBeUndefined();
  });
});
