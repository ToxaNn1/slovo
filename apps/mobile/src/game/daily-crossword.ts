import { fill, pluralCount, type EditionStrings } from '@slovo/contracts';
import type { Composition, CrossingPlay, CrossingPuzzle, DailyCrosswordState } from '@slovo/core';
import type { CrosswordDayCardState, CrosswordMiniCell, DailyCrosswordCard } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';

import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { crossingMiniGrid, crossingProgress } from './crossing-crossword';
import { tracedMiniGrid, tracedProgress } from './traced-crossword';

/**
 * What the Daily Crossword's card draws: the crossing one's card in board
 * 08's states (ADR 0087), or the traced one's red card while the crossing one
 * is off (ADR 0073).
 */
export type DailyCrosswordCardContent =
  | {
      readonly kind: 'crossing';
      readonly title: string;
      readonly state: CrosswordDayCardState;
    }
  | ({ readonly kind: 'traced' } & Omit<
      ComponentProps<typeof DailyCrosswordCard>,
      'testID' | 'onPress'
    >);

/** A solve of the day as the XP log records it. */
type CrosswordSolve = ReturnType<Composition['xpLog']['crosswordSolveOn']>;

type Strings = EditionStrings['game']['dailyCrossword'];
type Months = EditionStrings['dates']['months'];

/** The day and month of a date, such as «26 жовтня». */
function dayOf(date: string, strings: Strings, months: Months): string {
  const [, month = 0, day = 0] = date.split('-').map(Number);
  const monthName = months[month - 1];
  if (monthName === undefined) throw new Error(`The Daily Crossword's date «${date}» has no month`);
  return fill(strings.dated, { day: String(day), month: monthName });
}

/** A Solve time as minutes and seconds, such as «4:12». */
const clockTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;

/** The solved card's time line: «за {time} · без підказок», «за {time}» after a hint, none for a record with no time. */
function resultOf(solve: CrosswordSolve, strings: Strings): string | undefined {
  if (solve?.solveSeconds === undefined) return undefined;
  const time = fill(strings.solvedIn, { time: clockTime(solve.solveSeconds) });
  return solve.hinted ? time : `${time} · ${strings.noHints}`;
}

/** The crossing Daily Crossword's card in the Edition's texts, by how far the reader is. */
function crossingCard(
  { puzzle, state, solve }: CrossingCardState,
  strings: Strings,
  months: Months,
): DailyCrosswordCardContent {
  const title = `${strings.title} · ${dayOf(puzzle.date, strings, months)}`;
  const progress = crossingProgress(state);
  if (progress === 'solved')
    return {
      kind: 'crossing',
      title,
      state: {
        kind: 'solved',
        mark: strings.solvedMark,
        result: resultOf(solve, strings),
        grid: crossingMiniGrid(puzzle, state).map((cells) =>
          cells.map((cell) => cell.kind === 'cell'),
        ),
      },
    };
  if (progress === 'started')
    return {
      kind: 'crossing',
      title,
      state: {
        kind: 'resume',
        action: strings.resume,
        solved: state.words.filter((word) => word.kind === 'solved').length,
        total: puzzle.words.length,
      },
    };
  const size = fill(strings.size, { size: String(crossingMiniGrid(puzzle, state).length) });
  const words = pluralCount(edition.locale)(strings.words, puzzle.words.length);
  return {
    kind: 'crossing',
    title,
    state: { kind: 'start', line: `${size} · ${words}`, action: strings.start },
  };
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
  strings: Strings,
  months: Months,
): DailyCrosswordCardContent {
  const { date, progress } = state;
  return {
    kind: 'traced',
    title: strings.title,
    day: dayOf(date, strings, months),
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

type TracedCardState = Parameters<typeof dailyCrosswordCard>[0];

/** Today's crossing Daily Crossword, the play kept and its solve as the XP log records it. */
interface CrossingCardState {
  readonly puzzle: CrossingPuzzle;
  readonly state: CrossingPlay;
  readonly solve: CrosswordSolve;
}

type CardState =
  | ({ readonly kind: 'crossing' } & CrossingCardState)
  | ({ readonly kind: 'traced' } & TracedCardState);

/**
 * What the card shows: today's crossing Daily Crossword (ADR 0087), none on a
 * day no pattern fills, and while it is off the traced one when it opens
 * (ADR 0073).
 */
async function cardState(composition: Composition): Promise<CardState | undefined> {
  const crossing = await composition.openCrossingCrossword().catch((error: unknown) => {
    logError('Could not open the crossing Daily Crossword', error);
    return undefined;
  });
  if (crossing?.kind === 'open') {
    const { puzzle, state } = crossing.crossword;
    return {
      kind: 'crossing',
      puzzle,
      state,
      solve: composition.xpLog.crosswordSolveOn(puzzle.date),
    };
  }
  if (crossing?.kind === 'no-fill') return undefined;
  const traced = await composition.openTracedCrossword();
  if (traced.kind !== 'open') return undefined;
  const { puzzle, state } = traced.crossword;
  return {
    kind: 'traced',
    date: puzzle.date,
    progress: tracedProgress(state),
    grid: tracedMiniGrid(puzzle, state),
  };
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
  if (state === undefined) return undefined;
  const { dailyCrossword: strings } = editionStrings.game;
  const { months } = editionStrings.dates;
  return state.kind === 'crossing'
    ? crossingCard(state, strings, months)
    : dailyCrosswordCard(state, strings, months);
}
