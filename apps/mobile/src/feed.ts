import type { Feed, FeedCard } from '@slovo/core';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useComposition } from './composition';

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
       * The position of the card on screen now, or nothing when it is not
       * known. It moves when a hide or its undo drops or puts back cards, also
       * while Home is out of focus, so the pager shows it after the cards change.
       */
      readonly positionOnScreen: () => number | undefined;
      /**
       * Opens a Correction the Word card at `position` links, as the card
       * right after it. Resolves to that card's position, or nothing.
       */
      readonly openLinkedCorrection: Feed['openLinkedCorrection'];
    };

const noCards: readonly FeedCard[] = [];

/**
 * The Feed of the session's Core composition.
 * It tells the Feed which card is on screen while Home is focused and the app
 * is in the foreground, and that none is otherwise.
 */
export function useFeed(): FeedState {
  const composition = useComposition();
  const feed = composition.status === 'ready' ? composition.composition.feed : undefined;
  /** The card on screen, once the reader turned a page; until then the one the Feed opens on. */
  const [turnedTo, setTurnedTo] = useState<number>();
  const position = turnedTo ?? feed?.startPosition;
  const focused = useIsFocused();
  const appActive = useAppActive();
  const onScreen = focused && appActive;
  const subscribe = useCallback(
    (listener: () => void) => feed?.subscribe(listener) ?? (() => undefined),
    [feed],
  );
  const cards = useSyncExternalStore(subscribe, () => feed?.cards ?? noCards);
  /** The card last told to the Feed as on screen, which Home keeps while out of focus. */
  const shown = useRef<FeedCard>(undefined);
  const positionOnScreen = useCallback(() => {
    if (feed === undefined) return undefined;
    if (feed.position !== undefined) return feed.position;
    // With no card on screen the Feed keeps no place, so follow the card the reader left.
    const at = shown.current === undefined ? -1 : feed.cards.indexOf(shown.current);
    return at === -1 ? undefined : at;
  }, [feed]);

  // A new position goes straight to the Feed, which takes the card that left
  // off the screen itself; only leaving Home or the foreground reports none.
  useEffect(() => {
    if (feed === undefined || position === undefined || !onScreen) return;
    shown.current = feed.cards[position];
    report(feed.show(position));
  }, [feed, onScreen, position]);
  useEffect(() => {
    if (feed === undefined || !onScreen) return;
    return () => {
      report(feed.show(undefined));
    };
  }, [feed, onScreen]);

  if (composition.status === 'failed') return { status: 'failed', retry: composition.retry };
  if (feed === undefined) return { status: 'loading' };
  return {
    status: 'ready',
    cards,
    startPosition: feed.startPosition,
    onCardChange: setTurnedTo,
    positionOnScreen,
    openLinkedCorrection: (at, correctionId) => feed.openLinkedCorrection(at, correctionId),
  };
}

function report(done: Promise<void>): void {
  done.catch((error: unknown) => {
    console.error('Could not keep the Feed state or get the next card ready', error);
  });
}

/** Whether the app is in the foreground. */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
    });
    return () => {
      subscription.remove();
    };
  }, []);
  return active;
}
