import type { Feed } from '@slovo/core';

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
