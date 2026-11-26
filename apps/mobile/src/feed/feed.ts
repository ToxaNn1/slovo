import { isTodaysWordOfTheDay, type Clock, type FeedCard, type LocalDate } from '@slovo/core';
import type { VerticalPagerHandle } from '@slovo/ui';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore, type RefObject } from 'react';

import { useComposition } from '../composition';
import { useInForeground } from '../foreground/in-foreground';
import { keep } from '../keep';
import { prefetchAhead } from '../media/shell-media';
import { useSubscribed } from '../opening';
import { useShell } from '../shell-value';
import type { ReaderPlace } from './reader-place';
import type { WordOfTheDayLanding } from './word-of-the-day-landing';

/** The Feed as the pager shows it: a page for each of its cards. */
export interface FeedState {
  readonly cards: readonly FeedCard[];
  /** The local day the Feed's header says: the day the composition turned to last. */
  readonly today: LocalDate;
  /** Whether the Feed is in sight: its tab focused, the app in the foreground and nothing over it. */
  readonly inSight: boolean;
  /** The position of the card the Feed opens on. */
  readonly startPosition: number;
  /** Tells the Feed which card is on screen now. */
  readonly onCardChange: (position: number) => void;
  /**
   * Opens a Correction the Word card at `position` links, as the card right
   * after it, and turns the pager to it once it is drawn.
   */
  readonly openCorrection: (position: number, correctionId: string) => void;
  /** Keeps the option the reader picked on the Quick Question at `position`. */
  readonly answerQuickQuestion: (position: number, option: number) => void;
  /** Keeps the meaning the reader picked first on the Yesterday quiz at `position`. */
  readonly answerYesterday: (position: number, option: number) => void;
  /** «Готово»: folds the Weekly Recap at `position` away for its week. */
  readonly foldWeeklyRecap: (position: number) => void;
  /** «Повернути»: brings back the Weekly Recap folded this session, also when its page left the Feed. */
  readonly restoreWeeklyRecap: () => void;
}

/**
 * The Feed of the session's Core composition, on the pager that shows it.
 * It tells `place` the Feed and whether it is in sight, and the pages the
 * reader turns to; the pager follows the reader's card. An ask of `landing`
 * puts today's Word of the Day card on screen, by `clock`, once the Feed has
 * it. Out of focus the Feed waits in a hidden Activity, and back in sight its
 * effects run again: each takes only what is still asked, so a turn or a
 * landing already taken never takes the reader back to its page.
 */
export function useFeed(
  pager: RefObject<VerticalPagerHandle | null>,
  {
    clock,
    landing,
    place,
    voice,
  }: {
    clock: Clock;
    landing: WordOfTheDayLanding;
    /** The reader's place, which the Feed's screen tells and the Mascot reads. */
    place: ReaderPlace;
    /** The reader's Narrator Voice, which the Feed downloads its media ahead in. */
    voice: string;
  },
): FeedState {
  const { feed, onboarding } = useComposition();
  const shell = useShell();
  const cards = useSubscribed(feed, (open) => open.cards);
  const today = useSubscribed(feed, (open) => open.today);
  const focused = useIsFocused();
  const inForeground = useInForeground();
  const covered = useSubscribed(onboarding, ({ state }) => state.status === 'open');
  const inSight = focused && !covered && inForeground;
  // A turn goes straight to the reader's place: a swipe re-renders the
  // screen only when the Feed's cards change.
  const onCardChange = useCallback(
    (to: number) => {
      place.turn(to);
    },
    [place],
  );
  // Kept from render to render, so the Feed's pages re-render only when their card changes.
  const openCorrection = useCallback(
    (position: number, correctionId: string) => {
      void keep('the Feed state', feed.openLinkedCorrection(position, correctionId)).then(
        (opened) => {
          if (opened !== undefined) place.askTurn(opened);
        },
      );
    },
    [feed, place],
  );

  const answerQuickQuestion = useCallback(
    (position: number, option: number) => {
      void keep('the answer to the Quick Question', feed.answerQuickQuestion(position, option));
    },
    [feed],
  );

  const answerYesterday = useCallback(
    (position: number, option: number) => {
      void keep('the answer to Yesterday', feed.answerYesterday(position, option));
    },
    [feed],
  );

  const foldWeeklyRecap = useCallback(
    (position: number) => {
      void keep('the folded Weekly Recap', feed.foldWeeklyRecap(position));
    },
    [feed],
  );
  const restoreWeeklyRecap = useCallback(() => {
    void keep('the Weekly Recap brought back', feed.restoreWeeklyRecap());
  }, [feed]);

  // The Feed of a composition a reopen replaced is closed by then, so its
  // cleanup keeps nothing, and the new Feed opens on the reader's card.
  useEffect(() => {
    place.see(feed, inSight);
    return () => {
      place.see(feed, false);
    };
  }, [place, feed, inSight]);
  // The card in front of the reader, a new one the Feed got ready after it,
  // and a Narrator Voice the reader chose download the media of the Words
  // ahead (ADR 0099).
  useEffect(() => {
    const prefetch = () => {
      const ahead = place.wordIdsAhead();
      if (ahead !== undefined) void keep('the media ahead', prefetchAhead(shell, ahead, voice));
    };
    prefetch();
    return place.subscribe(prefetch);
  }, [place, shell, voice]);
  const turnTo = useSyncExternalStore(place.subscribe, place.askedTurn);
  // Each opening is a new turn, even to the same page; taken, it is asked no more.
  useEffect(() => {
    if (turnTo === undefined) return;
    place.turnTaken();
    pager.current?.turnTo(turnTo);
  }, [place, pager, turnTo]);
  // A hide or its undo drops or puts back cards, and the reader's card moves
  // with them, also out of sight: the pager shows it at once. When the Feed
  // has no card to put after a hidden one, the pager shows its last card.
  useEffect(() => {
    const at = place.cardsChanged();
    if (at !== undefined) pager.current?.showPage(at);
  }, [place, feed, cards, pager]);

  const asked = useSyncExternalStore(landing.subscribe, landing.asked);
  const landingPage =
    asked === undefined
      ? -1
      : cards.findIndex((card) => card.kind === 'word' && isTodaysWordOfTheDay(card, clock));
  // Lands once per ask: landed, the ask is gone.
  useEffect(() => {
    if (landingPage === -1) return;
    landing.landed();
    pager.current?.showPage(landingPage);
    place.turn(landingPage);
  }, [landingPage, asked, landing, pager, place]);

  return {
    cards,
    today,
    inSight,
    startPosition: feed.startPosition,
    onCardChange,
    openCorrection,
    answerQuickQuestion,
    answerYesterday,
    foldWeeklyRecap,
    restoreWeeklyRecap,
  };
}
