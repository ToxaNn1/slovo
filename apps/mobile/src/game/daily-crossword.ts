import { fill, pluralCount, type EditionStrings } from '@slovo/contracts';
import type {
  Composition,
  CrossingCrosswordOpening,
  CrossingPlay,
  CrossingPuzzle,
  CrosswordSolve,
  DailyCrosswordProgress,
} from '@slovo/core';
import type { CrosswordDayCardState } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useComposition, useCompositionRead } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { deviceClock } from '../device/device-clock';
import { logError } from '../diagnostics/log';
import { useTodayKey } from '../foreground/today';
import { crossingMiniGrid } from './crossing-crossword';
import { solveTimeText } from './crossword-share';

/** What the Daily Crossword's card draws: the crossing one's card in board 08's states. */
export interface DailyCrosswordCardContent {
  readonly title: string;
  readonly state: CrosswordDayCardState;
}

type Strings = EditionStrings['game']['dailyCrossword'];
type Months = EditionStrings['dates']['months'];

/** The day and month of a date, such as «26 жовтня». */
function dayOf(date: string, strings: Strings, months: Months): string {
  const [, month = 0, day = 0] = date.split('-').map(Number);
  const monthName = months[month - 1];
  if (monthName === undefined) throw new Error(`The Daily Crossword's date «${date}» has no month`);
  return fill(strings.dated, { day: String(day), month: monthName });
}

/** The solved card's time line: «за {time} · без підказок», «за {time}» after a hint, none for a record with no time. */
function resultOf(solve: CrosswordSolve, strings: Strings): string | undefined {
  if (solve.solveSeconds === undefined) return undefined;
  const time = fill(strings.solvedIn, { time: solveTimeText(solve.solveSeconds) });
  return solve.hinted ? time : `${time} · ${strings.noHints}`;
}

/** The crossing Daily Crossword's card in the Edition's texts, by how far the reader is. */
function crossingCard(
  { puzzle, state, solve, progress }: CrossingCardState,
  strings: Strings,
  months: Months,
): DailyCrosswordCardContent {
  const title = `${strings.title} · ${dayOf(puzzle.date, strings, months)}`;
  if (solve !== undefined)
    return {
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
    title,
    state: { kind: 'start', line: `${size} · ${words}`, action: strings.start },
  };
}

/** Today's crossing Daily Crossword, the play kept, its solve, synced in the XP log, and how far the reader is. */
interface CrossingCardState {
  readonly puzzle: CrossingPuzzle;
  readonly state: CrossingPlay;
  readonly solve: CrosswordSolve | undefined;
  readonly progress: DailyCrosswordProgress;
}

async function cardState(composition: Composition): Promise<CrossingCardState | undefined> {
  const opening = await composition.openDailyCrossword();
  if (opening.kind !== 'open') return undefined;
  const { puzzle, state, solve, progress } = opening.crossword;
  return { puzzle, state, solve, progress };
}

/** Today's Daily Crossword for its screen: as the Core opened it, or `failed` when the opening failed. */
export type DailyCrosswordScreenOpening = CrossingCrosswordOpening | { readonly kind: 'failed' };

/**
 * Today's Daily Crossword for its screen, as the Core opened it, opened as the
 * screen opens, again in a composition reopened and again once the next
 * local day has started: `undefined` while it first opens. An opening that
 * fails is logged.
 */
export function useDailyCrossword(): DailyCrosswordScreenOpening | undefined {
  const today = useTodayKey(deviceClock);
  const open = useCallback(
    // Read again for each day: the Core opens the crossword of the day it is.
    (composition: Composition) => composition.openDailyCrossword(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `today` is the cue to read again
    [today],
  );
  const reading = useCompositionRead(open, 'Could not open the Daily Crossword');
  if (reading.status === 'loading') return undefined;
  return reading.status === 'ready' ? reading.value : { kind: 'failed' };
}

/**
 * The card of today's Daily Crossword, read each time the screen that shows
 * it comes into view, so it shows what the crossword's screen left, again
 * in a composition reopened and again once the next local day has started; nothing while it is first read, with its Feature
 * Switch off or with no day for the local date in the Language Pack. A read
 * that fails is logged and shows no card.
 */
export function useDailyCrosswordCard(): DailyCrosswordCardContent | undefined {
  const composition = useComposition();
  const today = useTodayKey(deviceClock);
  const [read, setRead] = useState<{
    in: Composition;
    on: string;
    state: CrossingCardState | undefined;
  }>();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      cardState(composition).then(
        (state) => {
          if (active) setRead({ in: composition, on: today, state });
        },
        (error: unknown) => {
          logError('Could not open the Daily Crossword', error);
          if (active) setRead({ in: composition, on: today, state: undefined });
        },
      );
      return () => {
        active = false;
      };
    }, [composition, today]),
  );
  const state = read?.in === composition && read.on === today ? read.state : undefined;
  if (state === undefined) return undefined;
  const { dailyCrossword: strings } = editionStrings.game;
  const { months } = editionStrings.dates;
  return crossingCard(state, strings, months);
}
