import type { Feed, FeedCard, FeedNotice, FeedNoticeCard } from '@slovo/core';

/** The page the reader turned to, in the Feed they turned it in. */
export interface TurnedTo {
  readonly in: Pick<Feed, 'startPosition'>;
  readonly position: number;
}

/**
 * The position of the card the Feed is told is on screen: the page the
 * reader turned to in this Feed, or, until they turn one and in the Feed of
 * a reopened composition, the card it opens on (ADR 0036). None while the
 * Feed is out of sight: Home is out of focus, the app is in the background or
 * the onboarding covers it.
 */
export function cardOnScreen({
  feed,
  turnedTo,
  focused,
  inForeground,
  covered,
}: {
  feed: Pick<Feed, 'startPosition'>;
  turnedTo: TurnedTo | undefined;
  focused: boolean;
  inForeground: boolean;
  covered: boolean;
}): number | undefined {
  if (!focused || !inForeground || covered) return undefined;
  return turnedTo?.in === feed ? turnedTo.position : feed.startPosition;
}

/** The Feed Notices the shell draws a card for; the others wait for theirs. */
const DRAWN_NOTICES = ['dailyLimit'] as const satisfies readonly FeedNotice[];

/** A card the shell draws: every card but a Feed Notice that has no card yet. */
export type DrawnCard =
  | Exclude<FeedCard, FeedNoticeCard>
  | (FeedNoticeCard & { readonly notice: (typeof DRAWN_NOTICES)[number] });

const drawn = (card: FeedCard): card is DrawnCard =>
  card.kind !== 'notice' || (DRAWN_NOTICES as readonly FeedNotice[]).includes(card.notice);

/**
 * The pages of the pager over the Feed's cards: a card the shell can't draw
 * yet gets no page, so the reader never meets a blank one, and the Feed
 * makes nothing of a Feed Notice it never shows (ADR 0054).
 */
export function pagesOf(cards: readonly FeedCard[]): {
  readonly pages: readonly DrawnCard[];
  /** The Feed's position of the page's card; a page past the last counts on from the last card. */
  readonly positionOf: (page: number) => number;
  /** The page of the card at the Feed's position, or of the first drawn card after it. */
  readonly pageOf: (position: number) => number;
} {
  const pages = cards.filter(drawn);
  return {
    pages,
    positionOf: (page) => {
      const card = pages[page];
      return card === undefined ? cards.length + page - pages.length : cards.indexOf(card);
    },
    pageOf: (position) => cards.slice(0, position).filter(drawn).length,
  };
}
