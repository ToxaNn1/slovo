import { type Easing, motion } from './base';

/** The tokens of the Entry: the Word card, its reveal, panels and rows. */

/**
 * An Entry card's reveal (the design's `slFly` and `slCasc` on the Word of the
 * Day): each letter of the headline flies in from `from`, small and turned,
 * the n-th after `letters.delay + n × letters.stagger` ms, then the card's
 * details rise into place one after another at `details.at` ms. The `full`
 * pace is the design's; the `fast` one, about a third of it, is for the cards
 * after the first in one visit to the Feed.
 */
export const entryReveal = {
  letterEasing: [0.2, 0.9, 0.25, 1.2],
  /** The n-th letter starts `x - n × xStep` points across and `y` points down. */
  from: { x: 40, xStep: 44, y: 240, scale: 0.15, rotate: -30 },
  full: {
    letters: { duration: 550, delay: 120, stagger: 60 },
    details: { at: [650, 720, 800, 900], duration: motion.cascade.duration },
  },
  fast: {
    letters: { duration: 180, delay: 40, stagger: 20 },
    details: { at: [220, 240, 270, 300], duration: 130 },
  },
} as const satisfies {
  readonly letterEasing: Easing;
  readonly from: Record<string, number>;
} & Record<RevealPace, RevealTimings>;

/** How fast an Entry card plays its reveal. */
export type RevealPace = 'full' | 'fast';

/** The timings of one pace of the Entry card's reveal, in ms. */
export interface RevealTimings {
  readonly letters: { readonly duration: number; readonly delay: number; readonly stagger: number };
  readonly details: { readonly at: readonly number[]; readonly duration: number };
}

/** The Word card's side and bottom padding (the design's 26); the feed's skeleton keeps the same shape. */
export const wordCardSide = 26;

/** The spacing inside an Entry's row in a list, off the 4-pt grid. */
export const entryRow = {
  minHeight: 60,
  compactMinHeight: 52,
  /** The design's 4 between the word and its line. */
  lineGap: 4,
  titleGap: 10,
  /** How far the text sits in from the row's hairline (design `SlovoApp`, the Saved list). */
  inset: 4,
  /** The row's opacity while it is pressed. */
  pressedOpacity: 0.6,
} as const;

/**
 * The Word card's small controls: the Category chip's vertical padding, the
 * gap inside the «more» button and the side of its chevron, and the side of
 * the icon on the «often said» line.
 */
export const wordCardControls = {
  chipPaddingVertical: 7,
  moreGap: 6,
  moreChevron: 14,
  oftenSaidIcon: 16,
} as const;

/**
 * The red card of the Word of the Day in the Feed (XActions a1–a2): its
 * corner, padding, least height and gap between blocks; where the giant
 * letter overhangs the top right corner, closed and open; the width the
 * shout wraps in, the Mascot's width, the alpha of the Category chip's cream
 * fill, and the cream panel the open card's meaning sits on.
 */
export const wordHero = {
  radius: 28,
  padding: 22,
  minHeight: 392,
  gap: 12,
  letter: { closed: { right: -30, top: -40 }, open: { right: -40, top: -50 } },
  shoutWidth: 220,
  mascot: 120,
  chipFill: 0.7,
  panel: { radius: 18, padding: 16, gap: 8 },
} as const;

/**
 * The red panel on top of Entry details (XActions a4): where the giant letter
 * overhangs the top right corner, how far down the right edge the slanted
 * bottom starts (as `wedges.panel` cuts it, so the letter stops there too),
 * the room the slant takes under the text, the gap over the kicker, and the
 * gap between the blocks of the body under the panel.
 */
export const entryPanel = {
  letter: { right: -50, top: -60 },
  cutAt: 0.86,
  paddingBottom: 56,
  kickerGap: 24,
  bodyGap: 14,
} as const;

/**
 * The Correction card's padding over its content, off the 4-pt grid (the
 * design's 28; its sides are the Word card's and its bottom is `space[6]`),
 * and the side of the mark before each sentence of its example pair.
 */
export const correctionCardLayout = { paddingTop: 28, exampleMark: 18 } as const;

/** The side of each button of the action row under the Entry card, from the design. */
export const actionButtonSize = 52;

/** The padding of the Word of the day badge. */
export const badgePadding = { horizontal: 10, vertical: 6 } as const;
