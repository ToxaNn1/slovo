import { fill, type EditionStrings } from '@slovo/contracts';
import type { Composition, DailyCrosswordState } from '@slovo/core';
import type { CrosswordMiniCell, DailyCrosswordCard } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { crossingMiniGrid, crossingProgress } from './crossing-crossword';
import { tracedMiniGrid, tracedProgress } from './traced-crossword';

/** What the Daily Crossword's card draws. */
export type DailyCrosswordCardContent = Omit<
  ComponentProps<typeof DailyCrosswordCard>,
  'testID' | 'onPress'
>;

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
      date: puzzle.date,
      progress: crossingProgress(state),
      grid: crossingMiniGrid(puzzle, state),
    };
  }
  if (crossing?.kind === 'no-fill') return undefined;
  const traced = await composition.openTracedCrossword();
  if (traced.kind !== 'open') return undefined;
  const { puzzle, state } = traced.crossword;
  return {
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
  return (
    state &&
    dailyCrosswordCard(state, editionStrings.game.dailyCrossword, editionStrings.dates.months)
  );
}
