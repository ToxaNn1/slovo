import { crossingPlacesOf, type CrossingPuzzle } from './crossing-crossword';
import type { PuzzlePlace } from './crossword-puzzle';

/** A white cell of the crossing Daily Crossword: empty, pre-filled by the day or filled by the reader. */
export type CrossingCell =
  | { readonly kind: 'empty' }
  | { readonly kind: 'prefilled'; readonly letter: string }
  | { readonly kind: 'filled'; readonly letter: string };

/** A Word of the crossing Daily Crossword in play. */
export type CrossingWordState = { readonly kind: 'open' } | { readonly kind: 'solved' };

/**
 * The reader's play of a crossing Daily Crossword (ADR 0087): every white
 * cell by its key, every Word by the puzzle's order, the current Word, the
 * tiles of its Letter Wheel traced so far, whether the Crossword Hint was
 * used and the seconds the crossword was on screen.
 */
export interface CrossingPlay {
  readonly cells: Readonly<Record<string, CrossingCell>>;
  readonly words: readonly CrossingWordState[];
  /** The current Word, as an index into the puzzle's Words. */
  readonly current: number;
  /** The wheel tiles traced, as indexes into the current Word's wheel; empty while no finger is down. */
  readonly trace: readonly number[];
  readonly hinted: boolean;
  readonly seconds: number;
}

/**
 * What the reader does: select a cell (picks the Word through it; on a
 * crossing a second tap switches direction), move to the next open Word,
 * extend the trace onto a wheel tile (onto the tile before the last, it
 * steps back), step back one tile, release the trace, which fills and
 * solves the current Word it spells or misses, ask the Crossword Hint, which
 * fills the first empty cell of the current Word and marks the play hinted,
 * and tick the on-screen seconds.
 */
export type CrossingAction =
  | { readonly type: 'select'; readonly place: PuzzlePlace }
  | { readonly type: 'next' }
  | { readonly type: 'extend'; readonly tile: number }
  | { readonly type: 'stepBack' }
  | { readonly type: 'release' }
  | { readonly type: 'hint' }
  | { readonly type: 'tick'; readonly seconds: number };

/** The progress of a day kept between openings: the letters filled by cell key, the ids of the Words solved, `hinted` and the seconds. */
export interface KeptCrossingPlay {
  readonly filled: Readonly<Record<string, string>>;
  readonly solved: readonly string[];
  readonly hinted: boolean;
  readonly seconds: number;
}

/** The key of a cell in the play's cells: `row,column`. */
export const crossingCellKey = ({ row, column }: PuzzlePlace): string =>
  `${String(row)},${String(column)}`;

/** Whether every Word is solved. */
export const isCrossingSolved = (state: CrossingPlay): boolean =>
  state.words.every((word) => word.kind === 'solved');

/** The letters the reader filled, by cell key; the pre-filled cells are the puzzle's. */
export const filledLetters = (state: CrossingPlay): Record<string, string> =>
  Object.fromEntries(
    Object.entries(state.cells).flatMap(([key, cell]) =>
      cell.kind === 'filled' ? [[key, cell.letter]] : [],
    ),
  );

/** The ids of the Words solved. */
export const solvedIds = (puzzle: CrossingPuzzle, state: CrossingPlay): string[] =>
  puzzle.words.flatMap(({ word }, i) => (state.words[i]?.kind === 'solved' ? [word.id] : []));

/** The indexes of the Words through a cell, in the puzzle's order. */
const wordsThrough = (puzzle: CrossingPuzzle, place: PuzzlePlace): number[] =>
  puzzle.words.flatMap((word, i) =>
    crossingPlacesOf(word).some(({ row, column }) => row === place.row && column === place.column)
      ? [i]
      : [],
  );

/** The next open Word after `from` in the puzzle's order, wrapping; `from` itself when no other is open. */
function nextOpen(words: readonly CrossingWordState[], from: number): number {
  for (let step = 1; step < words.length; step += 1) {
    const i = (from + step) % words.length;
    if (words[i]?.kind === 'open') return i;
  }
  return from;
}

/** Whether every cell of the Word holds a letter. */
const isFull = (cells: CrossingPlay['cells'], word: CrossingPuzzle['words'][number]) =>
  crossingPlacesOf(word).every((place) => cells[crossingCellKey(place)]?.kind !== 'empty');

/**
 * The Words solved after the cells changed: every Word already solved, and
 * every open Word whose every cell the crossings filled (ADR 0087).
 */
const settled = (puzzle: CrossingPuzzle, state: CrossingPlay): CrossingWordState[] =>
  puzzle.words.map((word, i) =>
    state.words[i]?.kind === 'solved' || isFull(state.cells, word)
      ? { kind: 'solved' }
      : { kind: 'open' },
  );

/**
 * A puzzle's play from the start, or from the progress kept: the pre-filled
 * cells, the letters filled, the Words solved (a Word whose every cell holds
 * a letter among them), `hinted`, the seconds, and the first open Word
 * current.
 */
export function startCrossingPlay(puzzle: CrossingPuzzle, kept?: KeptCrossingPlay): CrossingPlay {
  const prefilled = new Map(
    puzzle.prefilled.map(({ place, letter }) => [crossingCellKey(place), letter]),
  );
  const cells: Record<string, CrossingCell> = {};
  for (const word of puzzle.words) {
    for (const place of crossingPlacesOf(word)) {
      const key = crossingCellKey(place);
      const pre = prefilled.get(key);
      const filled = kept?.filled[key];
      cells[key] =
        pre !== undefined
          ? { kind: 'prefilled', letter: pre }
          : filled !== undefined
            ? { kind: 'filled', letter: filled }
            : { kind: 'empty' };
    }
  }
  const begun: CrossingPlay = {
    cells,
    words: puzzle.words.map(({ word }) =>
      kept?.solved.includes(word.id) ? { kind: 'solved' } : { kind: 'open' },
    ),
    current: 0,
    trace: [],
    hinted: kept?.hinted ?? false,
    seconds: kept?.seconds ?? 0,
  };
  const words = settled(puzzle, begun);
  const first = words.findIndex((word) => word.kind === 'open');
  return { ...begun, words, current: first === -1 ? 0 : first };
}

/** Plays one action over the puzzle; a solved puzzle takes none. */
export function playCrossing(
  puzzle: CrossingPuzzle,
  state: CrossingPlay,
  action: CrossingAction,
): CrossingPlay {
  if (isCrossingSolved(state)) return state;
  const current = puzzle.words[state.current];
  if (current === undefined) return state;
  switch (action.type) {
    case 'select': {
      const through = wordsThrough(puzzle, action.place);
      const [first] = through;
      if (first === undefined) return state;
      if (!through.includes(state.current)) return { ...state, current: first, trace: [] };
      const other = through.find((i) => i !== state.current);
      return other === undefined ? state : { ...state, current: other, trace: [] };
    }
    case 'next':
      return { ...state, current: nextOpen(state.words, state.current), trace: [] };
    case 'extend': {
      const { tile } = action;
      if (state.words[state.current]?.kind === 'solved') return state;
      if (!Number.isInteger(tile) || tile < 0 || tile >= current.wheel.length) return state;
      if (state.trace.at(-2) === tile) return { ...state, trace: state.trace.slice(0, -1) };
      if (state.trace.includes(tile)) return state;
      return { ...state, trace: [...state.trace, tile] };
    }
    case 'stepBack':
      return state.trace.length === 0 ? state : { ...state, trace: state.trace.slice(0, -1) };
    case 'release': {
      if (state.trace.length === 0) return state;
      const spelled = state.trace.map((tile) => current.wheel[tile]);
      const hit =
        spelled.length === current.letters.length &&
        spelled.every((letter, i) => letter === current.letters[i]);
      if (!hit) return { ...state, trace: [] };
      const cells = { ...state.cells };
      crossingPlacesOf(current).forEach((place, i) => {
        const key = crossingCellKey(place);
        const letter = current.letters[i];
        if (cells[key]?.kind === 'empty' && letter !== undefined)
          cells[key] = { kind: 'filled', letter };
      });
      const words = settled(puzzle, {
        ...state,
        cells,
        words: state.words.map((word, i) => (i === state.current ? { kind: 'solved' } : word)),
      });
      return { ...state, cells, words, current: nextOpen(words, state.current), trace: [] };
    }
    case 'hint': {
      const empty = crossingPlacesOf(current).findIndex(
        (place) => state.cells[crossingCellKey(place)]?.kind === 'empty',
      );
      const place = crossingPlacesOf(current)[empty];
      const letter = current.letters[empty];
      if (place === undefined || letter === undefined) return state;
      const filled: CrossingCell = { kind: 'filled', letter };
      const cells = { ...state.cells, [crossingCellKey(place)]: filled };
      const words = settled(puzzle, { ...state, cells });
      const moved = words[state.current]?.kind === 'solved';
      return {
        ...state,
        cells,
        words,
        current: moved ? nextOpen(words, state.current) : state.current,
        trace: [],
        hinted: true,
      };
    }
    case 'tick':
      // Whole seconds, never back: the progress kept reads them as a count.
      return {
        ...state,
        seconds:
          state.seconds +
          (Number.isFinite(action.seconds) ? Math.max(0, Math.round(action.seconds)) : 0),
      };
  }
}
