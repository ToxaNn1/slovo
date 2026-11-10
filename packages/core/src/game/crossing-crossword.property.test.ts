import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { crossingPlacesOf } from '../index';
import { generateCrossingCrossword } from './crossing-crossword';
import { seededRandomOf } from './traced-crossword';
import {
  ALPHABET,
  ineligible,
  key,
  rowsOf,
  runsOf,
  vocabulary,
} from './crossing-crossword.test-support';

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261107, numRuns: 100 };

/** A local date of 2026 or 2027, `YYYY-MM-DD`. */
const dates = fc
  .integer({ min: 0, max: 729 })
  .map((days) => new Date(Date.UTC(2026, 0, 1 + days)).toISOString().slice(0, 10));

/** The Words within a Rarity Ceiling: at least forty of the vocabulary, in any order. */
const ceilings = fc.shuffledSubarray(vocabulary, { minLength: 40 });

describe('every generated crossing Daily Crossword', () => {
  it('agrees at every crossing, lies within the Rarity Ceiling, covers the grid and numbers in reading order', () => {
    let puzzles = 0;
    fc.assert(
      fc.property(dates, ceilings, (date, words) => {
        const generation = generateCrossingCrossword({
          date,
          words,
          alphabet: ALPHABET,
          seeded: seededRandomOf,
        });
        if (generation.kind === 'no-fill') return;
        puzzles += 1;
        const { puzzle } = generation;
        expect(puzzle.date).toBe(date);

        const eligible = new Set(words.map(({ id }) => id));
        const letters = new Map<string, string>();
        for (const w of puzzle.words) {
          expect(eligible.has(w.word.id)).toBe(true);
          expect(ineligible.has(w.word.lemma)).toBe(false);
          crossingPlacesOf(w).forEach((place, i) => {
            const letter = w.letters[i] ?? '';
            expect(letters.get(key(place)) ?? letter).toBe(letter);
            letters.set(key(place), letter);
          });
        }
        expect(new Set(puzzle.words.map((w) => w.word.id)).size).toBe(puzzle.words.length);

        const rows = rowsOf(puzzle);
        const lines = runsOf(rows).map((run) => run.map(key).join(' '));
        expect(lines.filter((line) => line.split(' ').length === 2)).toEqual([]);
        const whites = lines.flatMap((line) => line.split(' '));
        expect(whites.every((cell) => letters.has(cell))).toBe(true);
        for (const w of puzzle.words)
          expect(lines).toContain(crossingPlacesOf(w).map(key).join(' '));

        const starts = puzzle.words.map((w) => w.start.row * 5 + w.start.column);
        expect(starts).toEqual([...starts].sort((a, b) => a - b));
        const numbers = [...new Set(puzzle.words.map((w) => w.number))];
        expect(numbers).toEqual(numbers.map((_, i) => i + 1));

        for (const { place, letter } of puzzle.prefilled)
          expect(letters.get(key(place))).toBe(letter);
      }),
      runs,
    );
    expect(puzzles).toBeGreaterThan(runs.numRuns / 2);
  });
});
