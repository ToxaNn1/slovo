import { describe, expect, it } from 'vitest';

import { CROSSWORD_SIZE } from '@slovo/contracts';

import { crossingPlacesOf } from '../index';
import { CROSSING_PATTERNS, generateCrossingCrossword } from './crossing-crossword';
import { seededRandomOf } from './traced-crossword';
import {
  ALPHABET,
  crossingsOf,
  ineligible,
  key,
  puzzleOf,
  rowsOf,
  runsOf,
} from './crossing-crossword.test-support';
import { word } from '../test-support';

describe('the crossing Daily Crossword generator', () => {
  it('gives the same puzzle for the same inputs and another for another date', () => {
    const a = puzzleOf('2026-11-07');
    expect(puzzleOf('2026-11-07')).toEqual(a);
    const b = puzzleOf('2026-11-08');
    expect(b.date).toBe('2026-11-08');
    expect(b.words.map((w) => w.word.id)).not.toEqual(a.words.map((w) => w.word.id));
  });

  it('puts every white cell in a Word of 3–5 letters, with no run of exactly two cells', () => {
    const puzzle = puzzleOf('2026-11-07');
    const rows = rowsOf(puzzle);
    const runs = runsOf(rows);
    expect(runs.every((run) => run.length !== 2)).toBe(true);
    const whites = rows.flatMap((row, r) =>
      Array.from(row).flatMap((cell, c) => (cell === '.' ? [key({ row: r, column: c })] : [])),
    );
    const covered = new Set(puzzle.words.flatMap((w) => crossingPlacesOf(w).map(key)));
    expect([...covered].sort()).toEqual([...whites].sort());
    expect(puzzle.words.length).toBeGreaterThanOrEqual(3);
    expect(puzzle.words.length).toBeLessThanOrEqual(8);
    const lines = runs.map((run) => run.map(key).join(' '));
    for (const w of puzzle.words) {
      expect(w.letters.length).toBeGreaterThanOrEqual(3);
      expect(w.letters.length).toBeLessThanOrEqual(5);
      expect(w.letters.join('')).toBe(w.word.lemma);
      expect(w.clue).toBe(w.word.primaryDefinition);
      expect(lines).toContain(crossingPlacesOf(w).map(key).join(' '));
    }
  });

  it('numbers the Words in reading order of their first cell, one number per cell', () => {
    const puzzle = puzzleOf('2026-11-07');
    const byNumber = new Map<number, number>();
    for (const w of puzzle.words) {
      const order = w.start.row * CROSSWORD_SIZE + w.start.column;
      expect(byNumber.get(w.number) ?? order).toBe(order);
      byNumber.set(w.number, order);
    }
    const numbers = [...byNumber.entries()].sort((a, b) => a[1] - b[1]).map(([number]) => number);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    const listed = puzzle.words.map((w) => w.number);
    expect(listed).toEqual([...listed].sort((a, b) => a - b));
  });

  it('pre-fills two or three crossing cells with their letter and never a whole Word', () => {
    for (const date of ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']) {
      const puzzle = puzzleOf(date);
      const crossings = crossingsOf(puzzle);
      expect(puzzle.prefilled.length).toBeGreaterThanOrEqual(2);
      expect(puzzle.prefilled.length).toBeLessThanOrEqual(3);
      const filled = new Map(puzzle.prefilled.map(({ place, letter }) => [key(place), letter]));
      expect(filled.size).toBe(puzzle.prefilled.length);
      for (const k of filled.keys()) expect(crossings.has(k)).toBe(true);
      for (const w of puzzle.words) {
        const places = crossingPlacesOf(w);
        expect(places.some((place) => !filled.has(key(place)))).toBe(true);
        places.forEach((place, i) => {
          const letter = filled.get(key(place));
          if (letter !== undefined) expect(letter).toBe(w.letters[i]);
        });
      }
    }
  });

  it("builds each Word's wheel from its letters, repeats kept, plus one decoy of the alphabet not in it", () => {
    const puzzle = puzzleOf('2026-11-07');
    for (const w of puzzle.words) {
      expect(w.wheel).toHaveLength(w.letters.length + 1);
      const rest = [...w.wheel];
      for (const letter of w.letters) {
        const at = rest.indexOf(letter);
        expect(at).toBeGreaterThanOrEqual(0);
        rest.splice(at, 1);
      }
      expect(rest).toHaveLength(1);
      const decoy = rest[0] ?? '';
      expect(ALPHABET).toContain(decoy);
      expect(w.letters).not.toContain(decoy);
    }
  });

  it('never uses a Word whose Lemma is not 3–5 lowercase letters of the alphabet, nor a Word twice', () => {
    const lemmas = puzzleOf('2026-11-07').words.map((w) => w.word.lemma);
    expect(lemmas.some((lemma) => ineligible.has(lemma))).toBe(false);
    expect(new Set(lemmas).size).toBe(lemmas.length);
  });

  it('answers no-fill when no pattern fills', () => {
    const few = [word('w_cat'), word('w_dog'), word('w_Kyiv'), word('w_rainbow')];
    expect(
      generateCrossingCrossword({
        date: '2026-11-07',
        words: few,
        alphabet: ALPHABET,
        seeded: seededRandomOf,
      }),
    ).toEqual({ kind: 'no-fill' });
  });

  it('lists only symmetric patterns of 3–8 Words of 3–5 letters, with no run of two and no cell outside a Word', () => {
    expect(CROSSING_PATTERNS).toContainEqual(['.....', '.#.#.', '.....', '.#.#.', '.....']);
    for (const pattern of CROSSING_PATTERNS) {
      expect(pattern).toHaveLength(CROSSWORD_SIZE);
      const turned = [...pattern].reverse().map((row) => Array.from(row).reverse().join(''));
      expect(turned).toEqual(pattern);
      const runs = runsOf(pattern);
      const words = runs.filter((run) => run.length >= 3);
      expect(runs.some((run) => run.length === 2)).toBe(false);
      expect(words.length).toBeGreaterThanOrEqual(3);
      expect(words.length).toBeLessThanOrEqual(8);
      const covered = new Set(words.flat().map(key));
      expect(runs.flat().every((place) => covered.has(key(place)))).toBe(true);
    }
  });
});
