import { openFeed, systemClock, type Feed, type FeedCard } from '@slovo/core';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { sharedCycle } from './cycle';
import { useEntries } from './language-pack';
import { storedUserState } from './stored-user-state';

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
       * Opens a Correction the Word card at `position` links, as the card
       * right after it. Resolves to that card's position, or nothing.
       */
      readonly openLinkedCorrection: Feed['openLinkedCorrection'];
    };

const noCards: readonly FeedCard[] = [];

/**
 * The Core's Feed over the bundled Language Pack, the stored user state and
 * the session's shared Cycle and Word of the Day.
 * It tells the Feed which card is on screen while Home is focused and the app
 * is in the foreground, and that none is otherwise.
 */
export function useFeed(): FeedState {
  const entries = useEntries();
  const [feed, setFeed] = useState<Feed>();
  const [failed, setFailed] = useState(false);
  /** Counts the tries to open the Feed, so a retry opens it again. */
  const [attempt, setAttempt] = useState(0);
  const [position, setPosition] = useState(0);
  const focused = useIsFocused();
  const appActive = useAppActive();
  const onScreen = focused && appActive;
  const subscribe = useCallback(
    (listener: () => void) => feed?.subscribe(listener) ?? (() => undefined),
    [feed],
  );
  const cards = useSyncExternalStore(subscribe, () => feed?.cards ?? noCards);

  useEffect(() => {
    let active = true;
    Promise.all([storedUserState(), sharedCycle(entries)])
      .then(([userState, { cycle, wordOfTheDay }]) =>
        openFeed({ entries, userState, clock: systemClock, cycle, wordOfTheDay }),
      )
      .then(
        (opened) => {
          if (!active) return;
          setFeed(opened);
          setPosition(opened.startPosition);
        },
        (error: unknown) => {
          console.error('Could not open the Feed', error);
          if (active) setFailed(true);
        },
      );
    return () => {
      active = false;
    };
  }, [entries, attempt]);

  useEffect(() => {
    if (feed === undefined || !onScreen) return;
    report(feed.show(position));
    return () => {
      report(feed.show(undefined));
    };
  }, [feed, onScreen, position]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((count) => count + 1);
  }, []);

  if (failed) return { status: 'failed', retry };
  if (feed === undefined) return { status: 'loading' };
  return {
    status: 'ready',
    cards,
    startPosition: feed.startPosition,
    onCardChange: setPosition,
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
