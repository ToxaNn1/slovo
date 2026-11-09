/** The tokens of the Share Card. */

/** The format of a Share Card's image: Story (9:16) or Square (1:1). */
export type ShareCardFormat = 'story' | 'square';

/** The share of the screen's height the Share Card's preview may take, so the sheet fits the SE. */
export const sharePreviewHeightShare = 0.58;

/**
 * A Share Card's image in pixels, by format: the Story a true 9:16
 * (the design's 9:16), the Square 1:1.
 */
export const shareImage = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const satisfies Record<ShareCardFormat, { width: number; height: number }>;

/**
 * Each format's layout, from the design's share board, in its points: the
 * Story 270 by 480, the Square 300 by 300. The kicker tops the card under the
 * brand line, the headline follows it, the giant glyph sits behind them off
 * the right edge, and the slanted footer band holds the Mascot and the
 * watermark.
 */
export const shareCardLayout = {
  story: {
    padding: { horizontal: 20, vertical: 22 },
    kickerTop: 60,
    gap: 8,
    blockGap: 14,
    giant: { size: 320, right: -50, top: 120 },
    mascot: 96,
    footer: 120,
    cell: 22,
    /** Each stat chip's base width: two to a row. */
    statBasis: '40%',
    type: {
      kicker: 10,
      /** The headline of an Entry. */
      entryHeadline: 40,
      /** The headline of a Weekly Recap, a milestone or a Daily Crossword. */
      headline: 32,
      sub: 12,
      nonStandard: 22,
      stat: 18,
      label: 10,
      watermark: 10,
    },
  },
  square: {
    padding: { horizontal: 18, vertical: 18 },
    kickerTop: 14,
    gap: 8,
    blockGap: 10,
    giant: { size: 220, right: -30, top: 40 },
    mascot: 70,
    footer: 84,
    cell: 18,
    /** Four to a row. */
    statBasis: '20%',
    type: {
      kicker: 10,
      entryHeadline: 30,
      headline: 24,
      sub: 12,
      nonStandard: 16,
      stat: 18,
      label: 10,
      watermark: 10,
    },
  },
} as const;

/** The Share Card's fixed measures, from the design's share board. */
export const shareCardDrawing = {
  /** The brand wedge before the kicker. */
  brand: { width: 9, height: 13 },
  /** The kicker's letter spacing, the headline's and the giant glyph's. */
  tracking: { kicker: 1.5, headline: -1, giant: -8 },
  /** The raster's dots in the dark Theme, the ink at this opacity. */
  darkDotAlpha: 0.08,
  /** Secondary text over the card: the reading text and the watermark. */
  subOpacity: 0.9,
  watermarkOpacity: 0.8,
  /** A stat's chip and a closed crossword cell, over red and over the dark ground. */
  chipAlpha: { light: 0.55, dark: 0.1 },
  closedCellAlpha: { light: 0.6, dark: 0.12 },
  cellRadius: 4,
  cellGap: 3,
  chipRadius: 9,
  chipPadding: 8,
  /** The Mascot's whole width with its own padding, which the card scales to its size. */
  mascotBox: 162,
} as const;
