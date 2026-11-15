import { describe, expect, it } from 'vitest';

import { barWidth, countAt, formatCount, shareOfGoal } from './goal';

describe('the goal counter', () => {
  it('writes a count with spaces between thousands', () => {
    expect(formatCount(18342)).toBe('18 342');
    expect(formatCount(1_000_000)).toBe('1 000 000');
    expect(formatCount(7)).toBe('7');
  });

  it('writes the share of the goal as the design does: one decimal, a comma, no space', () => {
    expect(shareOfGoal(18342, 1_000_000)).toBe('1,8%');
    expect(shareOfGoal(48317, 1_000_000)).toBe('4,8%');
    expect(shareOfGoal(0, 1_000_000)).toBe('0,0%');
  });

  it('fills the bar by the share, never thinner than 1.5 %', () => {
    expect(barWidth(48317, 1_000_000)).toBeCloseTo(4.8317);
    expect(barWidth(5000, 1_000_000)).toBe(1.5);
  });

  it('counts up from zero to the confirmed count, easing out', () => {
    expect(countAt(48317, 0)).toBe(0);
    expect(countAt(48317, 0.5)).toBe(42277);
    expect(countAt(48317, 1)).toBe(48317);
    expect(countAt(48317, 2)).toBe(48317);
  });
});
