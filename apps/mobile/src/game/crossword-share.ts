import { fill, type EditionStrings } from '@slovo/contracts';
import { parseLocalDate, type CrosswordSolve } from '@slovo/core';

import type { CrossingCrosswordPlay } from './crossing-crossword';

type Strings = EditionStrings['game']['dailyCrossword'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** A local date, `YYYY-MM-DD`, as a count of days. */
const daysOf = (date: string) => {
  const { year, month, day } = parseLocalDate(date);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
};

/** The day the crossing Daily Crossword counts from: its №1 (ADR 0087). */
const FIRST_DAY = daysOf('2026-01-01');

/** What one cell of the grid becomes in the shared text: a Word's cell in red, a block in black. */
const SHARED_CELL = { open: '🟥', block: '⬛' } as const;

/** A Solve time in seconds as a clock reads it, e.g. «3:42». */
export function solveTimeText(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** What the solved screen shows and shares of a solved crossing Daily Crossword, never a letter. */
export interface CrosswordShare {
  /** The Solve time, e.g. «3:42»; none while the Edition keeps no Solve time. */
  readonly time: string | undefined;
  /** The grid by rows: `true` for a cell of a Word, `false` for a block. */
  readonly grid: boolean[][];
  /** «SLOVO · Кросворд №{n}». */
  readonly title: string;
  /** «{time} · без підказок», the time alone after a hint, «без підказок» alone with no time. */
  readonly line: string | undefined;
  /** The text shared: the title, the line and the grid in red and black squares. */
  readonly message: string;
}

/** The solved screen's grid, share line and shared text of today's solve (ADR 0087). */
export function crosswordShare(
  { puzzle, cells }: Pick<CrossingCrosswordPlay, 'puzzle' | 'cells'>,
  { solveSeconds, hinted }: CrosswordSolve,
  strings: Strings,
  withTime: boolean,
): CrosswordShare {
  const time = withTime && solveSeconds !== undefined ? solveTimeText(solveSeconds) : undefined;
  const grid = cells.map((row) => row.map(({ kind }) => kind === 'cell'));
  const title = fill(strings.share.title, {
    n: String(daysOf(puzzle.date) - FIRST_DAY + 1),
  });
  const parts = [time, hinted ? undefined : strings.noHints].filter(
    (part): part is string => part !== undefined,
  );
  const line = parts.length === 0 ? undefined : parts.join(' · ');
  const rows = grid.map((row) =>
    row.map((open) => (open ? SHARED_CELL.open : SHARED_CELL.block)).join(''),
  );
  return { time, grid, title, line, message: [title, line, ...rows].filter(Boolean).join('\n') };
}
