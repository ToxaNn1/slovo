import { describe, expect, it } from 'vitest';

import { newestFirst } from './in-turn';

interface Made {
  readonly id: string;
  readonly at: Date;
}

const newest = newestFirst<Made>(
  ({ at }) => at,
  ({ id }) => id,
);

const made = (id: string, at: string): Made => ({ id, at: new Date(at) });

describe('newestFirst', () => {
  it('puts the newest first, and things made at the same instant by key', () => {
    const older = made('b', '2026-11-01T09:00:00.000Z');
    const newer = made('c', '2026-11-02T09:00:00.000Z');
    const sameInstant = made('a', '2026-11-01T09:00:00.000Z');

    expect([older, newer, sameInstant].sort(newest)).toEqual([newer, sameInstant, older]);
  });

  it('holds the same thing equal to itself', () => {
    const one = made('a', '2026-11-01T09:00:00.000Z');

    expect(newest(one, one)).toBe(0);
    expect(newest(one, made('a', '2026-11-01T09:00:00.000Z'))).toBe(0);
  });
});
