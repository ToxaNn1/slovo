import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  isSolved,
  type CrosswordPuzzle,
  type PuzzleAction,
  type PuzzlePlace,
  type PuzzleState,
} from '../index';
import { generateCrosswordPuzzle, playPuzzle, startPuzzle } from './crossword-puzzle';
import { seededRandom, word } from '../test-support';

/** Twelve Words of 3–7 letters, a stressed one among them, and two that cannot hide: a phrase and a capital. */
const words = [
  word('w_кіт'),
  word('w_дім'),
  word('w_ліс'),
  word('w_вовк'),
  word('w_сова', { stress: [1] }),
  word('w_річка'),
  word('w_весна'),
  word('w_яблуко'),
  word('w_веселка'),
  word('w_зоря'),
  word('w_вітер'),
  word('w_сонце'),
  word('w_дике поле'),
  word('w_Київ'),
];

function puzzleOf(seed: number, from = words): CrosswordPuzzle {
  const generation = generateCrosswordPuzzle({
    date: '2026-11-04',
    words: from,
    random: seededRandom(seed),
  });
  if (generation.kind !== 'puzzle') throw new Error('Expected a puzzle');
  return generation.puzzle;
}

const key = ({ row, column }: PuzzlePlace) => `${String(row)},${String(column)}`;

describe('the crossword puzzle generator', () => {
  it('uses every cell once, each path 8-adjacent and self-avoiding, spelling its Word', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), (seed) => {
        const puzzle = puzzleOf(seed);
        const cells = puzzle.words.flatMap(({ path }) => path.map(key));
        expect(new Set(cells).size).toBe(25);
        expect(cells).toHaveLength(25);
        for (const { word: hidden, path } of puzzle.words) {
          expect(new Set(path.map(key)).size).toBe(path.length);
          path.slice(1).forEach((place, i) => {
            const before = path[i] ?? place;
            const step = Math.max(
              Math.abs(place.row - before.row),
              Math.abs(place.column - before.column),
            );
            expect(step).toBe(1);
          });
          const spelled = path.map(({ row, column }) => puzzle.grid[row]?.[column]?.letter);
          expect(spelled.join('')).toBe(hidden.lemma);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('hides only Words of 3–8 lowercase letters, each with its primary Definition as the clue', () => {
    const puzzle = puzzleOf(3);
    for (const { word: hidden, clue } of puzzle.words) {
      expect(hidden.lemma).toMatch(/^\p{Ll}{3,8}$/u);
      expect(clue).toBe(hidden.primaryDefinition);
    }
  });

  it('marks the stressed letters of a hidden Word', () => {
    const sova = word('w_сова', { stress: [1] });
    const puzzle = puzzleOf(1, [
      sova,
      word('w_вовк'),
      word('w_зоря'),
      word('w_кіт'),
      word('w_сонце'),
      word('w_річка'),
    ]);
    const hidden = puzzle.words.find(({ word: { id } }) => id === sova.id);
    const marks = hidden?.path.map(({ row, column }) => puzzle.grid[row]?.[column]?.stressed);
    expect(marks).toEqual([false, true, false, false]);
  });

  it('gives the same grid for the same Words and seed, and another for another seed', () => {
    expect(puzzleOf(42)).toEqual(puzzleOf(42));
    expect(puzzleOf(42).grid).not.toEqual(puzzleOf(43).grid);
  });

  it('fails with no-tiling when the Words cannot fill the 25 cells', () => {
    const fiveOfFour = ['w_вовк', 'w_сова', 'w_зоря', 'w_рука', 'w_нога'].map((id) => word(id));
    expect(
      generateCrosswordPuzzle({ date: '2026-11-04', words: fiveOfFour, random: seededRandom(1) }),
    ).toEqual({ kind: 'no-tiling' });
    expect(
      generateCrosswordPuzzle({ date: '2026-11-04', words: [], random: seededRandom(1) }),
    ).toEqual({ kind: 'no-tiling' });
  });
});

describe('playing the puzzle', () => {
  const puzzle = puzzleOf(7);
  const [first, second] = puzzle.words;
  if (first === undefined || second === undefined) throw new Error('Expected hidden Words');

  const play = (actions: readonly PuzzleAction[], from: PuzzleState = startPuzzle(puzzle)) =>
    actions.reduce((state, action) => playPuzzle(puzzle, state, action), from);
  const trace = (path: readonly PuzzlePlace[]): PuzzleAction[] =>
    path.map((place) => ({ type: 'extend', place }));

  it('starts with every Word hidden and no trace', () => {
    const state = startPuzzle(puzzle);
    expect(state.trace).toEqual([]);
    expect(state.words.every((hidden) => hidden.kind === 'hidden')).toBe(true);
    expect(isSolved(state)).toBe(false);
  });

  it('traces adjacent cells and skips a cell that does not touch the last, is on the trace or is off the grid', () => {
    const state = play([
      { type: 'extend', place: { row: 0, column: 0 } },
      { type: 'extend', place: { row: 0, column: 1 } },
      { type: 'extend', place: { row: 1, column: 1 } },
      { type: 'extend', place: { row: 3, column: 3 } },
      { type: 'extend', place: { row: 0, column: 0 } },
      { type: 'extend', place: { row: 2, column: 2 } },
      { type: 'extend', place: { row: 2, column: 3 } },
      { type: 'extend', place: { row: 2, column: 5 } },
    ]);
    expect(state.trace).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 1 },
      { row: 2, column: 2 },
      { row: 2, column: 3 },
    ]);
  });

  it('steps back on the cell before the last, or by the step back action', () => {
    const dragged = play([
      { type: 'extend', place: { row: 0, column: 0 } },
      { type: 'extend', place: { row: 0, column: 1 } },
      { type: 'extend', place: { row: 0, column: 2 } },
      { type: 'extend', place: { row: 0, column: 1 } },
    ]);
    expect(dragged.trace).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
    ]);
    expect(play([{ type: 'stepBack' }], dragged).trace).toEqual([{ row: 0, column: 0 }]);
  });

  it('locks a traced Word on release and clears the trace', () => {
    const state = play([...trace(first.path), { type: 'release' }]);
    expect(state.words[0]).toEqual({ kind: 'found' });
    expect(state.words.slice(1).every((hidden) => hidden.kind === 'hidden')).toBe(true);
    expect(state.trace).toEqual([]);
  });

  it('clears a trace that is not a hidden Word, read backwards included, and locks nothing', () => {
    const backwards = play([...trace([...first.path].reverse()), { type: 'release' }]);
    const partial = play([...trace(first.path.slice(0, -1)), { type: 'release' }]);
    for (const state of [backwards, partial]) {
      expect(state.trace).toEqual([]);
      expect(state.words.every((hidden) => hidden.kind === 'hidden')).toBe(true);
    }
  });

  it('keeps the cells of a found Word out of a new trace', () => {
    const found = play([...trace(first.path), { type: 'release' }]);
    const [cell] = first.path;
    expect(play(trace(cell === undefined ? [] : [cell]), found).trace).toEqual([]);
  });

  it('is solved when every hidden Word is found, and takes no more actions', () => {
    const solved = play(puzzle.words.flatMap(({ path }) => [...trace(path), { type: 'release' }]));
    expect(isSolved(solved)).toBe(true);
    expect(play([{ type: 'extend', place: { row: 0, column: 0 } }], solved)).toBe(solved);
  });

  it('restores the Words found', () => {
    const state = startPuzzle(puzzle, [second.word.id]);
    expect(state.words[1]).toEqual({ kind: 'found' });
    expect(state.words.filter((hidden) => hidden.kind === 'found')).toHaveLength(1);
  });
});
