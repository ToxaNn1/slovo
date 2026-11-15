import { describe, expect, it } from 'vitest';

import { crossCells } from './crossword';

describe('the landing crossword picture', () => {
  const cells = crossCells();
  const row = (r: number) => cells.slice(r * 9, r * 9 + 9);

  it('puts БУНДЮЧНИЙ across the middle row', () => {
    expect(
      row(2)
        .map((cell) => cell.letter)
        .join(''),
    ).toBe('БУНДЮЧНИЙ');
    expect(row(2).every((cell) => cell.kind === 'answer')).toBe(true);
  });

  it('crosses it with the design two words down columns 1 and 6', () => {
    expect(cells.filter((cell) => cell.kind === 'word')).toHaveLength(7);
    expect([0, 1, 3, 4].map((r) => row(r)[1]?.letter).join('')).toBe('КРТА');
    expect(row(0)[6]?.kind).toBe('empty');
    expect([1, 3, 4].map((r) => row(r)[6]?.letter).join('')).toBe('ЗАК');
  });
});
