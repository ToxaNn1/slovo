import { openFeed, systemClock, systemRandom, type Feed, type FeedCard } from '@slovo/core';
import { createPackReader } from '@slovo/language-pack/reader';
import { useIsFocused } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { edition } from './edition';
import { storedUserState } from './stored-user-state';

export type FeedState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly cards: readonly FeedCard[];
      /** Tells the Feed which card is on screen now. */
      readonly onCardChange: (position: number) => void;
      /**
       * Opens a Correction the Word card at `position` links, as the card
       * right after it. Resolves to that card's position, or nothing.
       */
      readonly openLinkedCorrection: (
        position: number,
        correctionId: string,
      ) => Promise<number | undefined>;
    };

/**
 * The Core's Feed over the bundled Language Pack and the stored user state.
 * It reports the card on screen to the Core while Home is focused and the app
 * is in the foreground, so the Core can tell what the reader has Seen, and it
 * keeps one card ready after the current one.
 */
export function useFeed(): FeedState {
  const db = useSQLiteContext();
  const [feed, setFeed] = useState<Feed>();
  const [failed, setFailed] = useState(false);
  const [cards, setCards] = useState<readonly FeedCard[]>([]);
  const [position, setPosition] = useState(0);
  const loadingNext = useRef(false);
  const focused = useIsFocused();
  const appActive = useAppActive();
  const onScreen = focused && appActive;

  useEffect(() => {
    let active = true;
    storedUserState()
      .then((userState) =>
        openFeed({
          content: createPackReader(db),
          edition,
          userState,
          clock: systemClock,
          random: systemRandom,
        }),
      )
      .then(
        (opened) => {
          if (!active) return;
          setFeed(opened);
          setCards([...opened.cards]);
        },
        (error: unknown) => {
          console.error('Could not open the Feed', error);
          if (active) setFailed(true);
        },
      );
    return () => {
      active = false;
    };
  }, [db]);

  // The card on screen, as the Core counts dwell time for Seen.
  useEffect(() => {
    if (feed === undefined || !onScreen || position >= feed.cards.length) return;
    report(feed.cardVisible(position));
    return () => {
      report(feed.cardHidden(position));
    };
  }, [feed, onScreen, position]);

  // One card ready after the current one, so the next swipe never waits.
  useEffect(() => {
    if (feed === undefined || loadingNext.current || position < cards.length - 1) return;
    loadingNext.current = true;
    feed
      .next()
      .then(
        (card) => {
          if (card !== undefined) setCards([...feed.cards]);
        },
        (error: unknown) => {
          console.error('Could not read the next card of the Feed', error);
        },
      )
      .finally(() => {
        loadingNext.current = false;
      });
  }, [feed, position, cards.length]);

  const onCardChange = useCallback((next: number) => {
    setPosition(next);
  }, []);

  const openLinkedCorrection = useCallback(
    async (at: number, correctionId: string) => {
      if (feed === undefined) return undefined;
      const opened = await feed.openLinkedCorrection(at, correctionId);
      if (opened !== undefined) setCards([...feed.cards]);
      return opened;
    },
    [feed],
  );

  if (failed) return { status: 'failed' };
  if (feed === undefined) return { status: 'loading' };
  return { status: 'ready', cards, onCardChange, openLinkedCorrection };
}

function report(done: Promise<void>): void {
  done.catch((error: unknown) => {
    console.error('Could not keep the Feed state', error);
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
