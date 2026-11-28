import { fill, type EditionStrings } from '@slovo/contracts';
import {
  crossingCellKey,
  crossingGridOf,
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
import { useCallback, useMemo, useState } from 'react';

import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { useInForeground } from '../foreground/in-foreground';
import { keep } from '../keep';

type Strings = EditionStrings['game']['dailyCrossword'];

/** How often the Solve time reads the clock, in milliseconds, so each second counts on time. */
const TICK_MS = 1000;

const letterAt = (state: Pick<CrossingPlay, 'cells'>, place: PuzzlePlace) => {
  const cell = state.cells[crossingCellKey(place)];
  return cell === undefined || cell.kind === 'empty' ? undefined : cell.letter;
};

/** A Word by its number and direction, as VoiceOver reads it, e.g. «1 по горизонталі». */
const crossingWordName = ({ number, direction }: CrossingWord, strings: Strings) =>
  fill(strings.wordName, { number: String(number), direction: strings[direction] });

/**
 * The grid as the crossing grid draws it: blocks, letters, numbers, the
 * current and the solved Words; every letter once it is solved, on another
 * device too.
 */
function crossingCells(
  puzzle: CrossingPuzzle,
  state: Pick<CrossingPlay, 'current' | 'words' | 'cells'>,
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
  state: Pick<CrossingPlay, 'current' | 'words' | 'cells'>,
): CrosswordMiniCell[][] {
  return crossingGridOf(puzzle).map((spots, row) =>
    spots.map((spot, column): CrosswordMiniCell =>
      spot.kind === 'block'
        ? { kind: 'block' }
        : { kind: 'cell', letter: letterAt(state, { row, column }) },
    ),
  );
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
   * Today's solve as the Core answers it, with its Solve time and
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

const SUBJECT = 'the crossing Daily Crossword';

/** What the screen holds of the crossword it has open: the play drawn, the last miss and whether the reader traced. */
interface Opened {
  readonly crossword: CrossingCrossword;
  readonly state: CrossingPlay;
  readonly miss: WheelMiss | undefined;
  readonly touched: boolean;
}

const fresh = (crossword: CrossingCrossword): Opened => ({
  crossword,
  state: crossword.state,
  miss: undefined,
  touched: false,
});

/**
 * Today's crossing Daily Crossword for its screen, as the Core opened it with
 * the progress this device made, and afresh for another one opened. Each move
 * goes to the Core in turn and the play it answers is the one drawn; a move
 * that answers after another crossword opened is dropped, and a miss the Core
 * answers becomes the `miss`.
 * The Solve time ticks from the device clock only while the screen is in front
 * and the app in the foreground; as the screen leaves or the app
 * goes to the background the progress is kept and the time pauses, until the
 * reader comes back. A move that fails is logged and changes nothing.
 */
export function useCrossingCrossword(crossword: CrossingCrossword): CrossingCrosswordPlay {
  const inForeground = useInForeground();
  useFocusEffect(
    useCallback(() => {
      if (!inForeground) return undefined;
      // The clock's time counted so far: a tick adds the whole seconds since.
      let counted = deviceClock.now().getTime();
      const tick = () => {
        if (crossword.solve !== undefined) return;
        const seconds = Math.floor((deviceClock.now().getTime() - counted) / 1000);
        if (seconds <= 0) return;
        counted += seconds * 1000;
        void keep(SUBJECT, crossword.play({ type: 'tick', seconds }));
      };
      const ticking = setInterval(tick, TICK_MS);
      return () => {
        clearInterval(ticking);
        void keep(SUBJECT, crossword.keep());
      };
    }, [crossword, inForeground]),
  );

  const [opened, setOpened] = useState(() => fresh(crossword));
  if (opened.crossword !== crossword) setOpened(fresh(crossword));
  const { state, miss, touched } = opened;
  const play = (action: CrossingAction) => {
    void keep(SUBJECT, crossword.play(action)).then((move) => {
      if (move === undefined) return;
      setOpened((now) => {
        if (now.crossword !== crossword) return now;
        const { outcome } = move;
        return {
          crossword,
          state: move.state,
          touched: now.touched || action.type === 'extend',
          miss:
            outcome.kind === 'miss'
              ? { key: (now.miss?.key ?? 0) + 1, letters: outcome.letters }
              : now.miss,
        };
      });
    });
  };

  const { puzzle } = crossword;
  const strings = editionStrings.game.dailyCrossword;
  const current = puzzle.words[state.current];
  const { solve } = crossword;
  const { current: currentWord, words, cells: filled } = state;
  // Built again only when what the grid shows changes, not at each letter of a trace.
  const cells = useMemo(
    () =>
      crossingCells(
        puzzle,
        { current: currentWord, words, cells: filled },
        strings,
        solve !== undefined,
      ),
    [puzzle, currentWord, words, filled, strings, solve],
  );
  return {
    puzzle,
    cells,
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
    entered: state.words.some(({ kind }) => kind === 'solved'),
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
