import { CROSSWORD_SIZE, type Word } from '@slovo/contracts';

import type { Random } from '../ports';

/** A cell of the grid, by its row and column from 0, from the top left corner. */
export interface PuzzlePlace {
  readonly row: number;
  readonly column: number;
}

/** A letter of the grid, lowercase, and whether it is a stressed vowel of its Word. */
export interface PuzzleLetter {
  readonly letter: string;
  readonly stressed: boolean;
}

/**
 * A hidden Word of the traced Daily Crossword: the Word, its clue (its
 * primary Definition) and the path of its letters through the grid, in
 * reading order.
 */
export interface HiddenWord {
  readonly word: Word;
  readonly clue: string;
  readonly path: readonly PuzzlePlace[];
}

/** The traced Daily Crossword of a date: a 5 × 5 grid full of letters that its hidden Words tile. */
export interface CrosswordPuzzle {
  /** The local date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly grid: readonly (readonly PuzzleLetter[])[];
  readonly words: readonly HiddenWord[];
}

/**
 * What the generator gives: a puzzle, or why there is none. `no-tiling`:
 * the eligible Words have no set of lengths that fills all 25 cells.
 */
export type PuzzleGeneration =
  { readonly kind: 'puzzle'; readonly puzzle: CrosswordPuzzle } | { readonly kind: 'no-tiling' };

/** The shortest and longest hidden Word, in letters. */
export const HIDDEN_WORD_LENGTH = { min: 3, max: 8 } as const;

const CELLS = CROSSWORD_SIZE * CROSSWORD_SIZE;

/** Whether two cells touch, by a side or a corner. */
export function areAdjacent(a: PuzzlePlace, b: PuzzlePlace): boolean {
  const rows = Math.abs(a.row - b.row);
  const columns = Math.abs(a.column - b.column);
  return Math.max(rows, columns) === 1;
}

const samePlace = (a: PuzzlePlace, b: PuzzlePlace) => a.row === b.row && a.column === b.column;

/** A copy of the items in an order drawn from the random port: a Fisher–Yates shuffle. */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const a = order[i];
    const b = order[j];
    if (a === undefined || b === undefined) continue;
    order[i] = b;
    order[j] = a;
  }
  return order;
}

/** The letters of a Word that can hide in the grid: one lowercase letter per character, 3–8 of them. */
function lettersOf({ lemma }: Word): string[] | undefined {
  const letters = Array.from(lemma);
  const fits =
    letters.length >= HIDDEN_WORD_LENGTH.min &&
    letters.length <= HIDDEN_WORD_LENGTH.max &&
    letters.every((letter) => /^\p{Ll}$/u.test(letter));
  return fits ? letters : undefined;
}

/**
 * Words whose lengths add up to 25, each Lemma once, tried in the shuffled
 * order; undefined when no such set exists.
 */
function pickWords(words: readonly Word[], random: Random): Word[] | undefined {
  const byLength = new Map<number, Word[]>();
  const lemmas = new Set<string>();
  for (const word of shuffled(words, random)) {
    const letters = lettersOf(word);
    if (letters === undefined || lemmas.has(word.lemma)) continue;
    lemmas.add(word.lemma);
    byLength.set(letters.length, [...(byLength.get(letters.length) ?? []), word]);
  }
  const lengths = shuffled([...byLength.keys()], random);
  const taken = new Map<number, number>();
  const fill = (left: number): boolean => {
    if (left === 0) return true;
    for (const length of lengths) {
      const count = taken.get(length) ?? 0;
      if (length > left || count >= (byLength.get(length)?.length ?? 0)) continue;
      taken.set(length, count + 1);
      if (fill(left - length)) return true;
      taken.set(length, count);
    }
    return false;
  };
  if (!fill(CELLS)) return undefined;
  return shuffled(
    [...taken].flatMap(([length, count]) => (byLength.get(length) ?? []).slice(0, count)),
    random,
  );
}

const ALL_PLACES: readonly PuzzlePlace[] = Array.from({ length: CELLS }, (_, i) => ({
  row: Math.floor(i / CROSSWORD_SIZE),
  column: i % CROSSWORD_SIZE,
}));

/** The rows read left to right, then right to left, in turn: a path through every cell. */
const SNAKE: readonly PuzzlePlace[] = ALL_PLACES.map(({ row, column }) => ({
  row,
  column: row % 2 === 0 ? column : CROSSWORD_SIZE - 1 - column,
}));

/** At most this many steps to look for a random path through every cell before the snake. */
const PATH_STEPS = 5_000;

/**
 * A path through every cell over 8-adjacent cells, from a random cell: a
 * random walk that goes first where the fewest ways on are left (Warnsdorff),
 * backing up from dead ends; the snake when the walk takes too long.
 */
function pathThroughEveryCell(random: Random): readonly PuzzlePlace[] {
  const start = ALL_PLACES[Math.floor(random.next() * CELLS)] ?? ALL_PLACES[0];
  if (start === undefined) return SNAKE;
  const path: PuzzlePlace[] = [start];
  const visited = new Set([start.row * CROSSWORD_SIZE + start.column]);
  const open = (place: PuzzlePlace) => !visited.has(place.row * CROSSWORD_SIZE + place.column);
  const nextOf = (from: PuzzlePlace) =>
    ALL_PLACES.filter((place) => open(place) && areAdjacent(from, place));
  let steps = 0;
  const walk = (): boolean => {
    if (path.length === CELLS) return true;
    steps += 1;
    if (steps > PATH_STEPS) return false;
    const last = path.at(-1);
    if (last === undefined) return false;
    const onward = shuffled(nextOf(last), random)
      .map((place) => ({ place, ways: nextOf(place).length }))
      .sort((a, b) => a.ways - b.ways);
    for (const { place } of onward) {
      const key = place.row * CROSSWORD_SIZE + place.column;
      visited.add(key);
      path.push(place);
      if (walk()) return true;
      path.pop();
      visited.delete(key);
    }
    return false;
  };
  return walk() ? path : SNAKE;
}

/**
 * The traced Daily Crossword of a local date (ADR 0073): hidden Words drawn
 * from the eligible Words whose paths tile all 25 cells, each a self-avoiding
 * walk over 8-adjacent cells, turns allowed. One path through every cell is
 * cut into the Words' paths, and each Word reads its piece one way or the
 * other. It draws only from the random port, so the same Words and the same
 * seeded port give the same puzzle; `no-tiling` when the Words' lengths
 * cannot fill the grid.
 */
export function generateCrosswordPuzzle({
  date,
  words,
  random,
}: {
  date: string;
  /** The Words within the Rarity Ceiling, in the Language Pack's order. */
  words: readonly Word[];
  random: Random;
}): PuzzleGeneration {
  const picked = pickWords(words, random);
  if (picked === undefined) return { kind: 'no-tiling' };
  const route = pathThroughEveryCell(random);
  const grid: PuzzleLetter[][] = Array.from({ length: CROSSWORD_SIZE }, () => []);
  let cut = 0;
  const hidden = picked.map((word): HiddenWord => {
    const letters = lettersOf(word) ?? [];
    const piece = route.slice(cut, cut + letters.length);
    cut += letters.length;
    const path = random.next() < 0.5 ? piece : [...piece].reverse();
    path.forEach(({ row, column }, i) => {
      const line = grid[row];
      if (line !== undefined)
        line[column] = { letter: letters[i] ?? '', stressed: word.stress.includes(i) };
    });
    return { word, clue: word.primaryDefinition, path };
  });
  return { kind: 'puzzle', puzzle: { date, grid, words: hidden } };
}

/** A hidden Word as the reader has it: not found yet, or found and locked. */
export type HiddenWordState = { readonly kind: 'hidden' } | { readonly kind: 'found' };

/** The reader's play of a puzzle: each hidden Word's state, by the puzzle's order, and the trace being drawn. */
export interface PuzzleState {
  readonly words: readonly HiddenWordState[];
  /** The cells traced so far, in order; empty while no finger is down. */
  readonly trace: readonly PuzzlePlace[];
}

/**
 * What the reader does: `extend` the trace onto a cell (onto the cell before
 * the last, it steps back), `stepBack` one cell, or `release` the trace,
 * which locks the hidden Word it traces or clears it.
 */
export type PuzzleAction =
  | { readonly type: 'extend'; readonly place: PuzzlePlace }
  | { readonly type: 'stepBack' }
  | { readonly type: 'release' };

/** A puzzle's play with no Word found and no trace, or with the Words of these ids found. */
export function startPuzzle(
  puzzle: CrosswordPuzzle,
  foundIds: readonly string[] = [],
): PuzzleState {
  return {
    words: puzzle.words.map(({ word }) =>
      foundIds.includes(word.id) ? { kind: 'found' } : { kind: 'hidden' },
    ),
    trace: [],
  };
}

/** Whether every hidden Word is found. */
export const isSolved = (state: PuzzleState): boolean =>
  state.words.every((word) => word.kind === 'found');

/** The ids of the Words found. */
export const foundIds = (puzzle: CrosswordPuzzle, state: PuzzleState): string[] =>
  puzzle.words.flatMap(({ word }, i) => (state.words[i]?.kind === 'found' ? [word.id] : []));

const insideGrid = ({ row, column }: PuzzlePlace) =>
  Number.isInteger(row) &&
  Number.isInteger(column) &&
  row >= 0 &&
  column >= 0 &&
  row < CROSSWORD_SIZE &&
  column < CROSSWORD_SIZE;

/**
 * The play after the reader's action. A trace starts on any cell of a Word
 * not found yet and grows only onto a cell that touches its last one, by a
 * side or a corner, and is neither on the trace nor in a found Word; the cell
 * before the last steps back. A release locks the hidden Word whose path the
 * trace follows from its first letter to its last, and clears the trace
 * either way. A solved puzzle takes no more actions.
 */
export function playPuzzle(
  puzzle: CrosswordPuzzle,
  state: PuzzleState,
  action: PuzzleAction,
): PuzzleState {
  if (isSolved(state)) return state;
  const { trace } = state;
  switch (action.type) {
    case 'stepBack':
      return trace.length === 0 ? state : { ...state, trace: trace.slice(0, -1) };
    case 'release': {
      if (trace.length === 0) return state;
      const traced = puzzle.words.findIndex(
        ({ path }, i) =>
          state.words[i]?.kind === 'hidden' &&
          path.length === trace.length &&
          path.every((place, j) => {
            const at = trace[j];
            return at !== undefined && samePlace(place, at);
          }),
      );
      return {
        words: state.words.map((word, i) => (i === traced ? { kind: 'found' } : word)),
        trace: [],
      };
    }
    case 'extend': {
      const { place } = action;
      const before = trace.at(-2);
      if (before !== undefined && samePlace(before, place))
        return { ...state, trace: trace.slice(0, -1) };
      const last = trace.at(-1);
      const locked = puzzle.words.some(
        ({ path }, i) =>
          state.words[i]?.kind === 'found' && path.some((at) => samePlace(at, place)),
      );
      const fits =
        insideGrid(place) &&
        !locked &&
        !trace.some((at) => samePlace(at, place)) &&
        (last === undefined || areAdjacent(last, place));
      return fits
        ? { ...state, trace: [...trace, { row: place.row, column: place.column }] }
        : state;
    }
  }
}
