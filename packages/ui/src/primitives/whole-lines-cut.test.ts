import { describe, expect, it } from 'vitest';

import { wholeLinesCut } from './whole-lines-cut';

const line = (top: number, bottom: number) => ({ top, bottom });

describe('wholeLinesCut', () => {
  it('cuts under the last line that ends within the limit, never through the next one', () => {
    expect(wholeLinesCut(70, [line(0, 28), line(28, 56), line(56, 84)])).toBe(56);
  });

  it('keeps a line that ends right at the limit', () => {
    expect(wholeLinesCut(56, [line(0, 28), line(28, 56), line(56, 84)])).toBe(56);
  });

  it('reads lines of several texts in any order, gaps between them included', () => {
    expect(wholeLinesCut(100, [line(80, 104), line(0, 28), line(40, 64), line(64, 88)])).toBe(64);
  });

  it('never cuts through a line beside another, as in a row of two texts', () => {
    // A chip 30–62 stands beside a text line 40–60: a cut at 60 would slice the chip.
    expect(wholeLinesCut(61, [line(0, 28), line(30, 62), line(40, 60)])).toBe(28);
  });

  it('shows nothing when even the first line is taller than the limit', () => {
    expect(wholeLinesCut(20, [line(0, 28)])).toBe(0);
  });

  it('keeps the limit when no line has been reported', () => {
    expect(wholeLinesCut(120, [])).toBe(120);
  });
});
