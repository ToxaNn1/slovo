/** The tokens of the Feed: its header and Feed Notices. */

/** The XP bar's side padding. */
export const xpBarPadding = 14;

/**
 * The Feed's header, from the design: the logo's wedge and its gap to the
 * name, the gap between today and the Streak pill, and how tall the fade at
 * its lower edge is, where a scrolled card passes under it.
 */
export const feedHeader = {
  logoWedge: { width: 15, height: 22 },
  logoGap: 8,
  endGap: 10,
  fade: 16,
} as const;

/**
 * The Streak pill in the Feed's header: its height and corner radius, its
 * padding (the left side carries the mark, so it is tighter), the gap after
 * the mark and the mark's box.
 */
export const streakPill = {
  height: 32,
  radius: 10,
  padding: { left: 8, right: 11 },
  gap: 5,
  mark: { width: 16, height: 18 },
} as const;

/**
 * The card of a Feed Notice, from the design: its corner radius, padding
 * and the gap between its parts; the notification mark's box, corner radius
 * and wedge; the gap between the Community Word's Word and its Definition;
 * and the Weekly Recap's grid of numbers, three to a row.
 */
export const noticeCard = {
  radius: 24,
  padding: 20,
  gap: 14,
  wordGap: 10,
  mark: { box: 40, radius: 11, wedge: { width: 12, height: 18 } },
  recap: { columns: 3, gap: 8, padding: { vertical: 12, horizontal: 10 }, lineGap: 6 },
} as const;

/**
 * The end-of-Cycle card, from the design: the ∞ behind it (its size and how
 * far it reaches past the left edge and below the top), the gap between its
 * parts and the chevrons' box.
 */
export const endOfCycleCard = {
  infinity: { size: 330, left: -40, top: 30 },
  gap: 18,
  chevrons: { width: 22, height: 30 },
} as const;

type Shape = readonly (readonly [number, number])[];

/**
 * The Dashboard of the «SLOVO 02 Feed» board (ADR 0076): the header's
 * padding and the logo's ink plate, the side padding of the blocks and the
 * hero's margin, the room above each block and under its title, and the
 * Word of the Day hero (its height, top corners, where its slanted bottom
 * starts on the right, the giant «?» and letter, its texts' places, the
 * button's place and size, the rarity bars and the Mascot).
 */
export const dashboard = {
  header: { top: 8, side: 20, bottom: 14 },
  logoPlate: { top: 9.2, right: 11, bottom: 9.2, left: 7.9 },
  side: 20,
  heroMargin: 12,
  blockTop: { mood: 22, previousWords: 26, curatedCollections: 26, correctionTypes: 18 },
  titleGap: 12,
  previousTitleGap: 6,
  /** The room under a rail's tiles. */
  railBottom: 8,
  bottom: 32,
  hero: {
    height: 470,
    radius: 30,
    cutAt: 0.9,
    question: { right: -70, top: -90 },
    letter: { right: -60, top: -70 },
    kicker: { left: 22, top: 24 },
    shout: { left: 20, top: 58 },
    subtitle: { left: 22, top: 170, width: 190 },
    lemma: { left: 18, top: 52, right: 18 },
    line: { left: 22, top: 118 },
    rarity: {
      left: 22,
      top: 150,
      gap: 4,
      labelGap: 8,
      bar: { width: 16, height: 12, skew: '-20deg' },
    },
    definition: { left: 22, top: 182, width: 220 },
    button: {
      right: 20,
      bottom: 76,
      height: 58,
      paddingHorizontal: 24,
      toCardPaddingHorizontal: 22,
      radius: 16,
    },
    mascot: { left: 14, top: 318, width: 136 },
    /** The empty rarity bar: the key ink at a fifth. */
    emptyBar: 0.2,
    questionOpacity: 0.9,
  },
} as const;

/**
 * The Mood tiles of the Dashboard: two to a row, their height, corner
 * radius and gap, and the red mark before each name, one shape per tile.
 */
export const moodTile = {
  columns: 2,
  height: 52,
  radius: 14,
  gap: 10,
  markGap: 8,
  mark: { width: 10, height: 14 },
  marks: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0.3],
      [1, 1],
      [0, 0.7],
    ],
    [
      [0.5, 0],
      [1, 1],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0.6, 1],
      [0, 1],
    ],
  ],
} as const satisfies { marks: readonly Shape[] } & Record<string, unknown>;

/** A row of «Попередні слова»: its padding, the line under it, the date column's width, the gaps and the chevron. */
export const previousWordRow = {
  padding: 14,
  border: 1,
  gap: 14,
  textGap: 4,
  dateWidth: 38,
  chevron: {
    width: 10,
    height: 16,
    points: [
      [0, 0],
      [0.4, 0],
      [1, 0.5],
      [0.4, 1],
      [0, 1],
      [0.6, 0.5],
    ],
  },
} as const satisfies { chevron: { points: Shape } & Record<string, unknown> } & Record<
  string,
  unknown
>;

/**
 * A tile of the Categories rail (Curated Collections): its box, corner
 * radius and padding, the gap between tiles, the two shapes of its
 * pictogram (a big one at the top right, a small one under it), the gap
 * over its count and its count's opacity. A shape is a polygon or a
 * `circle`; the tiles take the shapes in turn.
 */
export const categoryTile = {
  width: 124,
  height: 156,
  radius: 18,
  padding: 12,
  gap: 10,
  countGap: 6,
  countOpacity: 0.85,
  big: { side: 78, right: -6, top: -4 },
  small: { side: 30, right: 46, top: 46 },
  shapes: [
    [
      [
        [0, 0.6],
        [0.3, 0.2],
        [0.6, 0.45],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      'circle',
    ],
    [
      [
        [0.5, 1],
        [0, 0.35],
        [0.2, 0],
        [0.5, 0.2],
        [0.8, 0],
        [1, 0.35],
      ],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
    ],
    [
      [
        [0.5, 0],
        [1, 0.4],
        [1, 1],
        [0, 1],
        [0, 0.4],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ],
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ],
    [
      [
        [0.4, 0],
        [0.6, 0],
        [0.6, 0.6],
        [1, 0.6],
        [1, 0.8],
        [0, 0.8],
        [0, 0.6],
        [0.4, 0.6],
      ],
      [
        [0.5, 0],
        [1, 0.5],
        [0.5, 1],
        [0, 0.5],
      ],
    ],
    [
      [
        [0, 0.4],
        [1, 0.4],
        [0.85, 1],
        [0.15, 1],
      ],
      [
        [0.3, 0],
        [0.7, 0],
        [0.6, 1],
        [0.4, 1],
      ],
    ],
    [
      [
        [0.5, 0],
        [1, 1],
        [0, 1],
      ],
      [
        [0.5, 0],
        [1, 1],
        [0, 1],
      ],
    ],
    [
      [
        [0, 0.3],
        [0.3, 0.3],
        [0.6, 0],
        [0.6, 1],
        [0.3, 0.7],
        [0, 0.7],
      ],
      [
        [0, 0],
        [1, 0.4],
        [1, 0.6],
        [0, 1],
      ],
    ],
    [
      [
        [0, 0.7],
        [1, 0],
        [0.7, 1],
      ],
      [
        [0, 0],
        [1, 0.3],
        [1, 1],
        [0, 0.7],
      ],
    ],
    [
      [
        [0.5, 1],
        [0, 0.4],
        [0.25, 0],
        [0.5, 0.25],
        [0.75, 0],
        [1, 0.4],
      ],
      'circle',
    ],
    [
      [
        [0.3, 0],
        [0.7, 0],
        [0.7, 0.7],
        [0.4, 1],
        [0.1, 0.85],
        [0.3, 0.6],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 0.3],
        [0, 0.3],
      ],
    ],
    [
      [
        [0, 0],
        [1, 0],
        [1, 0.35],
        [0.4, 0.35],
        [0.4, 1],
        [0, 1],
      ],
      [
        [0.5, 0],
        [1, 1],
        [0, 1],
      ],
    ],
    [
      [
        [0.2, 0],
        [0.8, 0],
        [1, 1],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ],
    [
      [
        [0.5, 0],
        [0.62, 0.38],
        [1, 0.5],
        [0.62, 0.62],
        [0.5, 1],
        [0.38, 0.62],
        [0, 0.5],
        [0.38, 0.38],
      ],
      'circle',
    ],
    [
      [
        [0, 0.2],
        [1, 0],
        [1, 0.8],
        [0.4, 0.8],
        [0.2, 1],
        [0.2, 0.8],
        [0, 0.8],
      ],
      [
        [0, 0],
        [1, 0.5],
        [0, 1],
      ],
    ],
    [
      [
        [0.5, 0],
        [1, 0.25],
        [1, 0.75],
        [0.5, 1],
        [0, 0.75],
        [0, 0.25],
      ],
      [
        [0.4, 0],
        [0.6, 0],
        [0.6, 1],
        [0.4, 1],
      ],
    ],
  ],
} as const satisfies { shapes: readonly (readonly [Shape, Shape | 'circle'])[] } & Record<
  string,
  unknown
>;

/**
 * A tile of the Corrections rail (Correction Types): its box, corner radius
 * and padding, the gap between tiles, and the red glyph at its top right,
 * one shape per tile in turn.
 */
export const correctionTile = {
  width: 124,
  height: 96,
  radius: 16,
  padding: 12,
  gap: 10,
  glyph: { side: 30, right: 10, top: 10 },
  glyphs: [
    [
      [0, 0],
      [1, 0],
      [1, 0.3],
      [0.3, 0.3],
      [0.3, 0.7],
      [1, 0.7],
      [1, 1],
      [0, 1],
    ],
    [
      [0.45, 0],
      [1, 0],
      [0.4, 1],
      [0, 1],
    ],
    [
      [0, 0],
      [0.45, 0],
      [0.45, 1],
      [0, 1],
      [0, 0],
      [0.55, 0],
      [1, 0],
      [1, 1],
      [0.55, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 0.2],
      [0, 0.2],
      [0, 0.4],
      [1, 0.4],
      [1, 0.6],
      [0, 0.6],
      [0, 0.8],
      [0.6, 0.8],
      [0.6, 1],
      [0, 1],
    ],
    [
      [0, 0],
      [0.4, 0.5],
      [0, 1],
      [0.6, 1],
      [1, 0.5],
      [0.6, 0],
    ],
    [
      [0, 1],
      [0, 0.6],
      [1, 0],
      [1, 0.4],
    ],
    [
      [0, 0.55],
      [0.15, 0.4],
      [0.4, 0.65],
      [0.85, 0],
      [1, 0.15],
      [0.4, 0.95],
    ],
  ],
} as const satisfies { glyphs: readonly Shape[] } & Record<string, unknown>;
