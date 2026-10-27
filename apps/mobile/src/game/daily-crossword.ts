import { fill, type EditionStrings } from '@slovo/contracts';
import type { DailyCrosswordState } from '@slovo/core';
import type { DailyCrosswordCard } from '@slovo/ui';
import { useEffect, useState, type ComponentProps } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { logError } from '../log';

/** What the Daily Crossword's card draws. */
export type DailyCrosswordCardContent = Omit<ComponentProps<typeof DailyCrosswordCard>, 'testID'>;

/**
 * The Daily Crossword's card in the Edition's texts: its name with the day
 * and month of its date, and «Почати», «Продовжити» or the solved mark.
 */
export function dailyCrosswordCard(
  { date, progress }: DailyCrosswordState,
  strings: EditionStrings['game']['dailyCrossword'],
): DailyCrosswordCardContent {
  const [, month = 0, day = 0] = date.split('-').map(Number);
  return {
    title: fill(strings.dated, { day: String(day), month: strings.months[month - 1] ?? '' }),
    state:
      progress === 'solved'
        ? strings.solvedMark
        : progress === 'started'
          ? strings.resume
          : strings.start,
    solved: progress === 'solved',
  };
}

/**
 * The card of today's Daily Crossword, read as the screen that shows it
 * opens and again in a composition reopened; nothing while it is read, with
 * its Feature Switch off or with no day for the local date in the Language
 * Pack. A read that fails is logged and shows no card.
 */
export function useDailyCrosswordCard(): DailyCrosswordCardContent | undefined {
  const composition = useComposition();
  const [state, setState] = useState<DailyCrosswordState>();
  useEffect(() => {
    let active = true;
    composition.openDailyCrossword().then(
      (crossword) => {
        if (active) setState(crossword?.state);
      },
      (error: unknown) => {
        logError('Could not open the Daily Crossword', error);
      },
    );
    return () => {
      active = false;
    };
  }, [composition]);
  return state && dailyCrosswordCard(state, editionStrings.game.dailyCrossword);
}
