import { fill, type EditionStrings } from '@slovo/contracts';
import type {
  Composition,
  CrosswordPlace,
  DailyCrossword,
  DailyCrosswordState,
  DailyCrosswordWord,
} from '@slovo/core';
import type { DailyCrosswordCard } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';

/** What the Daily Crossword's card draws. */
export type DailyCrosswordCardContent = Omit<
  ComponentProps<typeof DailyCrosswordCard>,
  'testID' | 'onPress'
>;

/**
 * The Daily Crossword's card in the Edition's texts: its name with the day
 * and month of its date, and «Почати», «Продовжити» or the solved mark.
 */
function dailyCrosswordCard(
  { date, progress }: DailyCrosswordState,
  strings: EditionStrings['game']['dailyCrossword'],
): DailyCrosswordCardContent {
  const [, month = 0, day = 0] = date.split('-').map(Number);
  const monthName = strings.months[month - 1];
  if (monthName === undefined) throw new Error(`The Daily Crossword's date «${date}» has no month`);
  return {
    title: fill(strings.dated, { day: String(day), month: monthName }),
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
 * The card of today's Daily Crossword, read each time the screen that shows
 * it comes into view, so it shows what the crossword's screen left, and again
 * in a composition reopened; nothing while it is first read, with its Feature
 * Switch off or with no day for the local date in the Language Pack. A read
 * that fails is logged and shows no card.
 */
export function useDailyCrosswordCard(): DailyCrosswordCardContent | undefined {
  const composition = useComposition();
  const [read, setRead] = useState<{ in: Composition; state: DailyCrosswordState | undefined }>();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      composition.openDailyCrossword().then(
        (crossword) => {
          if (active) setRead({ in: composition, state: crossword?.state });
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
  return state && dailyCrosswordCard(state, editionStrings.game.dailyCrossword);
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
      move.then(
        (state) => {
          setOpened((now) => (now && now.crossword === crossword ? { ...now, state } : now));
        },
        (error: unknown) => {
          logError('Could not keep the Daily Crossword', error);
        },
      );
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
 * and its place in the word that reads across through it, or else down, such
 * as «к, перша літера».
 */
export function crosswordCellLabel(
  words: readonly DailyCrosswordWord[],
  texts: EditionStrings['game']['letters'],
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
  const place = texts.ordinals[index] ?? String(index + 1);
  return letter === undefined ? fill(texts.empty, { place }) : fill(texts.label, { letter, place });
}
