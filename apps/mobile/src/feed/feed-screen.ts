import type { Feed } from '@slovo/core';

/** The page the reader turned to, in the Feed they turned it in. */
export interface TurnedTo {
  readonly in: Pick<Feed, 'position'>;
  readonly position: number;
}

/**
 * The position of the card the Feed is told is on screen when it comes in
 * sight: the page the reader turned to while it was out of sight, in this
 * Feed, or else the reader's place as the Feed keeps it, which is the card it
 * opens on until a card is on screen (ADR 0036). A turn in the Feed of a
 * composition a reopen replaced is not this Feed's.
 */
export function cardOnReturn(
  feed: Pick<Feed, 'position'>,
  turnedOutOfSight: TurnedTo | undefined,
): number {
  return turnedOutOfSight?.in === feed ? turnedOutOfSight.position : feed.position;
}
