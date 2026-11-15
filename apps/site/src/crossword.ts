/** One cell of the landing's crossword picture: its letter and whether it is the answer, a crossing word or empty. */
export type CrossCell = Readonly<{ letter: string; kind: 'answer' | 'word' | 'empty' }>;

const ANSWER = 'БУНДЮЧНИЙ';
/** The crossing words' letters by row, in columns 1 and 6 ('' where the design leaves a cell blank). */
const DOWN: Readonly<Record<number, readonly string[]>> = {
  1: ['К', 'Р', '', 'Т', 'А'],
  6: ['', 'З', '', 'А', 'К'],
};
const FIRST_ROW: Readonly<Record<number, number>> = { 1: 0, 6: 1 };

/** The design's 9 × 5 crossword: БУНДЮЧНИЙ across row 2, two words crossing it. */
export function crossCells(): CrossCell[] {
  return Array.from({ length: 45 }, (_, i) => {
    const row = Math.floor(i / 9);
    const col = i % 9;
    if (row === 2) return { letter: ANSWER[col] ?? '', kind: 'answer' };
    const down = DOWN[col];
    const first = FIRST_ROW[col];
    if (down !== undefined && first !== undefined && row >= first)
      return { letter: down[row] ?? '', kind: 'word' };
    return { letter: '', kind: 'empty' };
  });
}
