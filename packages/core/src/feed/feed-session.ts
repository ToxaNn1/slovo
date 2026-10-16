import { entryIdOf, type FeedCard } from './feed-card';

/**
 * Every card of the Feed's app session and the reader's place among them,
 * for `openFeed`, which keeps the async work. The session holds its cards
 * oldest first, also the ones dropped because their Entry stopped being
 * eligible: a dropped card keeps its place and goes back to it when its
 * Entry is eligible again (ADR 0015). Places count in every card of the
 * session; positions count in `cards`. A change never edits an array: it
 * makes a new one, and leaves telling the subscribers to the Feed.
 */
export interface FeedSession {
  /** The cards shown: the session's cards not dropped. */
  readonly cards: readonly FeedCard[];
  /** Every card of the session, also the dropped ones. */
  readonly all: readonly FeedCard[];
  /** The place of the reader's card: the one on screen, or the one the reader left while none is. */
  readonly place: number;
  /** The reader's card, or nothing while the place is past the last card. */
  readonly readerCard: FeedCard | undefined;
  /** The reader's position: the position of the card at the reader's place, see `Feed.position`. */
  readonly position: number;
  /** The place of the card at `position`, or of the card that will come there. */
  placeOf(position: number): number;
  /**
   * Moves the reader to the card at `place`. Once the reader is on another
   * card, the card dropped from their place no longer takes it back.
   */
  moveTo(place: number): void;
  /** Whether the card belongs to the current Cycle: the cards before its first card belong to an earlier one. */
  inCurrentCycle(card: FeedCard): boolean;
  /** The cards shown in the current Cycle. */
  cycleCards(): readonly FeedCard[];
  /**
   * The ids of the Entries shown in the current Cycle, also the dropped
   * ones, which are shown again when their Entry is eligible again; without
   * the `except` card, if given.
   */
  shownIds(except?: FeedCard): Set<string>;
  /** Starts a new Cycle with the next card added. */
  startCycle(): void;
  /**
   * Adds the card at the end, in place of the `replaced` card if given: the
   * places after the replaced card move one back, the reader's too.
   */
  add(card: FeedCard, replaced?: FeedCard): void;
  /** Puts the `inserted` card right after `card`: the places after it move one on, the reader's too. */
  insertAfter(card: FeedCard, inserted: FeedCard): void;
  /** Puts the card `renewed` gives in place of each card of the session, each keeping its place. */
  renew(renewed: (card: FeedCard) => FeedCard): void;
  /**
   * Drops the `out` cards and puts back the dropped ones not among them. The
   * reader's place goes to the card dropped from it when it is back, else
   * stays on the reader's card, else goes to the next card that stays, else
   * one past the last card. Returns the card that was at the reader's place
   * and whether the place moved, or nothing when the change changes nothing.
   */
  drop(out: ReadonlySet<FeedCard>): { left: FeedCard | undefined; moved: boolean } | undefined;
}

export function createFeedSession(): FeedSession {
  let session: readonly FeedCard[] = [];
  /** The cards of the session dropped because their Entry is not eligible now. */
  let dropped: ReadonlySet<FeedCard> = new Set();
  let cards: readonly FeedCard[] = [];
  /** The place of the current Cycle's first card. */
  let cycleStart = 0;
  let place = 0;
  /**
   * The card dropped from the reader's place while the reader hasn't moved to
   * another card since: it takes the place back when its Entry is eligible
   * again, as on an undo.
   */
  let droppedFromPlace: FeedCard | undefined;

  function set(changed: readonly FeedCard[], changedDropped = dropped): void {
    session = changed;
    dropped = changedDropped;
    cards = session.filter((card) => !dropped.has(card));
  }

  /** The session without the card, if given: the places after it move one back, the reader's too. */
  function without(card: FeedCard | undefined): readonly FeedCard[] {
    const removed = card === undefined ? -1 : session.indexOf(card);
    if (removed === -1) return session;
    if (cycleStart > removed) cycleStart -= 1;
    if (place > removed) place -= 1;
    return session.filter((kept) => kept !== card);
  }

  /** The reader's place once the `out` cards are dropped, see `drop`. */
  function readerPlace(out: ReadonlySet<FeedCard>): number {
    if (droppedFromPlace !== undefined && !out.has(droppedFromPlace)) {
      const back = session.indexOf(droppedFromPlace);
      if (back !== -1) return back;
    }
    const card = session[place];
    if (card === undefined || !out.has(card)) return place;
    const next = session.findIndex((later, index) => index > place && !out.has(later));
    return next === -1 ? session.length : next;
  }

  return {
    get cards() {
      return cards;
    },
    get all() {
      return session;
    },
    get place() {
      return place;
    },
    get readerCard() {
      return session[place];
    },
    get position() {
      return session.slice(0, place).filter((card) => !dropped.has(card)).length;
    },
    placeOf(position) {
      const card = cards[position];
      return card === undefined ? session.length + position - cards.length : session.indexOf(card);
    },
    moveTo(to) {
      if (to === place) return;
      place = to;
      droppedFromPlace = undefined;
    },
    inCurrentCycle: (card) => session.indexOf(card) >= cycleStart,
    cycleCards: () => session.slice(cycleStart).filter((card) => !dropped.has(card)),
    shownIds(except) {
      const shown = session.filter((card) => card !== except);
      return new Set(shown.slice(cycleStart).flatMap((card) => entryIdOf(card) ?? []));
    },
    startCycle() {
      cycleStart = session.length;
    },
    add(card, replaced) {
      set([...without(replaced), card]);
    },
    insertAfter(card, inserted) {
      const at = session.indexOf(card);
      if (cycleStart > at) cycleStart += 1;
      if (place > at) place += 1;
      set([...session.slice(0, at + 1), inserted, ...session.slice(at + 1)]);
    },
    renew(renewed) {
      if (droppedFromPlace !== undefined) droppedFromPlace = renewed(droppedFromPlace);
      set(session.map(renewed), new Set([...dropped].map(renewed)));
    },
    drop(out) {
      const left = session[place];
      const to = readerPlace(out);
      if (left !== undefined && out.has(left)) droppedFromPlace = left;
      else if (session[to] === droppedFromPlace) droppedFromPlace = undefined;
      const moved = to !== place;
      const sameDropped = out.size === dropped.size && [...out].every((card) => dropped.has(card));
      if (!moved && sameDropped) return undefined;
      place = to;
      set(session, out);
      return { left, moved };
    },
  };
}
