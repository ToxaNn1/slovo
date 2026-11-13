import { fill, type EditionStrings } from '@slovo/contracts';
import {
  crossingCellKey,
  crossingGridOf,
  isCrossingSolved,
  type Composition,
  type CrosswordSolve,
  type CrossingAction,
  type CrossingCrossword,
  type CrossingPlay,
  type CrossingPuzzle,
  type CrossingWord,
  type PuzzlePlace,
} from '@slovo/core';
import type { CrossingGridCell, CrosswordMiniCell, WheelMiss } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useComposition } from '../composition';
import type { DailyCrosswordProgress } from './crossword-progress';
import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { useInForeground } from '../foreground/in-foreground';
import { keep } from '../keep';
import { useOpenCrossword } from './open-crossword';

type Strings = EditionStrings['game']['dailyCrossword'];

/** How often the Solve time reads the clock, in milliseconds, so each second counts on time. */
const TICK_MS = 1000;

const solvedCount = ({ words }: CrossingPlay) =>
  words.filter(({ kind }) => kind === 'solved').length;

const letterAt = (state: CrossingPlay, place: PuzzlePlace) => {
  const cell = state.cells[crossingCellKey(place)];
  return cell === undefined || cell.kind === 'empty' ? undefined : cell.letter;
};

/**
 * Today's solve: the one the XP log records, which Sync brings from every
 * device (ADR 0087), or the one this device's play made while the log keeps
 * none, with no Solve time; `undefined` until it is solved.
 */
export function crossingSolveOf(
  composition: Composition,
  puzzle: CrossingPuzzle,
  state: CrossingPlay,
): CrosswordSolve | undefined {
  const recorded = composition.xpLog.crosswordSolveOn(puzzle.date);
  if (recorded !== undefined) return recorded;
  return isCrossingSolved(state) ? { solveSeconds: undefined, hinted: state.hinted } : undefined;
}

/** A Word by its number and direction, as VoiceOver reads it, e.g. «1 по горизонталі». */
export const crossingWordName = ({ number, direction }: CrossingWord, strings: Strings) =>
  fill(strings.wordName, { number: String(number), direction: strings[direction] });

/**
 * The grid as the crossing grid draws it: blocks, letters, numbers, the
 * current and the solved Words; every letter once it is solved, on another
 * device too.
 */
export function crossingCells(
  puzzle: CrossingPuzzle,
  state: CrossingPlay,
  strings: Strings,
  solved: boolean,
): CrossingGridCell[][] {
  const current = state.current;
  return crossingGridOf(puzzle).map((spots, row) =>
    spots.map((spot, column): CrossingGridCell => {
      if (spot.kind === 'block') return { kind: 'block' };
      const words = spot.words.flatMap((i) => puzzle.words[i] ?? []);
      const letter = solved ? spot.answer : letterAt(state, { row, column });
      const starting = words.find(
        ({ start }) => start.row === row && start.column === column,
      )?.number;
      return {
        kind: 'cell',
        letter,
        number: starting,
        current: spot.words.includes(current),
        solved: solved || spot.words.some((i) => state.words[i]?.kind === 'solved'),
        label: fill(strings.crossingCellLabel, {
          cell: letter ?? strings.emptyCell,
          words: words.map((word) => crossingWordName(word, strings)).join(', '),
          row: String(row + 1),
          column: String(column + 1),
        }),
      };
    }),
  );
}

/** The small grid of the crossing Daily Crossword's card: its blocks, and the letters in so far. */
export function crossingMiniGrid(
  puzzle: CrossingPuzzle,
  state: CrossingPlay,
): CrosswordMiniCell[][] {
  return crossingGridOf(puzzle).map((spots, row) =>
    spots.map(
      (spot, column): CrosswordMiniCell =>
        spot.kind === 'block'
          ? { kind: 'block' }
          : { kind: 'cell', letter: letterAt(state, { row, column }) },
    ),
  );
}

/** How far the reader is in the crossing Daily Crossword, as its card says it, given today's solve. */
export function crossingProgress(
  state: CrossingPlay,
  solve: CrosswordSolve | undefined,
): DailyCrosswordProgress {
  if (solve !== undefined) return 'solved';
  return Object.values(state.cells).some(({ kind }) => kind === 'filled') ? 'started' : 'untouched';
}

/** Today's crossing Daily Crossword on its screen: what it draws, and the reader's moves. */
export interface CrossingCrosswordPlay {
  readonly puzzle: CrossingPuzzle;
  readonly cells: CrossingGridCell[][];
  /** The current Word's chip, e.g. «1→», its clue and what VoiceOver reads for the clue. */
  readonly clue: { readonly number: string; readonly text: string; readonly label: string };
  readonly wheel: readonly string[];
  readonly trace: readonly number[];
  /** The last trace that spelled no Word, which the wheel shows in ink and shakes. */
  readonly miss: WheelMiss | undefined;
  /** Whether a Word is solved yet, which shortens the line over the wheel. */
  readonly entered: boolean;
  /** Whether the hand coach shows: until the reader's first touch on this screen. */
  readonly coach: boolean;
  /**
   * Today's solve as {@link crossingSolveOf} reads it, with its Solve time and
   * whether the Crossword Hint filled a letter; `undefined` until it is solved.
   * The time counting on screen is the Core's to keep: the view is not drawn
   * again each second.
   */
  readonly solve: CrosswordSolve | undefined;
  readonly select: (place: PuzzlePlace) => void;
  readonly next: () => void;
  readonly extend: (tile: number) => void;
  readonly stepBack: () => void;
  readonly release: () => void;
  /** Asks the Crossword Hint, which fills one letter of the current Word; `undefined` while the Edition offers none. */
  readonly hint: (() => void) | undefined;
}

const DIRECTION_MARK = { across: '→', down: '↓' } as const;

/**
 * Today's crossing Daily Crossword for its screen, as the Core opened it with
 * the progress this device made, and afresh for another one opened. Each move
 * goes to the Core in turn; a release that solves no Word becomes the `miss`.
 * The Solve time ticks from the device clock only while the screen is in front
 * and the app in the foreground (ADR 0087); as the screen leaves or the app
 * goes to the background the progress is kept and the time pauses, until the
 * reader comes back. A move that fails is logged and changes nothing.
 */
export function useCrossingCrossword(crossword: CrossingCrossword): CrossingCrosswordPlay {
  const composition = useComposition();
  const inForeground = useInForeground();
  useFocusEffect(
    useCallback(() => {
      if (!inForeground) return undefined;
      // The clock's time counted so far: a tick adds the whole seconds since.
      let counted = deviceClock.now().getTime();
      const tick = () => {
        if (crossingSolveOf(composition, crossword.puzzle, crossword.state) !== undefined) return;
        const seconds = Math.floor((deviceClock.now().getTime() - counted) / 1000);
        if (seconds <= 0) return;
        counted += seconds * 1000;
        void keep('the crossing Daily Crossword', crossword.play({ type: 'tick', seconds }));
      };
      const ticking = setInterval(tick, TICK_MS);
      return () => {
        clearInterval(ticking);
        void keep('the crossing Daily Crossword', crossword.keep());
      };
    }, [composition, crossword, inForeground]),
  );

  const { puzzle } = crossword;
  const { state, miss, touched, play } = useOpenCrossword<CrossingPlay, CrossingAction, WheelMiss>(
    crossword,
    'the crossing Daily Crossword',
    (before, next, key) => {
      if (before.trace.length === 0 || solvedCount(next) !== solvedCount(before)) return undefined;
      const word = puzzle.words[before.current];
      return { key, letters: before.trace.map((tile) => word?.wheel[tile] ?? '') };
    },
  );
  const strings = editionStrings.game.dailyCrossword;

  const current = puzzle.words[state.current];
  const solve = crossingSolveOf(composition, puzzle, state);
  return {
    puzzle,
    cells: crossingCells(puzzle, state, strings, solve !== undefined),
    clue: {
      number:
        current === undefined
          ? ''
          : `${String(current.number)}${DIRECTION_MARK[current.direction]}`,
      text: current?.clue ?? '',
      label:
        current === undefined
          ? ''
          : fill(strings.crossingClueLabel, {
              word: crossingWordName(current, strings),
              clue: current.clue,
            }),
    },
    wheel: current?.wheel ?? [],
    trace: state.trace,
    miss,
    entered: solvedCount(state) > 0,
    coach: !touched,
    solve,
    select: (place) => {
      play({ type: 'select', place });
    },
    next: () => {
      play({ type: 'next' });
    },
    extend: (tile) => {
      play({ type: 'extend', tile });
    },
    stepBack: () => {
      play({ type: 'stepBack' });
    },
    release: () => {
      play({ type: 'release' });
    },
    hint: crossword.hint
      ? () => {
          play({ type: 'hint' });
        }
      : undefined,
  };
}
