import type { Feed, FeedCard } from '@slovo/core';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { useComposed, useComposition } from './composition';
import { useInForeground } from './lifecycle';

export type FeedState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'failed';
      /** Tries to open the Feed again. */
      readonly retry: () => void;
    }
  | {
      readonly status: 'ready';
      readonly cards: readonly FeedCard[];
      /** The position of the card the Feed opens on. */
      readonly startPosition: number;
      /** Tells the Feed which card is on screen now. */
      readonly onCardChange: (position: number) => void;
      /**
       * The reader's position as the Feed keeps it: the card on screen, or the
       * card the reader left while the Feed is out of sight. It moves when a
       * hide or its undo drops or puts back cards, also out of sight, so the
       * pager shows it after the cards change.
       */
      readonly readerPosition: () => number;
      /**
       * Opens a Correction the Word card at `position` links, as the card
       * right after it. Resolves to that card's position, or nothing.
       */
      readonly openLinkedCorrection: Feed['openLinkedCorrection'];
    };

const noCards: readonly FeedCard[] = [];

/**
 * The Feed of the session's Core composition.
 * It tells the Feed which card is on screen while the Feed is in sight, and
 * that none is otherwise.
 */
export function useFeed(): FeedState {
  const composition = useComposition();
  const feed = composition.status === 'ready' ? composition.composition.feed : undefined;
  /** The card on screen, once the reader turned a page; until then the one the Feed opens on. */
  const [turnedTo, setTurnedTo] = useState<number>();
  const position = turnedTo ?? feed?.startPosition;
  const focused = useIsFocused();
  const inForeground = useInForeground();
  const covered = useComposed(
    (open) => open.onboarding,
    ({ state }) => state.step !== undefined,
    false,
  );
  // The Feed is in sight while Home is focused, the app is in the foreground
  // and no onboarding covers it; otherwise no card is on screen.
  const inSight = focused && inForeground && !covered;
  const cards = useComposed(
    (open) => open.feed,
    (open) => open.cards,
    noCards,
  );
  const readerPosition = useMemo(
    () => (feed === undefined ? undefined : () => feed.position),
    [feed],
  );

  // A new position goes straight to the Feed, which takes the card that left
  // off the screen itself; only the Feed going out of sight reports none.
  useEffect(() => {
    if (feed === undefined || position === undefined || !inSight) return;
    report(feed.show(position));
  }, [feed, inSight, position]);
  useEffect(() => {
    if (feed === undefined || !inSight) return;
    return () => {
      report(feed.show(undefined));
    };
  }, [feed, inSight]);

  if (composition.status === 'failed') return { status: 'failed', retry: composition.retry };
  if (feed === undefined || readerPosition === undefined) return { status: 'loading' };
  return {
    status: 'ready',
    cards,
    startPosition: feed.startPosition,
    onCardChange: setTurnedTo,
    readerPosition,
    openLinkedCorrection: (at, correctionId) => feed.openLinkedCorrection(at, correctionId),
  };
}

function report(done: Promise<void>): void {
  done.catch((error: unknown) => {
    console.error('Could not keep the Feed state or get the next card ready', error);
  });
}
