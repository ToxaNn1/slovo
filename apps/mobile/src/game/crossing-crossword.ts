import { fill, type EditionStrings } from '@slovo/contracts';
import {
  crossingCellKey,
  crossingPlacesOf,
  isCrossingSolved,
  type Composition,
  type CrossingAction,
  type CrossingCrossword,
  type CrossingPlay,
  type CrossingPuzzle,
  type CrossingWord,
  type DailyCrosswordState,
  type PuzzlePlace,
} from '@slovo/core';
import type { CrossingGridCell, CrosswordMiniCell, WheelMiss } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { deviceClock } from '../device/device-clock';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import { useInForeground } from '../foreground/in-foreground';
import { keep } from '../keep';

type Strings = EditionStrings['game']['dailyCrossword'];

/** How often the Solve time reads the clock, in milliseconds, so each second counts on time. */
const TICK_MS = 1000;

const solvedCount = ({ words }: CrossingPlay) =>
  words.filter(({ kind }) => kind === 'solved').length;

/** The side of the puzzle's square grid. */
const sizeOf = (puzzle: CrossingPuzzle) =>
  Math.max(
    0,
    ...puzzle.blocks.flatMap(({ row, column }) => [row + 1, column + 1]),
    ...puzzle.words.flatMap((word) =>
      crossingPlacesOf(word).flatMap(({ row, column }) => [row + 1, column + 1]),
    ),
  );

const isBlock = (puzzle: CrossingPuzzle, place: PuzzlePlace) =>
  puzzle.blocks.some(({ row, column }) => row === place.row && column === place.column);

const through = (puzzle: CrossingPuzzle, place: PuzzlePlace) =>
  puzzle.words.filter((word) =>
    crossingPlacesOf(word).some(({ row, column }) => row === place.row && column === place.column),
  );

const letterAt = (state: CrossingPlay, place: PuzzlePlace) => {
  const cell = state.cells[crossingCellKey(place)];
  return cell === undefined || cell.kind === 'empty' ? undefined : cell.letter;
};

/** A Word by its number and direction, as VoiceOver reads it, e.g. «1 по горизонталі». */
export const crossingWordName = ({ number, direction }: CrossingWord, strings: Strings) =>
  fill(strings.wordName, { number: String(number), direction: strings[direction] });

/** The grid as the crossing grid draws it: blocks, letters, numbers, the current and the solved Words. */
export function crossingCells(
  puzzle: CrossingPuzzle,
  state: CrossingPlay,
  strings: Strings,
): CrossingGridCell[][] {
  const size = sizeOf(puzzle);
  const current = puzzle.words[state.current];
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (__, column): CrossingGridCell => {
      const place = { row, column };
      if (isBlock(puzzle, place)) return { kind: 'block' };
      const words = through(puzzle, place);
      const letter = letterAt(state, place);
      const starting = words.find(
        ({ start }) => start.row === row && start.column === column,
      )?.number;
      return {
        kind: 'cell',
        letter,
        number: starting,
        current: current !== undefined && words.includes(current),
        solved: words.some((word) => state.words[puzzle.words.indexOf(word)]?.kind === 'solved'),
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
  const size = sizeOf(puzzle);
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (__, column): CrosswordMiniCell =>
      isBlock(puzzle, { row, column })
        ? { kind: 'block' }
        : { kind: 'cell', letter: letterAt(state, { row, column }) },
    ),
  );
}

/** How far the reader is in the crossing Daily Crossword, as its card says it. */
export function crossingProgress(state: CrossingPlay): DailyCrosswordState['progress'] {
  if (isCrossingSolved(state)) return 'solved';
  return Object.values(state.cells).some(({ kind }) => kind === 'filled') ? 'started' : 'untouched';
}

/** Today's crossing Daily Crossword on its screen: what it draws, and the reader's moves. */
export interface CrossingCrosswordPlay {
  readonly kind: 'play';
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
  readonly solved: boolean;
  readonly select: (place: PuzzlePlace) => void;
  readonly next: () => void;
  readonly extend: (tile: number) => void;
  readonly stepBack: () => void;
  readonly release: () => void;
}

/**
 * What the Daily Crossword's screen shows of the crossing one: `off` while
 * the Edition has it off, so the traced Daily Crossword shows (ADR 0073),
 * `no-fill` on a day no pattern fills, or the puzzle.
 */
export type CrossingCrosswordView =
  { readonly kind: 'off' } | { readonly kind: 'no-fill' } | CrossingCrosswordPlay;

type Opened =
  | { readonly in: Composition; readonly kind: 'off' | 'no-fill' }
  | {
      readonly in: Composition;
      readonly kind: 'open';
      readonly crossword: CrossingCrossword;
      readonly state: CrossingPlay;
      readonly miss: WheelMiss | undefined;
      readonly touched: boolean;
    };

const DIRECTION_MARK = { across: '→', down: '↓' } as const;

/**
 * Today's crossing Daily Crossword for its screen, opened with the progress
 * this device made as the screen opens and again in a composition reopened:
 * `undefined` while it opens. Each move goes to the Core in turn; a release
 * that solves no Word becomes the `miss`. The Solve time ticks from the
 * device clock only while the screen is in front and the app in the
 * foreground (ADR 0087); as the screen leaves or the app goes to the
 * background the progress is kept and the time pauses, until the reader comes
 * back. A move that fails is logged and changes nothing; an opening that
 * fails falls back to the traced Daily Crossword.
 */
export function useCrossingCrossword(): CrossingCrosswordView | undefined {
  const composition = useComposition();
  const [opened, setOpened] = useState<Opened>();
  useEffect(() => {
    let active = true;
    composition.openCrossingCrossword().then(
      (opening) => {
        if (!active) return;
        setOpened(
          opening.kind === 'open'
            ? {
                in: composition,
                kind: 'open',
                crossword: opening.crossword,
                state: opening.crossword.state,
                miss: undefined,
                touched: false,
              }
            : { in: composition, kind: opening.kind },
        );
      },
      (error: unknown) => {
        logError('Could not open the crossing Daily Crossword', error);
        if (active) setOpened({ in: composition, kind: 'off' });
      },
    );
    return () => {
      active = false;
    };
  }, [composition]);

  const crossword =
    opened?.in === composition && opened.kind === 'open' ? opened.crossword : undefined;
  const inForeground = useInForeground();
  useFocusEffect(
    useCallback(() => {
      if (crossword === undefined || !inForeground) return undefined;
      // The clock's time counted so far: a tick adds the whole seconds since.
      let counted = deviceClock.now().getTime();
      const tick = () => {
        if (isCrossingSolved(crossword.state)) return;
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
    }, [crossword, inForeground]),
  );

  if (opened?.in !== composition) return undefined;
  if (opened.kind !== 'open') return { kind: opened.kind };
  const { puzzle } = opened.crossword;
  const { state, miss, touched } = opened;
  const strings = editionStrings.game.dailyCrossword;

  const play = (action: CrossingAction) => {
    void keep('the crossing Daily Crossword', opened.crossword.play(action)).then((next) => {
      if (next === undefined) return;
      setOpened((now) => {
        if (now?.kind !== 'open' || now.crossword !== opened.crossword) return now;
        const word = puzzle.words[now.state.current];
        const missed =
          action.type === 'release' &&
          now.state.trace.length > 0 &&
          solvedCount(next) === solvedCount(now.state);
        return {
          ...now,
          state: next,
          touched: now.touched || action.type === 'extend',
          miss: missed
            ? {
                key: (now.miss?.key ?? 0) + 1,
                letters: now.state.trace.map((tile) => word?.wheel[tile] ?? ''),
              }
            : now.miss,
        };
      });
    });
  };
  const current = puzzle.words[state.current];
  return {
    kind: 'play',
    puzzle,
    cells: crossingCells(puzzle, state, strings),
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
    solved: isCrossingSolved(state),
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
  };
}
