import fc from 'fast-check';
import { describe, it } from 'vitest';

import {
  CROSSWORD_SIZE,
  CrosswordDaySchema,
  type CrosswordDay,
  type CrosswordWord,
} from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openDailyCrossword,
  openUserState,
  type CrosswordPlace,
  type DailyCrossword,
  type DailyCrosswordWord,
} from '../index';
import { fakeClock } from '../test-support';

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261027, numRuns: 100 };

const DATE = '2026-10-11';

/** A word as the grid lays it out: its first cell, the way it reads and its length. */
interface Layout {
  readonly row: number;
  readonly column: number;
  readonly direction: 'across' | 'down';
  readonly length: number;
}

/**
 * A comb: an across word of five letters on row `top`, a down word of 3 or
 * more letters hanging from each of columns 0, 2 and 4, and, when all three
 * reach row `top + gap`, another across word of five letters there. Every
 * run of letters is so one of the words, and every word crosses another.
 */
const combs: fc.Arbitrary<Layout[]> = fc
  .integer({ min: 0, max: CROSSWORD_SIZE - 3 })
  .chain((top) =>
    fc.record({
      top: fc.constant(top),
      downs: fc.tuple(...[0, 2, 4].map(() => fc.integer({ min: 3, max: CROSSWORD_SIZE - top }))),
      gap: fc.integer({ min: 2, max: CROSSWORD_SIZE - 1 - top }),
      bottom: fc.boolean(),
    }),
  )
  .map(({ top, downs, gap, bottom }) => [
    { row: top, column: 0, direction: 'across' as const, length: CROSSWORD_SIZE },
    ...downs.map((length, i) => ({ row: top, column: i * 2, direction: 'down' as const, length })),
    ...(bottom && downs.every((length) => length > gap)
      ? [{ row: top + gap, column: 0, direction: 'across' as const, length: CROSSWORD_SIZE }]
      : []),
  ]);

/** A layout turned over its diagonal: rows become columns and across down. */
const transposed = ({ row, column, direction, length }: Layout): Layout => ({
  row: column,
  column: row,
  direction: direction === 'across' ? 'down' : 'across',
  length,
});

const placesOf = ({ row, column, direction, length }: Layout): CrosswordPlace[] =>
  Array.from({ length }, (_, i) =>
    direction === 'across' ? { row, column: column + i } : { row: row + i, column },
  );

/**
 * A Daily Crossword day the contract accepts: a comb, maybe turned over,
 * its words in any order, read off a grid of random lowercase letters.
 */
const days: fc.Arbitrary<CrosswordDay> = fc
  .record({
    layouts: combs,
    turned: fc.boolean(),
    grid: fc.array(
      fc.array(fc.constantFrom(...Array.from('абвгґдеєжзиіїйк')), { minLength: 5, maxLength: 5 }),
      {
        minLength: 5,
        maxLength: 5,
      },
    ),
  })
  .chain(({ layouts, turned, grid }) =>
    fc
      .shuffledSubarray(turned ? layouts.map(transposed) : layouts, {
        minLength: layouts.length,
      })
      .map((ordered) =>
        CrosswordDaySchema.parse({
          date: DATE,
          words: ordered.map((layout, i) => ({
            entryId: `w_${String(i)}`,
            answer: placesOf(layout)
              .map(({ row, column }) => grid[row]?.[column])
              .join(''),
            clue: `Clue ${String(i)}`,
            row: layout.row,
            column: layout.column,
            direction: layout.direction,
          })),
        }),
      ),
  );

/** Today's Daily Crossword over a pack holding the one day, with nothing typed yet. */
async function open(day: CrosswordDay): Promise<DailyCrossword> {
  const crossword = await openDailyCrossword({
    content: { crosswordDay: (date) => Promise.resolve(date === day.date ? day : undefined) },
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: fakeClock(`${DATE}T09:00:00+03:00`).clock,
    edition: { isFeatureEnabled: () => true },
  });
  if (crossword === undefined) throw new Error('The Daily Crossword did not open');
  return crossword;
}

const layoutOf = ({ start, direction, length }: DailyCrosswordWord): Layout => ({
  ...start,
  direction,
  length,
});

/** The cells of a word of the day, from its first letter on. */
const cellsOf = (word: CrosswordWord) =>
  placesOf({ ...word, length: Array.from(word.answer).length });

const keyOf = ({ row, column }: CrosswordPlace) => `${String(row)},${String(column)}`;

describe('the Daily Crossword, for every day the contract accepts', () => {
  it('places each word once, where the day puts its answer and as long as it', async () => {
    await fc.assert(
      fc.asyncProperty(days, async (day) => {
        const { words } = (await open(day)).state;
        return (
          words.length === day.words.length &&
          day.words.every(
            ({ row, column, direction, answer }, i) =>
              words[i]?.start.row === row &&
              words[i].start.column === column &&
              words[i].direction === direction &&
              words[i].length === Array.from(answer).length,
          )
        );
      }),
      runs,
    );
  });

  it('overlaps two words only where an across word crosses a down word', async () => {
    await fc.assert(
      fc.asyncProperty(days, async (day) => {
        const covers = new Map<string, DailyCrosswordWord['direction'][]>();
        for (const word of (await open(day)).state.words)
          for (const place of placesOf(layoutOf(word)))
            covers.set(keyOf(place), [...(covers.get(keyOf(place)) ?? []), word.direction]);
        return [...covers.values()].every(
          (directions) =>
            directions.length === 1 || [...directions].sort().join() === 'across,down',
        );
      }),
      runs,
    );
  });

  it('agrees at every crossing: opening every cell solves every word and reads each answer', async () => {
    await fc.assert(
      fc.asyncProperty(
        days.chain((day) => {
          const places = day.words.flatMap(cellsOf);
          return fc.tuple(
            fc.constant(day),
            fc.shuffledSubarray(places, { minLength: places.length }),
          );
        }),
        async ([day, order]) => {
          const crossword = await open(day);
          for (const place of order) await crossword.openCell(place);
          const { letters, words, progress } = crossword.state;
          const reads = (word: CrosswordWord) =>
            cellsOf(word)
              .map(({ row, column }) => letters[row]?.[column] ?? '.')
              .join('');
          const cells = new Set(order.map(keyOf));
          return (
            letters.every((line, row) =>
              line.every(
                (letter, column) => (letter !== undefined) === cells.has(keyOf({ row, column })),
              ),
            ) &&
            progress === 'solved' &&
            words.every(({ right }) => right) &&
            day.words.every((word) => reads(word) === word.answer)
          );
        },
      ),
      runs,
    );
  });
});
