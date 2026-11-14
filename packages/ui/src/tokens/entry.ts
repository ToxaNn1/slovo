import type { Easing, LengthSteps } from './base';

/** The tokens of the Entry: the Word card, its reveal, panels and rows. */

/**
 * An Entry card's reveal (the design's `slFly` and `slCasc` on the Word of the
 * Day): the headline flies in as one from `from`, small and turned, after
 * `headline.delay` ms; then the card's details rise into place one after
 * another at `details.at` ms. The `full` pace, the design's shortened, settles
 * within 1 s whatever the headline; the `fast` one, about a third of it, is
 * for the cards after the first in one visit to the Feed.
 */
export const entryReveal = {
  headlineEasing: [0.2, 0.9, 0.25, 1.2],
  /** The headline starts `x` points across and `y` points down. */
  from: { x: 40, y: 240, scale: 0.15, rotate: -30 },
  full: {
    headline: { duration: 450, delay: 80 },
    details: { at: [500, 560, 620, 680], duration: 300 },
  },
  fast: {
    headline: { duration: 180, delay: 40 },
    details: { at: [220, 240, 270, 300], duration: 130 },
  },
} as const satisfies {
  readonly headlineEasing: Easing;
  readonly from: Record<string, number>;
} & Record<RevealPace, RevealTimings>;

/** How fast an Entry card plays its reveal. */
export type RevealPace = 'full' | 'fast';

/** The timings of one pace of the Entry card's reveal, in ms. */
export interface RevealTimings {
  readonly headline: { readonly duration: number; readonly delay: number };
  readonly details: { readonly at: readonly number[]; readonly duration: number };
}

/**
 * The frame of a tabbed Entry card (boards p1, XEntry2): its corner radius,
 * the width of its ink outline, how far its red offset shadow falls to the
 * right and below (the card keeps that much room on those sides, so nothing
 * clips it), its padding and the gap between its blocks, the red rule under a
 * Word's Lemma, the tab bar of equal columns at its foot (the height of a tab
 * and the line over them), the slanted mark over the selected tab (its
 * height, how far it rises over the line and how far in from each side of the
 * column it stops), the gap between the blocks of a tab's panel, the air
 * between a clamped tab's last whole line and «Детальніше» under it (owner
 * 13.11), and the red wedge of the kicker over the Lemma of the Word of the
 * Day with its gap to the text.
 */
export const entryCardFrame = {
  radius: 24,
  outline: 2.5,
  shadow: 8,
  padding: { top: 20, side: 22, bottom: 18 },
  gap: 16,
  rule: { width: 140, height: 8 },
  tabBar: { height: 50, line: 2 },
  tabMark: { height: 5, top: -2, inset: '18%' },
  panelGap: 14,
  moreGap: 8,
  /** The air between an opened tab's text and its scroll bar (owner 14.11). */
  scrollGutter: 12,
  kicker: { wedge: { width: 14, height: 12 }, gap: 8 },
} as const;

/**
 * A Synonym Row's member list (board XEntry2 e8): the room above and below a
 * member in its row, the hairline between rows (none over the first) and the
 * gap between a member and its shade note.
 */
export const synonymRowList = { rowPadding: 13, line: 1, shadeGap: 12 } as const;

/**
 * A Synonym's or an antonym's chip in the tabbed Word card's «Зв’язки» (board
 * p1): a raised tile outlined in the line colour, its edge `depth` below it.
 */
export const linkChip = {
  padding: { horizontal: 12, vertical: 9 },
  radius: 11,
  depth: 3,
} as const;

/** The gap between the big quote marks, the Example and its author's line in the tabbed Word card's «Приклад» (board p1). */
export const exampleMark = { gap: 10 } as const;

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
  /**
   * How far a tabbed card's tab bar sits lower than the room under it would
   * stand it, into the home indicator's band or the swipe stamp's room
   * (owner 14.11); a docked action row keeps it on its top.
   */
  tabBarDrop: 12,
} as const;

/**
 * The Correction card's padding over its content, off the 4-pt grid (the
 * design's 28; its sides are the Word card's and its bottom is `space[6]`).
 */
export const correctionCardLayout = { paddingTop: 28 } as const;

/**
 * The red bar that strikes a Correction's non-standard form (board XEntry2
 * e6): its thickness, how far it runs past the form on each side and its tilt.
 */
export const correctionStrike = { thickness: 5, overhang: 4, angle: '-4deg' } as const;

/**
 * The standard form in a Correction card's «Як краще» (board XEntry2 e6,
 * 38 pt where the Lemma is 50): this share of the Lemma's size at the user's
 * font size, so it keeps the card's one text scale.
 */
export const correctionStandardScale = 38 / 50;

/**
 * The mark's wedge at the edge a swiped Entry card leaves (board 04, XSwipe):
 * how far down the card it sits, its padding at the card's edge and inside,
 * the gap to its icon, the width of the light wedge's ink inset, and its icons' sides.
 */
export const swipeEdgeLayout = {
  top: 160,
  paddingVertical: 14,
  paddingEdge: 20,
  paddingInner: 26,
  gap: 10,
  inset: 4,
  check: { width: 24, height: 20 },
  bookmark: { width: 20, height: 22 },
} as const;

/**
 * The stamp on a marked Entry card: it is pressed onto the card's bottom edge
 * at the right, its lower part hanging below the card, so its upper part
 * stays within the card's bottom padding and covers no text; its padding and
 * its border.
 */
export const swipeStampLayout = {
  right: 16,
  bottom: -20,
  paddingVertical: 4,
  paddingHorizontal: 12,
  border: 3,
  /**
   * The room a card that fills its page (ADR 0091) leaves under it for the
   * stamp: its 20-point hang below the card and the drop of the far end of
   * the longest stamp, «✓ КАЖУ ПРАВИЛЬНО», tilted 6°, about 18 points.
   */
  room: 40,
} as const;

/** The side of each button of the action row under the Entry card, from the design. */
export const actionButtonSize = 52;

/** The padding of the Word of the day badge. */
export const badgePadding = { horizontal: 10, vertical: 6 } as const;

/**
 * The standard form under «Українською краще», a Tip's and a Correction's
 * (board С2.6, 30 pt where the Lemma is 50): this share of the Lemma's size at
 * the user's font size, so the form and the text under it keep the card's one
 * text scale (owner 08.11).
 */
export const standardFormScale = 30 / 50;

/**
 * An Idiom's expression by its length (owner 08.11): the Lemma's size up to 10
 * letters, 40 where the Lemma is 50 up to 18, and 30 for a longer one.
 */
export const idiomExpressionLength: LengthSteps = {
  steps: [
    { upTo: 10, scale: 1 },
    { upTo: 18, scale: 40 / 50 },
  ],
  longer: 30 / 50,
};

/** The tallest an Illustration is drawn, in points (ADR 0055). */
export const illustrationHeight = 160;

/** On the SE an Entry card's padding shrinks by 25% (the Lemma's size is in `useLemmaSize`). */
export const compactCardPadding = 0.75;

/** The missing-voice message's widest, and its distance from the screen's edges. */
export const voiceMessage = { maxWidth: 260, margin: 64 } as const;

/**
 * A swiped Entry card: its width until its first layout, a phone's card, and
 * where a marked card flies to, off screen, and where an undone one comes
 * back from (board 04).
 */
export const swipeMarkLayout = { unmeasuredWidth: 360, offScreen: 520 } as const;
