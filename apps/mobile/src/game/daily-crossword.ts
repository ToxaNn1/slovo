import { fill, type EditionStrings } from '@slovo/contracts';
import type {
  Composition,
  CrosswordPlace,
  DailyCrossword,
  DailyCrosswordState,
  DailyCrosswordWord,
} from '@slovo/core';
import type { CrosswordMiniCell, DailyCrosswordCard } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { keep } from '../keep';
import { tracedMiniGrid, tracedProgress } from './traced-crossword';

/** What the Daily Crossword's card draws. */
export type DailyCrosswordCardContent = Omit<
  ComponentProps<typeof DailyCrosswordCard>,
  'testID' | 'onPress'
>;

/**
 * The small grid of the Daily Crossword's card: each place of its letters, a
 * cell with the letter typed in it where a word reads through, else dark.
 */
function miniGrid({ letters, words }: DailyCrosswordState): CrosswordMiniCell[][] {
  const inWord = ({ row, column }: CrosswordPlace) =>
    words.some(({ start, direction, length }) =>
      direction === 'across'
        ? row === start.row && column >= start.column && column < start.column + length
        : column === start.column && row >= start.row && row < start.row + length,
    );
  return letters.map((cells, row) =>
    cells.map((letter, column) =>
      inWord({ row, column }) ? { kind: 'cell', letter } : { kind: 'block' },
    ),
  );
}

/**
 * The Daily Crossword's card in the Edition's texts: its name, the day and
 * month of its date, «Почати», «Продовжити» or the solved mark, and its grid
 * with the letters typed.
 */
function dailyCrosswordCard(
  state: Pick<DailyCrosswordState, 'date' | 'progress'> & {
    readonly grid: readonly (readonly CrosswordMiniCell[])[];
  },
  strings: EditionStrings['game']['dailyCrossword'],
  months: EditionStrings['dates']['months'],
): DailyCrosswordCardContent {
  const { date, progress } = state;
  const [, month = 0, day = 0] = date.split('-').map(Number);
  const monthName = months[month - 1];
  if (monthName === undefined) throw new Error(`The Daily Crossword's date «${date}» has no month`);
  return {
    title: strings.title,
    day: fill(strings.dated, { day: String(day), month: monthName }),
    solved: progress === 'solved',
    grid: state.grid,
    state:
      progress === 'solved'
        ? strings.solvedMark
        : progress === 'started'
          ? strings.resume
          : strings.start,
  };
}

type CardState = Parameters<typeof dailyCrosswordCard>[0];

/** What the card shows: today's traced Daily Crossword when it opens (ADR 0073), else the printed one. */
async function cardState(composition: Composition): Promise<CardState | undefined> {
  const traced = await composition.openTracedCrossword().catch((error: unknown) => {
    logError('Could not open the traced Daily Crossword', error);
    return undefined;
  });
  if (traced?.kind === 'open') {
    const { puzzle, state } = traced.crossword;
    return {
      date: puzzle.date,
      progress: tracedProgress(state),
      grid: tracedMiniGrid(puzzle, state),
    };
  }
  const crossword = await composition.openDailyCrossword();
  return crossword && { ...crossword.state, grid: miniGrid(crossword.state) };
}

/**
 * The card of today's Daily Crossword, read each time the screen that shows
 * it comes into view, so it shows what the crossword's screen left, and again
 * in a composition reopened; nothing while it is first read, with its Feature
 * Switch off or with no day for the local date in the Language Pack. A read
 * that fails is logged and shows no card.
 */
export function useDailyCrosswordCard(): DailyCrosswordCardContent | undefined {
  const composition = useComposition();
  const [read, setRead] = useState<{ in: Composition; state: CardState | undefined }>();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      cardState(composition).then(
        (state) => {
          if (active) setRead({ in: composition, state });
        },
        (error: unknown) => {
          logError('Could not open the Daily Crossword', error);
        },
      );
      return () => {
        active = false;
      };
    }, [composition]),
  );
  const state = read?.in === composition ? read.state : undefined;
  return (
    state &&
    dailyCrosswordCard(state, editionStrings.game.dailyCrossword, editionStrings.dates.months)
  );
}

/** Today's Daily Crossword on its screen: its state, and the reader's moves. */
export interface DailyCrosswordPlay {
  readonly state: DailyCrosswordState;
  /** Puts a letter in a cell, or erases it with `undefined`. */
  readonly setLetter: (place: CrosswordPlace, letter: string | undefined) => void;
  /** «Відкрити літеру»: opens a cell's right letter. */
  readonly openCell: (place: CrosswordPlace) => void;
}

/**
 * Today's Daily Crossword for its screen, opened with the letters this device
 * kept for it as the screen opens and again in a composition reopened:
 * `undefined` while it opens, `null` with its Feature Switch off or no day for
 * the local date. Each move keeps the letters on the device as the Core
 * answers it; a move that fails is logged and changes nothing.
 */
export function useDailyCrossword(): DailyCrosswordPlay | null | undefined {
  const composition = useComposition();
  const [opened, setOpened] = useState<{
    in: Composition;
    crossword: DailyCrossword | undefined;
    state: DailyCrosswordState | undefined;
  }>();
  useEffect(() => {
    let active = true;
    composition.openDailyCrossword().then(
      (crossword) => {
        if (active) setOpened({ in: composition, crossword, state: crossword?.state });
      },
      (error: unknown) => {
        logError('Could not open the Daily Crossword', error);
      },
    );
    return () => {
      active = false;
    };
  }, [composition]);

  const crossword = opened?.in === composition ? opened.crossword : undefined;
  const play = useCallback(
    (move: Promise<DailyCrosswordState>) => {
      void keep('the Daily Crossword', move).then((state) => {
        if (state === undefined) return;
        setOpened((now) => (now && now.crossword === crossword ? { ...now, state } : now));
      });
    },
    [crossword],
  );
  if (opened?.in !== composition) return undefined;
  if (crossword === undefined || opened.state === undefined) return null;
  return {
    state: opened.state,
    setLetter: (place, letter) => {
      play(crossword.setLetter(place, letter));
    },
    openCell: (place) => {
      play(crossword.openCell(place));
    },
  };
}

/**
 * What VoiceOver reads for a cell of the Daily Crossword: its letter, if any,
 * and its place in the word that reads across through it, or else down, that
 * word's clue and the cell's row and column, such as «к, перша літера. Звір.
 * Рядок 1, стовпець 1».
 */
export function crosswordCellLabel(
  words: readonly DailyCrosswordWord[],
  strings: Pick<EditionStrings['game'], 'letters' | 'dailyCrossword'>,
  letter: string | undefined,
  { row, column }: CrosswordPlace,
): string {
  const placeIn = ({ start, direction, length }: DailyCrosswordWord) => {
    const index = direction === 'across' ? column - start.column : row - start.row;
    const inLine = direction === 'across' ? row === start.row : column === start.column;
    return inLine && index >= 0 && index < length ? index : undefined;
  };
  const through = (direction: DailyCrosswordWord['direction']) =>
    words.find((word) => word.direction === direction && placeIn(word) !== undefined);
  const word = through('across') ?? through('down');
  const index = (word && placeIn(word)) ?? 0;
  const { letters, dailyCrossword } = strings;
  const place = letters.ordinals[index] ?? String(index + 1);
  return fill(dailyCrossword.cellLabel, {
    cell:
      letter === undefined
        ? fill(letters.empty, { place })
        : fill(letters.label, { letter, place }),
    clue: word?.clue ?? '',
    row: String(row + 1),
    column: String(column + 1),
  });
}

/** How many letters a row of the crossword's keyboard holds when the Edition names no rows. */
const KEYS_PER_ROW = 11;

/**
 * The rows of the Daily Crossword's keyboard: the Edition's own, or its
 * alphabet in rows of eleven when it names none.
 */
export function crosswordKeys({
  keyboard,
  alphabet,
}: {
  readonly keyboard?: readonly (readonly string[])[] | undefined;
  readonly alphabet: readonly string[];
}): readonly (readonly string[])[] {
  if (keyboard !== undefined) return keyboard;
  return Array.from({ length: Math.ceil(alphabet.length / KEYS_PER_ROW) }, (_, row) =>
    alphabet.slice(row * KEYS_PER_ROW, (row + 1) * KEYS_PER_ROW),
  );
}
