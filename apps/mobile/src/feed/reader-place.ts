import type { Feed, FeedCard } from '@slovo/core';

import { keep } from '../keep';
import { wordIdsAhead } from './feed-ahead';

/** The Feed as the reader's place tells it and reads it. */
export type PlacedFeed = Pick<Feed, 'cards' | 'position' | 'show'>;

/**
 * The reader's place in the Feed as the shell sees it: which card is in front
 * of them, and whether the Feed is in sight. The Feed keeps the place itself
 * (`Feed.position`) and is told through `Feed.show`: the card on screen while
 * the Feed is in sight, and none while it is out of sight. A page the pager
 * turns to out of sight is told once the same Feed is back in sight; a Feed a
 * reopen gave opens on its own place. The pager, the media ahead and the
 * Mascot read it.
 */
export interface ReaderPlace {
  /** The card in front of the reader: the Feed's card on screen while the Feed is in sight, else none. */
  readonly cardInFront: () => FeedCard | undefined;
  /** The Words of the cards after the one in front of the reader whose media goes ahead (ADR 0099), while the Feed is in sight. */
  readonly wordIdsAhead: () => readonly string[] | undefined;
  /** Calls `listener` after each change of the card in front of the reader or of the turn asked. Returns the call that stops it. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Tells that `feed` is the one the reader reads, and whether it is in sight. */
  readonly see: (feed: PlacedFeed, inSight: boolean) => void;
  /** Tells that the pager turned to the page at `position`. */
  readonly turn: (position: number) => void;
  /**
   * Tells that the Feed's cards changed, and the reader's card moved with
   * them: a page turned out of sight before was of the cards before. Returns
   * the page the pager shows the reader's card at, or nothing when the Feed
   * has no card there.
   */
  readonly cardsChanged: () => number | undefined;
  /** Asks the pager to turn to the page at `position` once it is drawn, such as a Correction opened from a Word. */
  readonly askTurn: (position: number) => void;
  /** The page the pager is asked to turn to and hasn't yet, if any. */
  readonly askedTurn: () => number | undefined;
  /** Tells that the pager took the turn asked: a turn is taken once. */
  readonly turnTaken: () => void;
}

export function createReaderPlace(): ReaderPlace {
  let seen: { readonly feed: PlacedFeed; readonly inSight: boolean } | undefined;
  /** A page the pager turned to while the Feed `seen` was out of sight. */
  let turnedOutOfSight: number | undefined;
  let asked: number | undefined;
  const listeners = new Set<() => void>();
  function changed() {
    for (const listener of listeners) listener();
  }
  function tell(feed: PlacedFeed, position: number | undefined) {
    void keep('the Feed state', feed.show(position));
  }
  const inFront = () => (seen?.inSight === true ? seen.feed : undefined);
  return {
    cardInFront: () => {
      const feed = inFront();
      return feed?.cards[feed.position];
    },
    wordIdsAhead: () => {
      const feed = inFront();
      return feed === undefined ? undefined : wordIdsAhead(feed.cards, feed.position);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    see: (feed, inSight) => {
      const before = seen;
      if (feed !== before?.feed) turnedOutOfSight = undefined;
      seen = { feed, inSight };
      if (inSight) {
        tell(feed, turnedOutOfSight ?? feed.position);
        turnedOutOfSight = undefined;
      } else if (before?.feed === feed && before.inSight) {
        // The Feed keeps the reader's place on the card that left.
        tell(feed, undefined);
      } else return;
      changed();
    },
    turn: (position) => {
      if (seen === undefined) return;
      if (!seen.inSight) {
        turnedOutOfSight = position;
        return;
      }
      tell(seen.feed, position);
      changed();
    },
    cardsChanged: () => {
      turnedOutOfSight = undefined;
      changed();
      if (seen === undefined) return undefined;
      const { position, cards } = seen.feed;
      return position < cards.length ? position : undefined;
    },
    askTurn: (position) => {
      asked = position;
      changed();
    },
    askedTurn: () => asked,
    turnTaken: () => {
      if (asked === undefined) return;
      asked = undefined;
      changed();
    },
  };
}

/** The app's one reader's place, which the Feed's screen tells and the Mascot reads. */
export const readerPlace = createReaderPlace();
