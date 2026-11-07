import { describe, expect, it } from 'vitest';

import { word } from '../test-support';
import type { CrossingDirection, CrossingPuzzle, CrossingWord } from './crossing-crossword';
import {
  crossingCellKey,
  isCrossingSolved,
  playCrossing,
  startCrossingPlay,
  type CrossingAction,
  type CrossingPlay,
} from './crossing-play';

/** A Word of the hand-laid puzzle: its letters plus the decoy `z` on the wheel, in order. */
function wordOf(
  number: number,
  direction: CrossingDirection,
  start: { row: number; column: number },
  lemma: string,
): CrossingWord {
  const letters = lemma.split('');
  return {
    number,
    direction,
    start,
    word: word(`w_${lemma}`),
    clue: `The meaning of ${lemma}.`,
    letters,
    wheel: [...letters, 'z'],
  };
}

/**
 * The top-left corner of the grid:
 *
 *     c a t # #
 *     o n o # #
 *     w t e # #
 *
 * 1-across «cat» crosses 1-down «cow», 2-down «ant» and 3-down «toe» in
 * every cell; the `t` of (0,2) comes pre-filled.
 */
const puzzle: CrossingPuzzle = {
  date: '2026-11-04',
  blocks: [0, 1, 2, 3, 4].flatMap((row) =>
    [0, 1, 2, 3, 4].filter((column) => column > 2 || row > 2).map((column) => ({ row, column })),
  ),
  words: [
    wordOf(1, 'across', { row: 0, column: 0 }, 'cat'),
    wordOf(1, 'down', { row: 0, column: 0 }, 'cow'),
    wordOf(2, 'down', { row: 0, column: 1 }, 'ant'),
    wordOf(3, 'down', { row: 0, column: 2 }, 'toe'),
  ],
  prefilled: [{ place: { row: 0, column: 2 }, letter: 't' }],
};

const [CAT, COW, ANT, TOE] = [0, 1, 2, 3];

const play = (state: CrossingPlay, ...actions: CrossingAction[]) =>
  actions.reduce((before, action) => playCrossing(puzzle, before, action), state);

const select = (row: number, column: number): CrossingAction => ({
  type: 'select',
  place: { row, column },
});

/** The actions that trace the letters on the current Word's wheel and release. */
function traced(state: CrossingPlay, letters: string): CrossingAction[] {
  const wheel = puzzle.words[state.current]?.wheel ?? [];
  const used = new Set<number>();
  const tiles = letters.split('').map((letter) => {
    const tile = wheel.findIndex((candidate, i) => candidate === letter && !used.has(i));
    used.add(tile);
    return tile;
  });
  return [...tiles.map((tile): CrossingAction => ({ type: 'extend', tile })), { type: 'release' }];
}

/** The state with the Words of these indexes traced and released, in order. */
function solved(...indexes: number[]): CrossingPlay {
  return indexes.reduce((state, index) => {
    const target = puzzle.words[index];
    if (!target) throw new Error('No such Word');
    const picked = play(state, select(target.start.row, target.start.column));
    const current =
      picked.current === index
        ? picked
        : play(picked, select(target.start.row, target.start.column));
    return play(current, ...traced(current, target.letters.join('')));
  }, startCrossingPlay(puzzle));
}

describe('the crossing Daily Crossword play', () => {
  it('starts with the pre-filled cells, every other cell empty, every Word open and the first Word current', () => {
    const state = startCrossingPlay(puzzle);
    expect(Object.keys(state.cells)).toHaveLength(9);
    expect(state.cells[crossingCellKey({ row: 0, column: 2 })]).toEqual({
      kind: 'prefilled',
      letter: 't',
    });
    expect(state.cells[crossingCellKey({ row: 1, column: 1 })]).toEqual({ kind: 'empty' });
    expect(state.cells[crossingCellKey({ row: 4, column: 4 })]).toBeUndefined();
    expect(state.words).toEqual(puzzle.words.map(() => ({ kind: 'open' })));
    expect(state).toMatchObject({ current: CAT, trace: [], hinted: false, seconds: 0 });
    expect(isCrossingSolved(state)).toBe(false);
  });

  it('starts from the progress kept: filled cells, solved Words, hinted and the seconds, the current Word the first open', () => {
    const state = startCrossingPlay(puzzle, {
      filled: { '0,0': 'c', '1,0': 'o', '2,0': 'w' },
      solved: ['w_cow'],
      hinted: true,
      seconds: 42,
    });
    expect(state.cells[crossingCellKey({ row: 1, column: 0 })]).toEqual({
      kind: 'filled',
      letter: 'o',
    });
    expect(state.words[COW]).toEqual({ kind: 'solved' });
    expect(state.words[CAT]).toEqual({ kind: 'open' });
    expect(state).toMatchObject({ current: CAT, hinted: true, seconds: 42 });
    expect(
      startCrossingPlay(puzzle, { filled: {}, solved: ['w_cat'], hinted: false, seconds: 0 }),
    ).toMatchObject({ current: COW });
  });

  describe('select', () => {
    it('picks the Word through the cell', () => {
      expect(play(startCrossingPlay(puzzle), select(1, 1)).current).toBe(ANT);
      expect(play(startCrossingPlay(puzzle), select(2, 2)).current).toBe(TOE);
    });

    it('switches direction on a second tap on a crossing, and back', () => {
      const first = play(startCrossingPlay(puzzle), select(0, 0));
      expect(first.current).toBe(COW);
      expect(play(first, select(0, 0)).current).toBe(CAT);
      expect(play(startCrossingPlay(puzzle), select(0, 1)).current).toBe(ANT);
    });

    it('keeps the Word on a tap on its own cell with no crossing, and ignores a block', () => {
      const state = play(startCrossingPlay(puzzle), select(1, 1), { type: 'extend', tile: 0 });
      expect(play(state, select(2, 1))).toEqual(state);
      expect(play(state, select(4, 4))).toEqual(state);
    });

    it('drops the trace', () => {
      const state = play(startCrossingPlay(puzzle), { type: 'extend', tile: 0 });
      expect(play(state, select(1, 1)).trace).toEqual([]);
    });
  });

  describe('next', () => {
    it('moves to the next open Word in number order and wraps', () => {
      const state = startCrossingPlay(puzzle);
      expect(play(state, { type: 'next' }).current).toBe(COW);
      expect(play(state, select(2, 2), { type: 'next' }).current).toBe(CAT);
    });

    it('skips a solved Word and drops the trace', () => {
      const state = play(solved(COW), select(0, 1), { type: 'extend', tile: 0 });
      expect(state.current).toBe(CAT);
      expect(play(state, { type: 'next' })).toMatchObject({ current: ANT, trace: [] });
    });

    it('stays when no other Word is open', () => {
      const state = solved(CAT, COW, ANT);
      expect(state.current).toBe(TOE);
      expect(play(state, { type: 'next' }).current).toBe(TOE);
    });
  });

  describe('the wheel trace', () => {
    it('extends onto a tile not on it, steps back onto the tile before the last and ignores the rest', () => {
      const state = play(
        startCrossingPlay(puzzle),
        { type: 'extend', tile: 0 },
        { type: 'extend', tile: 1 },
      );
      expect(state.trace).toEqual([0, 1]);
      expect(play(state, { type: 'extend', tile: 1 })).toEqual(state);
      expect(play(state, { type: 'extend', tile: 0 }).trace).toEqual([0]);
      expect(play(state, { type: 'extend', tile: 3 }, { type: 'extend', tile: 0 }).trace).toEqual([
        0, 1, 3,
      ]);
      expect(play(state, { type: 'extend', tile: 4 })).toEqual(state);
      expect(play(state, { type: 'extend', tile: -1 })).toEqual(state);
    });

    it('steps back one tile and no further than empty', () => {
      const state = play(
        startCrossingPlay(puzzle),
        { type: 'extend', tile: 2 },
        { type: 'extend', tile: 3 },
      );
      expect(play(state, { type: 'stepBack' }).trace).toEqual([2]);
      expect(
        play(state, { type: 'stepBack' }, { type: 'stepBack' }, { type: 'stepBack' }).trace,
      ).toEqual([]);
    });

    it('takes no trace on a solved Word', () => {
      const state = play(solved(COW), select(0, 0), select(0, 0));
      expect(state.current).toBe(COW);
      expect(play(state, { type: 'extend', tile: 0 })).toEqual(state);
    });
  });

  describe('release', () => {
    it('fills and solves the Word a trace spells, keeps the pre-filled cell and moves on to the next open Word', () => {
      const state = play(startCrossingPlay(puzzle), ...traced(startCrossingPlay(puzzle), 'cat'));
      expect(state.words[CAT]).toEqual({ kind: 'solved' });
      expect(state.cells[crossingCellKey({ row: 0, column: 0 })]).toEqual({
        kind: 'filled',
        letter: 'c',
      });
      expect(state.cells[crossingCellKey({ row: 0, column: 1 })]).toEqual({
        kind: 'filled',
        letter: 'a',
      });
      expect(state.cells[crossingCellKey({ row: 0, column: 2 })]).toEqual({
        kind: 'prefilled',
        letter: 't',
      });
      expect(state).toMatchObject({ current: COW, trace: [] });
    });

    it('misses on any other trace and changes nothing but the trace', () => {
      const before = startCrossingPlay(puzzle);
      expect(play(before, ...traced(before, 'cta'))).toEqual({ ...before, trace: [] });
      expect(play(before, ...traced(before, 'ca'))).toEqual({ ...before, trace: [] });
      expect(play(before, ...traced(before, 'catz'))).toEqual({ ...before, trace: [] });
      expect(play(before, { type: 'release' })).toEqual(before);
    });

    it('wraps to the first open Word after a solve', () => {
      const state = play(
        solved(COW),
        select(2, 2),
        ...traced(play(solved(COW), select(2, 2)), 'toe'),
      );
      expect(state.words[TOE]).toEqual({ kind: 'solved' });
      expect(state.current).toBe(CAT);
    });

    it('solves a Word whose every cell the crossings filled', () => {
      const state = solved(COW, ANT);
      expect(state.words[CAT]).toEqual({ kind: 'solved' });
      expect(state.current).toBe(TOE);
      expect(isCrossingSolved(state)).toBe(false);
    });

    it('keeps a filled letter where a crossing Word is entered', () => {
      const state = solved(CAT, COW);
      expect(state.cells[crossingCellKey({ row: 0, column: 0 })]).toEqual({
        kind: 'filled',
        letter: 'c',
      });
    });
  });

  describe('tick', () => {
    it('adds the seconds given', () => {
      const state = play(
        startCrossingPlay(puzzle),
        { type: 'tick', seconds: 3 },
        { type: 'tick', seconds: 2 },
      );
      expect(state.seconds).toBe(5);
    });
  });

  describe('a solved puzzle', () => {
    it('is solved once every Word is, and takes no more actions', () => {
      const state = solved(COW, ANT, TOE);
      expect(isCrossingSolved(state)).toBe(true);
      expect(state.words).toEqual(puzzle.words.map(() => ({ kind: 'solved' })));
      for (const action of [
        select(1, 1),
        { type: 'next' } as const,
        { type: 'extend', tile: 0 } as const,
        { type: 'stepBack' } as const,
        { type: 'release' } as const,
        { type: 'tick', seconds: 1 } as const,
      ]) {
        expect(play(state, action)).toBe(state);
      }
    });
  });
});
