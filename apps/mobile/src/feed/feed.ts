import { isTodaysWordOfTheDay, type Clock, type FeedCard, type LocalDate } from '@slovo/core';
import type { VerticalPagerHandle } from '@slovo/ui';
import { useIsFocused } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';

import { useComposition } from '../composition';
import { useInForeground } from '../foreground/in-foreground';
import { keep } from '../keep';
import { prefetchAhead } from '../media/shell-media';
import { useSubscribed } from '../opening';
import { useShell } from '../shell-value';
import { wordIdsAhead } from './feed-ahead';
import { cardOnReturn, type TurnedTo } from './feed-screen';
import type { LandingAsked, WordOfTheDayLanding } from './word-of-the-day-landing';

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
 * It tells the Feed which card is on screen while the Feed is in sight, and
 * that none is otherwise, and keeps the pager on the reader's card. An ask
 * of `landing` puts today's Word of the Day card on screen, by `clock`, once
 * the Feed has it.
 */
export function useFeed(
  pager: RefObject<VerticalPagerHandle | null>,
  {
    clock,
    landing,
    voice,
  }: {
    clock: Clock;
    landing: WordOfTheDayLanding;
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
  /** Whether the Feed is in sight as of the last render, for the turns between renders. */
  const inSightNow = useRef(inSight);
  useEffect(() => {
    inSightNow.current = inSight;
  }, [inSight]);
  /** A page the reader turned to while the Feed was out of sight, which it is told once back. */
  const turnedOutOfSight = useRef<TurnedTo>(undefined);
  // The Feed keeps the reader's place itself: a turn goes straight to it, so
  // a swipe re-renders the screen only when the Feed's cards change.
  /** Tells the Feed the card at `to` is on screen, or keeps it for its return while out of sight. */
  const turn = useCallback(
    (to: number): boolean => {
      if (!inSightNow.current) {
        turnedOutOfSight.current = { in: feed, position: to };
        return false;
      }
      void keep('the Feed state', feed.show(to));
      return true;
    },
    [feed],
  );
  const onCardChange = useCallback(
    (to: number) => {
      if (!turn(to)) return;
      void keep('the media ahead', prefetchAhead(shell, wordIdsAhead(feed.cards, to), voice));
    },
    [turn, feed, shell, voice],
  );
  /** The page to turn to once it is drawn, such as a Correction opened from a Word. */
  const [turnTo, setTurnTo] = useState<{ readonly page: number }>();
  // Kept from render to render, so the Feed's pages re-render only when their card changes.
  const openCorrection = useCallback(
    (position: number, correctionId: string) => {
      void keep('the Feed state', feed.openLinkedCorrection(position, correctionId)).then(
        (opened) => {
          if (opened !== undefined) setTurnTo({ page: opened });
        },
      );
    },
    [feed],
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

  // The Feed coming in sight is told the reader's card, and going out of
  // sight that none is; the Feed takes the card that left off the screen
  // itself. The Feed of a composition a reopen replaced is closed by then, so
  // its cleanup keeps nothing, and the new Feed opens on the reader's card.
  useEffect(() => {
    if (!inSight) return;
    const position = cardOnReturn(feed, turnedOutOfSight.current);
    turnedOutOfSight.current = undefined;
    void keep('the Feed state', feed.show(position));
    return () => {
      void keep('the Feed state', feed.show(undefined));
    };
  }, [feed, inSight]);
  // New cards, such as the next one the Feed got ready, download the media of
  // the Words ahead (ADR 0099), and a Narrator Voice the reader chose
  // downloads them again in that voice.
  useEffect(() => {
    if (!inSight) return;
    void keep('the media ahead', prefetchAhead(shell, wordIdsAhead(cards, feed.position), voice));
  }, [shell, feed, cards, inSight, voice]);

  // Each opening is a new turn, even to the same page.
  useEffect(() => {
    if (turnTo === undefined) return;
    pager.current?.turnTo(turnTo.page);
  }, [pager, turnTo]);
  // A hide or its undo drops or puts back cards, and the reader's card moves
  // with them, also out of sight: the pager shows it at once. When the Feed
  // has no card to put after a hidden one, the Feed is told no position past
  // its cards, and the pager shows its last card.
  // A turn out of sight before the change was taken on the cards before it.
  useEffect(() => {
    turnedOutOfSight.current = undefined;
    if (feed.position < cards.length) pager.current?.showPage(feed.position);
  }, [feed, cards, pager]);

  const asked = useSyncExternalStore(landing.subscribe, landing.asked);
  const landingPage =
    asked === undefined
      ? -1
      : cards.findIndex((card) => card.kind === 'word' && isTodaysWordOfTheDay(card, clock));
  /** The last ask the Feed landed, and the page it landed on. */
  const [landed, setLanded] = useState<{ ask: LandingAsked; page: number }>();
  // The reader is on the landing page from this render on, as if they turned to it.
  if (asked !== undefined && landingPage !== -1 && asked !== landed?.ask) {
    setLanded({ ask: asked, page: landingPage });
  }
  /**
   * The turn of the Feed as of the last render: a reopen gives a new Feed, and
   * with it a new `turn`, which must not land the last ask again.
   */
  const turnNow = useRef(turn);
  useEffect(() => {
    turnNow.current = turn;
  }, [turn]);
  // Lands once per ask.
  useEffect(() => {
    if (landed === undefined) return;
    landing.landed();
    pager.current?.showPage(landed.page);
    turnNow.current(landed.page);
  }, [landed, landing, pager]);

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
