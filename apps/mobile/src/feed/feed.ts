import type { Feed, FeedCard } from '@slovo/core';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { useInForeground } from '../lifecycle';
import { useSubscribed } from '../opening';

export interface FeedState {
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
}

/**
 * The Feed of the session's Core composition.
 * It tells the Feed which card is on screen while the Feed is in sight, and
 * that none is otherwise.
 */
export function useFeed(): FeedState {
  const { feed, onboarding } = useComposition();
  /** The card on screen, once the reader turned a page; until then the one the Feed opens on. */
  const [turnedTo, setTurnedTo] = useState<number>();
  const position = turnedTo ?? feed.startPosition;
  const focused = useIsFocused();
  const inForeground = useInForeground();
  const covered = useSubscribed(onboarding, ({ state }) => state.step !== undefined);
  // The Feed is in sight while Home is focused, the app is in the foreground
  // and no onboarding covers it; otherwise no card is on screen.
  const inSight = focused && inForeground && !covered;
  const cards = useSubscribed(feed, (open) => open.cards);
  const readerPosition = useCallback(() => feed.position, [feed]);
  // Kept from render to render, so the Feed's pages re-render only when their card changes.
  const openLinkedCorrection = useCallback<Feed['openLinkedCorrection']>(
    (at, correctionId) => feed.openLinkedCorrection(at, correctionId),
    [feed],
  );

  // A new position goes straight to the Feed, which takes the card that left
  // off the screen itself; only the Feed going out of sight reports none.
  useEffect(() => {
    if (!inSight) return;
    report(feed.show(position));
  }, [feed, inSight, position]);
  useEffect(() => {
    if (!inSight) return;
    return () => {
      report(feed.show(undefined));
    };
  }, [feed, inSight]);

  return {
    cards,
    startPosition: feed.startPosition,
    onCardChange: setTurnedTo,
    readerPosition,
    openLinkedCorrection,
  };
}

function report(done: Promise<void>): void {
  done.catch((error: unknown) => {
    console.error('Could not keep the Feed state or get the next card ready', error);
  });
}
