import { describe, expect, it } from 'vitest';

import { CROSSWORD_SIZE, type Word } from '@slovo/contracts';

import {
  CROSSING_PATTERNS,
  crossingPlacesOf,
  generateCrossingCrossword,
  type CrossingGeneration,
} from './crossing-crossword';
import { seededRandomOf } from './seeded-random';
import {
  ALPHABET,
  crossingsOf,
  ineligible,
  key,
  puzzleOf,
  rowsOf,
  runsOf,
  vocabulary,
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

  it('keeps the puzzle of a fixed date and seed the same for every reader, from release to release', () => {
    const puzzle = puzzleOf('2026-11-07');
    const lines = [
      ...puzzle.words.map(
        ({ word: placed, direction, start, wheel }) =>
          `${placed.id} ${direction} ${String(start.row)}.${String(start.column)} ${wheel.join('')}`,
      ),
      ...puzzle.prefilled.map(
        ({ place, letter }) => `${String(place.row)}.${String(place.column)}=${letter}`,
      ),
    ];
    expect(lines).toMatchInlineSnapshot(`
      [
        "w_sloth across 0.0 oslhqt",
        "w_sheep down 0.0 hsetep",
        "w_hyena down 0.4 nhleay",
        "w_eagle across 2.0 zgeeal",
        "w_panda across 4.0 unadpa",
        "4.4=a",
        "0.4=h",
      ]
    `);
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
    const byStart = new Map<string, number>();
    for (const w of puzzle.words) {
      expect(byStart.get(key(w.start)) ?? w.number).toBe(w.number);
      byStart.set(key(w.start), w.number);
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

describe('the crossing Daily Crossword over many dates', () => {
  const dates = Array.from({ length: 12 }, (_, i) => `2026-12-${String(i + 10)}`);
  const eligible = vocabulary.filter(({ lemma }) => !ineligible.has(lemma));
  /** Each eligible Word again under a second id, and a capitalised copy that cannot fill. */
  const crowded = [
    ...vocabulary,
    ...eligible.map(({ lemma }) => word(`w2_${lemma}`, { lemma })),
    ...eligible.map(({ lemma }) => word(`w3_${lemma}`, { lemma: lemma.toUpperCase() })),
  ];
  const puzzles = dates.map((date) => puzzleOf(date, crowded));

  it('seeds the port with the date and the ids of the Words, one per line', () => {
    const seeds: string[] = [];
    generateCrossingCrossword({
      date: '2026-11-07',
      words: [word('w_cat'), word('w_dog')],
      alphabet: ALPHABET,
      seeded: (seed) => {
        seeds.push(seed);
        return seededRandomOf(seed);
      },
    });
    expect(seeds).toEqual(['2026-11-07\nw_cat\nw_dog']);
  });

  it('lists as blocks exactly the cells of the grid no Word covers', () => {
    for (const puzzle of puzzles) {
      const covered = new Set(puzzle.words.flatMap((w) => crossingPlacesOf(w).map(key)));
      const free = Array.from({ length: CROSSWORD_SIZE ** 2 }, (_, i) =>
        key({ row: Math.floor(i / CROSSWORD_SIZE), column: i % CROSSWORD_SIZE }),
      ).filter((cell) => !covered.has(cell));
      expect(puzzle.blocks.map(key).sort()).toEqual(free.sort());
    }
  });

  it('uses each Lemma once and never one with a letter outside the alphabet', () => {
    for (const puzzle of puzzles) {
      const lemmas = puzzle.words.map((w) => w.word.lemma);
      expect(new Set(lemmas).size).toBe(lemmas.length);
      for (const lemma of lemmas) expect(lemma).toBe(lemma.toLowerCase());
    }
  });

  it('pre-fills two cells on some dates and three on others, never a whole Word', () => {
    expect(new Set(puzzles.map(({ prefilled }) => prefilled.length))).toEqual(new Set([2, 3]));
    for (const puzzle of puzzles) {
      const filled = new Set(puzzle.prefilled.map(({ place }) => key(place)));
      for (const w of puzzle.words)
        expect(crossingPlacesOf(w).every((place) => filled.has(key(place)))).toBe(false);
    }
  });

  it('draws the decoys from the whole alphabet, never a letter of the Word', () => {
    const decoys = new Set<string>();
    for (const w of puzzles.flatMap(({ words }) => words)) {
      const rest = [...w.wheel];
      for (const letter of w.letters) rest.splice(rest.indexOf(letter), 1);
      const [decoy = ''] = rest;
      expect(w.letters).not.toContain(decoy);
      decoys.add(decoy);
    }
    expect(decoys.size).toBeGreaterThan(5);
  });
});

describe('the Words that can fill the crossing Daily Crossword', () => {
  /**
   * Words that fill one pattern only, the one with a 3-letter Word:
   *
   *     g # # # b
   *     h # a # a
   *     o t t e r
   *     s # e # n
   *     t # # # s
   */
  const frame = [word('w_ghost'), word('w_barns'), word('w_otter'), word('w_ate')];

  const generated = (words: readonly Word[], alphabet: readonly string[] = ALPHABET) =>
    generateCrossingCrossword({ date: '2026-11-07', words, alphabet, seeded: seededRandomOf });

  const lemmasOf = (generation: CrossingGeneration) =>
    generation.kind === 'puzzle' ? generation.puzzle.words.map((w) => w.word.lemma).sort() : [];

  it('fills a 3-letter Word', () => {
    expect(lemmasOf(generated(frame))).toEqual(['ate', 'barns', 'ghost', 'otter']);
  });

  it('never fills with a Lemma that has one letter outside the alphabet', () => {
    const capital = frame.map((w) => (w.id === 'w_ghost' ? word('w_Ghost') : w));
    expect(generated(capital)).toEqual({ kind: 'no-fill' });
  });

  it('never fills with a Lemma that uses every letter of the alphabet, which leaves no decoy', () => {
    const words = [word('w_ddaee'), word('w_aaeaa'), word('w_abcde'), word('w_aca')];
    expect(generated(words, ['a', 'b', 'c', 'd', 'e'])).toEqual({ kind: 'no-fill' });
    expect(lemmasOf(generated(words, ['a', 'b', 'c', 'd', 'e', 'f']))).toEqual([
      'aaeaa',
      'abcde',
      'aca',
      'ddaee',
    ]);
  });

  it('takes the first Word of a Lemma in the Language Pack order, never a later one', () => {
    const twice = [...frame, word('w2_ghost', { lemma: 'ghost' })];
    for (const date of ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']) {
      const generation = generateCrossingCrossword({
        date,
        words: twice,
        alphabet: ALPHABET,
        seeded: seededRandomOf,
      });
      const ids = generation.kind === 'puzzle' ? generation.puzzle.words.map((w) => w.word.id) : [];
      expect(ids).toContain('w_ghost');
    }
  });

  it('gives up a pattern past the search budget rather than a part-filled grid', () => {
    // A thousand and one 5-letter Words, each with `a` in its middle and none
    // starting with it: every pattern needs a Word that starts where another
    // has its middle, so none fills, and each first slot alone has more
    // Words than the budget.
    const starts = ALPHABET.filter((letter) => letter !== 'a');
    const many = Array.from({ length: 1001 }, (_, i) => {
      const lemma = [
        starts[i % starts.length] ?? 'b',
        ALPHABET[Math.floor(i / starts.length) % ALPHABET.length] ?? 'b',
        'a',
        ALPHABET[Math.floor(i / (starts.length * ALPHABET.length))] ?? 'b',
        'x',
      ].join('');
      return word(`w_${lemma}`);
    });
    expect(generated(many)).toEqual({ kind: 'no-fill' });
    // The search runs past its whole budget: well under a second, but several
    // times slower under mutation testing's instrumented code.
  }, 30_000);
});
