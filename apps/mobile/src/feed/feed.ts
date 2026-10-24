import type { FeedCard } from '@slovo/core';
import type { VerticalPagerHandle } from '@slovo/ui';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState, type RefObject } from 'react';

import { useComposition } from '../composition';
import { useInForeground } from '../lifecycle';
import { logError } from '../log';
import { useSubscribed } from '../opening';
import { cardOnScreen, type TurnedTo } from './feed-screen';

export interface FeedState {
  readonly cards: readonly FeedCard[];
  /** The position of the card the Feed opens on. */
  readonly startPosition: number;
  /** Tells the Feed which card is on screen now. */
  readonly onCardChange: (position: number) => void;
  /**
   * Opens a Correction the Word card at `position` links, as the card right
   * after it, and turns the pager to it once it is drawn.
   */
  readonly openCorrection: (position: number, correctionId: string) => void;
}

/**
 * The Feed of the session's Core composition, on the pager that shows it.
 * It tells the Feed which card is on screen while the Feed is in sight, and
 * that none is otherwise, and keeps the pager on the reader's card.
 */
export function useFeed(pager: RefObject<VerticalPagerHandle | null>): FeedState {
  const { feed, onboarding } = useComposition();
  /** The page the reader turned to last, in the Feed they turned it in. */
  const [turnedTo, setTurnedTo] = useState<TurnedTo>();
  const onCardChange = useCallback(
    (to: number) => {
      setTurnedTo({ in: feed, position: to });
    },
    [feed],
  );
  const focused = useIsFocused();
  const inForeground = useInForeground();
  const covered = useSubscribed(onboarding, ({ state }) => state.step !== undefined);
  const onScreen = cardOnScreen({ feed, turnedTo, focused, inForeground, covered });
  const inSight = onScreen !== undefined;
  const cards = useSubscribed(feed, (open) => open.cards);
  /** The page to turn to once it is drawn, such as a Correction opened from a Word. */
  const [turnTo, setTurnTo] = useState<number>();
  // Kept from render to render, so the Feed's pages re-render only when their card changes.
  const openCorrection = useCallback(
    (position: number, correctionId: string) => {
      feed.openLinkedCorrection(position, correctionId).then(setTurnTo, (error: unknown) => {
        logError('Could not open the linked Correction', error);
      });
    },
    [feed],
  );

  // A new position goes straight to the Feed, which takes the card that left
  // off the screen itself; only the Feed going out of sight reports none. The
  // Feed of a composition a reopen replaced is closed by then, so its
  // cleanup keeps nothing, and the new Feed opens on the reader's card.
  useEffect(() => {
    if (onScreen === undefined) return;
    report(feed.show(onScreen));
  }, [feed, onScreen]);
  useEffect(() => {
    if (!inSight) return;
    return () => {
      report(feed.show(undefined));
    };
  }, [feed, inSight]);

  useEffect(() => {
    if (turnTo === undefined) return;
    pager.current?.turnTo(turnTo);
    setTurnTo(undefined);
  }, [pager, turnTo]);
  // A hide or its undo drops or puts back cards, and the reader's card moves
  // with them, also out of sight: the pager shows it at once. When the Feed
  // has no card to put after a hidden one, the Feed is told no position past
  // its cards, and the pager shows its last card.
  useEffect(() => {
    const position = feed.position;
    if (position >= cards.length) return;
    pager.current?.showPage(position);
    onCardChange(position);
  }, [pager, feed, cards, onCardChange]);

  return { cards, startPosition: feed.startPosition, onCardChange, openCorrection };
}

function report(done: Promise<void>): void {
  done.catch((error: unknown) => {
    logError('Could not keep the Feed state or get the next card ready', error);
  });
}
