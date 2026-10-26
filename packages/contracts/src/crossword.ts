import { z } from 'zod';

import { CorrectionIdSchema } from './correction';
import { TextSchema } from './shared';
import { WordIdSchema } from './word';

/** The Daily Crossword's grid is this many cells wide and high (ADR 0052). */
export const CROSSWORD_SIZE = 5;

/** The fewest and most words of a day. */
export const CROSSWORD_WORDS = { min: 4, max: 6 } as const;

const CellIndexSchema = z
  .int()
  .min(0)
  .max(CROSSWORD_SIZE - 1);

/**
 * One word of a Daily Crossword: the Word or Correction it comes from, its
 * answer in lowercase letters, its clue (the Word's primary Definition or the
 * Correction's explanation, as they read when the day was made), the cell of
 * its first letter and the way it reads.
 */
export const CrosswordWordSchema = z.strictObject({
  entryId: z.union([WordIdSchema, CorrectionIdSchema]),
  answer: z.string().regex(/^\p{Ll}{3,5}$/u, 'Expected 3–5 lowercase letters'),
  clue: TextSchema,
  row: CellIndexSchema,
  column: CellIndexSchema,
  direction: z.enum(['across', 'down']),
});

export type CrosswordWord = z.infer<typeof CrosswordWordSchema>;

/**
 * The Daily Crossword of one date, `YYYY-MM-DD`: 4–6 words on a 5 × 5 grid.
 * Every word lies inside the grid and crosses another, all of them hang
 * together, crossing words agree on their shared letter, and every run of two
 * or more letters in a row or a column is one of the words, so the grid reads
 * nothing but its words.
 */
export const CrosswordDaySchema = z
  .strictObject({
    date: z.iso.date(),
    words: z.array(CrosswordWordSchema).min(CROSSWORD_WORDS.min).max(CROSSWORD_WORDS.max),
  })
  .superRefine(({ words }, context) => {
    for (const problem of crosswordGridProblems(words))
      context.addIssue({ code: 'custom', ...problem });
  });

export type CrosswordDay = z.infer<typeof CrosswordDaySchema>;

/** The days of an Edition's Daily Crossword, in date order. */
export const CrosswordDaysSchema = z
  .array(CrosswordDaySchema)
  .refine(
    (days) => days.every((day, i) => i === 0 || day.date > (days[i - 1]?.date ?? '')),
    'Expected the days in date order without repeats',
  );

/** The cells a word covers, as `row,column`, from its first letter on. */
function crosswordCells({ answer, row, column, direction }: CrosswordWord): string[] {
  return Array.from(answer).map((_, i) =>
    direction === 'across'
      ? `${String(row)},${String(column + i)}`
      : `${String(row + i)},${String(column)}`,
  );
}

/**
 * What keeps words from making a crossword grid, located by the path of the
 * word at fault within a day; none when they make one. It checks any number
 * of words.
 */
function crosswordGridProblems(
  words: readonly CrosswordWord[],
): { path: PropertyKey[]; message: string }[] {
  const problems: { path: PropertyKey[]; message: string }[] = [];
  const letters = new Map<string, string>();
  words.forEach((word, i) => {
    const cells = crosswordCells(word);
    const [lastRow, lastColumn] = (cells.at(-1) ?? '').split(',').map(Number);
    if ((lastRow ?? 0) >= CROSSWORD_SIZE || (lastColumn ?? 0) >= CROSSWORD_SIZE) {
      problems.push({ path: ['words', i], message: 'Runs past the edge of the grid' });
      return;
    }
    const answer = Array.from(word.answer);
    cells.forEach((cell, j) => {
      const letter = answer[j] ?? '';
      const placed = letters.get(cell);
      if (placed !== undefined && placed !== letter) {
        problems.push({
          path: ['words', i, 'answer'],
          message: `Disagrees with a crossing word at cell ${cell}`,
        });
      }
      letters.set(cell, letter);
    });
  });
  if (problems.length > 0) return problems;

  const placed = new Set(
    words.map((word) => `${word.direction} ${crosswordCells(word)[0] ?? ''} ${word.answer}`),
  );
  for (const run of letterRuns(letters)) {
    if (!placed.has(run)) {
      problems.push({
        path: ['words'],
        message: `The grid reads a run that is not one of its words: ${run}`,
      });
    }
  }
  if (!hangTogether(words)) {
    problems.push({
      path: ['words'],
      message: 'Every word must cross another, and all must hang together',
    });
  }
  return problems;
}

/** Every run of two or more letters, as `direction row,column letters`. */
function letterRuns(letters: ReadonlyMap<string, string>): string[] {
  const runs: string[] = [];
  for (const direction of ['across', 'down'] as const) {
    for (let line = 0; line < CROSSWORD_SIZE; line += 1) {
      let start = 0;
      let run = '';
      for (let i = 0; i <= CROSSWORD_SIZE; i += 1) {
        const cell =
          direction === 'across' ? `${String(line)},${String(i)}` : `${String(i)},${String(line)}`;
        const letter = i < CROSSWORD_SIZE ? letters.get(cell) : undefined;
        if (letter !== undefined) {
          if (run === '') start = i;
          run += letter;
          continue;
        }
        if (Array.from(run).length >= 2) {
          const first =
            direction === 'across'
              ? `${String(line)},${String(start)}`
              : `${String(start)},${String(line)}`;
          runs.push(`${direction} ${first} ${run}`);
        }
        run = '';
      }
    }
  }
  return runs;
}

function hangTogether(words: readonly CrosswordWord[]): boolean {
  const cells = words.map((word) => new Set(crosswordCells(word)));
  const reached = new Set([0]);
  const queue = [0];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const from = cells[next] ?? new Set<string>();
    cells.forEach((other, i) => {
      if (!reached.has(i) && [...other].some((cell) => from.has(cell))) {
        reached.add(i);
        queue.push(i);
      }
    });
  }
  return reached.size === words.length;
}
