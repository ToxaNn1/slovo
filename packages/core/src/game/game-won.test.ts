import { describe, expect, it } from 'vitest';

import { countsAsWon } from '../index';

describe('whether a Game over counts as won', () => {
  it('counts a Game won at its Round limit', () => {
    expect(countsAsWon({ status: 'won' })).toBe(true);
  });

  it('counts a Game whose time is up', () => {
    expect(countsAsWon({ status: 'time-up' })).toBe(true);
  });

  it('does not count a Game lost with its last Life', () => {
    expect(countsAsWon({ status: 'lost' })).toBe(false);
  });
});
