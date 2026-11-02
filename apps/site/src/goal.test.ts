import { describe, expect, it } from 'vitest';

import { boardCells, countAt, formatCount, shareOfGoal } from './goal';

describe('the goal counter', () => {
  it('writes a count with spaces between thousands', () => {
    expect(formatCount(48317)).toBe('48 317');
    expect(formatCount(1_000_000)).toBe('1 000 000');
    expect(formatCount(7)).toBe('7');
  });

  it('writes the share of the goal in Ukrainian notation', () => {
    expect(shareOfGoal(48317, 1_000_000)).toBe('4,8 %');
  });

  it('counts up from zero to the confirmed count, easing out', () => {
    expect(countAt(48317, 0)).toBe(0);
    expect(countAt(48317, 0.5)).toBe(42277);
    expect(countAt(48317, 1)).toBe(48317);
    expect(countAt(48317, 2)).toBe(48317);
  });

  it('pads the board with zeros and keeps the gap of the final count', () => {
    expect(boardCells(48317, 48317)).toEqual(['4', '8', null, '3', '1', '7']);
    expect(boardCells(1234, 48317)).toEqual(['0', '1', null, '2', '3', '4']);
    expect(boardCells(5, 48317)).toEqual(['0', '0', null, '0', '0', '5']);
  });
});
