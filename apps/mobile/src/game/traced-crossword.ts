import { fill, type EditionStrings } from '@slovo/contracts';
import {
  isSolved,
  type Composition,
  type DailyCrosswordState,
  type CrosswordPuzzle,
  type PuzzleAction,
  type PuzzlePlace,
  type PuzzleState,
  type TracedCrossword,
} from '@slovo/core';
import type { CrosswordMiniCell, TracedMiss, TracedWord } from '@slovo/ui';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';

/** How many Words of the puzzle are found. */
const foundCount = ({ words }: PuzzleState) => words.filter(({ kind }) => kind === 'found').length;

/**
 * The small grid of the traced Daily Crossword's card: the letters of the
 * Words found in their cells, every other cell empty, as no cell is a block.
 */
export function tracedMiniGrid(puzzle: CrosswordPuzzle, state: PuzzleState): CrosswordMiniCell[][] {
  const grid: CrosswordMiniCell[][] = puzzle.grid.map((line) =>
    line.map(() => ({ kind: 'cell', letter: undefined })),
  );
  puzzle.words.forEach(({ path }, i) => {
    if (state.words[i]?.kind !== 'found') return;
    for (const { row, column } of path) {
      const line = grid[row];
      const letter = puzzle.grid[row]?.[column]?.letter;
      if (line !== undefined) line[column] = { kind: 'cell', letter };
    }
  });
  return grid;
}

/** How far the reader is in the traced Daily Crossword, as its card says it. */
export function tracedProgress(state: PuzzleState): DailyCrosswordState['progress'] {
  if (isSolved(state)) return 'solved';
  return foundCount(state) > 0 ? 'started' : 'untouched';
}

/** The hidden Words as the grid draws them: each clue, and the cells of the Words found. */
function tracedWords(puzzle: CrosswordPuzzle, state: PuzzleState): TracedWord[] {
  return puzzle.words.map(({ clue, path }, i) =>
    state.words[i]?.kind === 'found'
      ? { kind: 'found', clue, path }
      : { kind: 'hidden', clue, length: path.length },
  );
}

/** The texts of the traced grid in the Edition's strings. */
export function tracedTexts(strings: EditionStrings['game']['dailyCrossword']) {
  return {
    cellLabel: (letter: string, { row, column }: PuzzlePlace) =>
      fill(strings.tracedCellLabel, { letter, row: String(row + 1), column: String(column + 1) }),
    clueLabel: (clue: string, found: string | undefined) =>
      found === undefined
        ? fill(strings.clueHidden, { clue })
        : fill(strings.clueFound, { clue, word: found }),
    check: strings.check,
  };
}

/** Today's traced Daily Crossword on its screen: what the grid draws, and the reader's moves. */
export interface TracedCrosswordPlay {
  readonly kind: 'play';
  readonly puzzle: CrosswordPuzzle;
  readonly words: readonly TracedWord[];
  readonly trace: readonly PuzzlePlace[];
  /** The last trace that locked no Word, which the grid fades out. */
  readonly miss: TracedMiss | undefined;
  readonly solved: boolean;
  readonly extend: (place: PuzzlePlace) => void;
  readonly stepBack: () => void;
  readonly release: () => void;
}

/**
 * What the Daily Crossword's screen shows: the traced puzzle, or the printed
 * Daily Crossword (`printed`) while the Edition has the traced one off or the
 * Words within the Rarity Ceiling cannot fill its grid (ADR 0073).
 */
export type TracedCrosswordView = { readonly kind: 'printed' } | TracedCrosswordPlay;

interface Opened {
  readonly in: Composition;
  readonly crossword: TracedCrossword | undefined;
  readonly state: PuzzleState | undefined;
  readonly miss: TracedMiss | undefined;
}

/**
 * Today's traced Daily Crossword for its screen, opened with the Words this
 * device found as the screen opens and again in a composition reopened:
 * `undefined` while it opens. Each move goes to the Core in turn; a release
 * of two cells or more that locks no Word becomes the `miss`. A move that
 * fails is logged and changes nothing; an opening that fails falls back to
 * the printed Daily Crossword.
 */
export function useTracedCrossword(): TracedCrosswordView | undefined {
  const composition = useComposition();
  const [opened, setOpened] = useState<Opened>();
  useEffect(() => {
    let active = true;
    composition.openTracedCrossword().then(
      (opening) => {
        if (!active) return;
        const crossword = opening.kind === 'open' ? opening.crossword : undefined;
        setOpened({ in: composition, crossword, state: crossword?.state, miss: undefined });
      },
      (error: unknown) => {
        logError('Could not open the traced Daily Crossword', error);
        if (active)
          setOpened({ in: composition, crossword: undefined, state: undefined, miss: undefined });
      },
    );
    return () => {
      active = false;
    };
  }, [composition]);

  if (opened?.in !== composition) return undefined;
  const { crossword, state, miss } = opened;
  if (crossword === undefined || state === undefined) return { kind: 'printed' };

  const play = (action: PuzzleAction) => {
    crossword.play(action).then(
      (next) => {
        setOpened((now) => {
          if (now?.crossword !== crossword || now.state === undefined) return now;
          const missed =
            action.type === 'release' &&
            now.state.trace.length > 1 &&
            foundCount(next) === foundCount(now.state);
          return {
            ...now,
            state: next,
            miss: missed ? { key: (now.miss?.key ?? 0) + 1, path: now.state.trace } : now.miss,
          };
        });
      },
      (error: unknown) => {
        logError('Could not keep the traced Daily Crossword', error);
      },
    );
  };
  return {
    kind: 'play',
    puzzle: crossword.puzzle,
    words: tracedWords(crossword.puzzle, state),
    trace: state.trace,
    miss,
    solved: isSolved(state),
    extend: (place) => {
      play({ type: 'extend', place });
    },
    stepBack: () => {
      play({ type: 'stepBack' });
    },
    release: () => {
      play({ type: 'release' });
    },
  };
}

/**
 * Whether VoiceOver or TalkBack is on, which turns the traced grid's cells
 * into buttons; off until the system answers.
 */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (enabled) => {
        if (active) setOn(enabled);
      },
      () => undefined,
    );
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return on;
}

export const tracedCrosswordTexts = tracedTexts(editionStrings.game.dailyCrossword);
