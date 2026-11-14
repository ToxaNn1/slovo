/** The tokens of the Feed: its header and Feed Notices. */

/** The XP bar's side padding. */
export const xpBarPadding = 14;

/** The XP bar's height, the Search button's beside it. */
export const xpBarHeight = 40;

/**
 * The gestures hint's demo (board XSwipeV): how long one round takes, how far
 * the card and the finger travel to a side and how far the card tilts there,
 * how far the Feed lifts for the next card, how low the finger presses for
 * the lift and how high it rises, where the finger rests (its ring's top, a
 * share of the screen's height), the finger's size and the ring around it,
 * and the size, corner and border of a key.
 */
export const gesturesHint = {
  period: 8400,
  fingerTravel: 118,
  cardTilt: 8,
  lift: 150,
  fingerDrop: 40,
  fingerRise: 110,
  fingerTop: '43.7%',
  fingerSize: 52,
  fingerRing: 8,
  keySize: 40,
  keyRadius: 11,
  keyBorder: 2,
} as const;

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
 * «Твій тиждень» on its Feed page (board f5): the gap between the card's
 * parts and between the title and its dates and Share; the gap to the
 * Yesterday under it; «Готово»'s height. It enters as the board's `slCasc`
 * (`enter`, after `enter.delay`), its tiles pop in one after another
 * (`slPop`: from `pop.from` of their size to `pop.peak` at `pop.peakAt` of
 * `pop.duration`, the first `pop.delay` in, each next `pop.stagger` after).
 * «Готово» folds it (`wkOut`): in the first `fold.share` of `fold.duration`
 * it fades, rises by `fold.rise`, turns by `fold.turn` degrees and shrinks to
 * `fold.scale`, then its room closes; once it is folded away, the Yesterday
 * under it slides up from `below.rise` lower (`ywUp`).
 */
export const weeklyRecapPage = {
  gap: 16,
  titleGap: 10,
  pageGap: 14,
  doneHeight: 52,
  enter: { delay: 100, duration: 400 },
  pop: { delay: 200, stagger: 60, duration: 350, from: 0.6, peak: 1.12, peakAt: 0.6 },
  fold: {
    duration: 500,
    easing: [0.4, 0, 0.2, 1],
    share: 0.4,
    rise: -30,
    turn: -2,
    scale: 0.96,
  },
  below: {
    rise: 60,
    riseDuration: 450,
    easing: [0.2, 0.9, 0.3, 1],
  },
} as const;

/**
 * Yesterday's quiz «Пам’ятаєш учорашнє слово?» (board f5): the gap between
 * its options, each at least `option.height` tall with `option.radius`
 * corners, an `option.border` hairline and `option.padding` at its sides, its
 * check and cross at their sizes; the room the verdict under them
 * keeps. A right pick pops (`slPop`: from `pop.from` of its size to
 * `pop.peak` at `pop.peakAt` of `pop.duration`). A wrong pick sits
 * `wrong.sink` lower and shakes (`slShake`: to each of `wrong.shake` in turn
 * over `wrong.duration`); the right one lights `wrong.lightDelay` later; the
 * rest fade to `dimmedOpacity`. It enters as the board's `slCasc`, `enter`.
 */
export const yesterdayCard = {
  gap: 14,
  optionGap: 8,
  option: {
    height: 50,
    radius: 14,
    padding: 16,
    gap: 10,
    border: 1,
    check: { width: 16, height: 14 },
    cross: 13,
  },
  verdictHeight: 15,
  dimmedOpacity: 0.5,
  pop: { duration: 350, from: 0.6, peak: 1.12, peakAt: 0.6 },
  wrong: { sink: 3, shake: [-8, 7, -4, 3, 0], duration: 400, lightDelay: 400 },
  enter: { delay: 250, duration: 400 },
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
  blockTop: {
    mood: 22,
    previousWords: 26,
    categories: 26,
    curatedCollections: 26,
    correctionTypes: 18,
  },
  titleGap: 12,
  /** How far above a rail's title button its tap area reaches, so it is a full touch target. */
  titleSlop: 14,
  previousTitleGap: 6,
  /** The room under a rail's tiles. */
  railBottom: 8,
  bottom: 32,
  hero: {
    height: 470,
    radius: 30,
    cutAt: 0.9,
    question: { right: -70, top: -90 },
    kicker: { left: 22, top: 24 },
    shout: { left: 20, top: 58 },
    subtitle: { left: 22, top: 170, width: 190 },
    lemma: { left: 18, top: 52, right: 18 },
    /**
     * The open hero's cream card under the Lemma, its top left corner cut
     * `cut` points down: its place, padding and the gap between its lines.
     */
    card: {
      left: 14,
      right: 14,
      top: 116,
      paddingTop: 30,
      paddingHorizontal: 18,
      paddingBottom: 20,
      cut: 14,
      gap: 12,
      rowGap: 10,
      bars: { gap: 3, width: 12, height: 10, skew: '-20deg' },
    },
    button: {
      right: 20,
      /** The open hero's «Ще про слово →». */
      bottom: 76,
      /** The closed hero's «Розкрий слово», higher (ADR 0105). */
      revealBottom: 132,
      height: 58,
      paddingHorizontal: 24,
      toCardPaddingHorizontal: 22,
      radius: 16,
    },
    mascot: { left: 4, top: 334, width: 136 },
    /**
     * How the hero opens (ADR 0105): the Mascot shouts for `shouts` ms; each
     * letter of the Lemma flies in `stagger` ms after the one before, from
     * `entryReveal.from` moved `shift` points left per letter; the card and
     * then the button rise in.
     */
    reveal: {
      shouts: 1200,
      letters: { delay: 120, stagger: 60, duration: 550, shift: 44 },
      card: { delay: 600, duration: 450 },
      button: { delay: 900, duration: 400 },
    },
    /**
     * The sparks the Mascot throws from its megaphone (ADR 0109), as the
     * board's `slLeaf`: each leaves `from` points right of and below the
     * Mascot's figure and flies `travel` away, turning `turn` degrees; it
     * shows over the first `showsBy` of its flight and fades out to its end.
     * The sparks alternate the key ink and the cream; spark `i` flies for
     * `duration + i × durationStep` ms, `i × delayStep` ms after the first,
     * and again, endlessly.
     */
    sparks: {
      count: 5,
      from: { x: 136, y: 32 },
      width: 13,
      height: 9,
      travel: { x: 90, xStep: 40, y: 40, yStep: 14 },
      turn: 320,
      showsBy: 0.15,
      duration: 3000,
      durationStep: 400,
      delayStep: 700,
    },
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
    [
      [0, 0.3],
      [1, 0],
      [1, 0.7],
      [0, 1],
    ],
  ],
} as const satisfies { marks: readonly Shape[] } & Record<string, unknown>;

/**
 * A row of «Минулі Слова дня»: its padding, the line under it, the date
 * column's width, the gaps, the chevron, and how the rows rise in one after
 * another (ADR 0105).
 */
export const previousWordRow = {
  cascade: { delay: 150, stagger: 60, duration: 450 },
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
 * over its count and its count's opacity, and the opacity of a quiet
 * tile's big shape on the rail (ADR 0081). A shape is a polygon or a
 * `circle`; the tiles take the shapes in turn.
 */
export const categoryTile = {
  quietShapeAlpha: 0.16,
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
 * The grid of Categories (board 05.2 «XCats», k1): the screen's padding,
 * the gap between tiles, and a tile's height, corner radius and padding,
 * the two shapes of its pictogram (a big one at the top right, a small one
 * under it), its entrance (each tile rises in 0.3 s after the one before
 * by `stagger`), and the board's 16 shape pairs, which the tiles take by
 * position and wrap past (spec #1604). A shape is a polygon or a `circle`.
 */
export const categoryGrid = {
  padding: { top: 60, side: 14, bottom: 30 },
  titleGap: 18,
  gap: 8,
  height: 112,
  radius: 16,
  tilePadding: 10,
  big: { side: 58, right: -4, top: -2 },
  small: { side: 22, right: 38, top: 34 },
  cascade: { duration: 300, stagger: 25 },
  shapes: [
    [
      [
        [0.4, 0],
        [0.6, 0],
        [0.62, 0.3],
        [0.9, 0.4],
        [0.8, 1],
        [0.2, 1],
        [0.1, 0.4],
        [0.38, 0.3],
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
        [0.4, 0],
        [0.6, 0],
        [0.6, 0.2],
        [1, 0.2],
        [1, 0.8],
        [0.6, 0.8],
        [0.6, 1],
        [0.4, 1],
        [0.4, 0.8],
        [0, 0.8],
        [0, 0.2],
        [0.4, 0.2],
      ],
      'circle',
    ],
    [
      [
        [0.5, 0],
        [0.6, 0.3],
        [1, 0.4],
        [0.65, 0.6],
        [0.75, 1],
        [0.5, 0.75],
        [0.25, 1],
        [0.35, 0.6],
        [0, 0.4],
        [0.4, 0.3],
      ],
      [
        [0, 0],
        [1, 0.5],
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
      'circle',
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
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
        [0.2, 0],
        [0.8, 0],
        [0.8, 1],
        [0.2, 1],
      ],
      [
        [0, 0.45],
        [1, 0.45],
        [1, 0.55],
        [0, 0.55],
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
} as const satisfies {
  shapes: readonly (readonly [Shape | 'circle', Shape | 'circle'])[];
} & Record<string, unknown>;

/**
 * The grid of Categories of Corrections (board 05.2 «XCats», k2): the k1
 * grid's padding, gap, radius and tile padding, with taller tiles, a bigger
 * big shape, the small one at 60/60, a slower cascade (40 ms apart) and the
 * board's 7 shape pairs, which the tiles take by position and wrap past
 * (spec #1604).
 */
export const correctionGrid = {
  height: 150,
  big: { side: 84, right: -4, top: -2 },
  small: { side: 22, right: 60, top: 60 },
  stagger: 40,
  shapes: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 0.7],
        [0.4, 0.7],
        [0.2, 1],
        [0.2, 0.7],
        [0, 0.7],
      ],
      'circle',
    ],
    [
      [
        [0.5, 0],
        [1, 0.45],
        [0.85, 0.45],
        [0.85, 1],
        [0.15, 1],
        [0.15, 0.45],
        [0, 0.45],
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
        [0, 0.25],
        [1, 0.25],
        [1, 1],
        [0, 1],
      ],
      [
        [0.3, 0],
        [0.7, 0],
        [0.7, 0.3],
        [0.3, 0.3],
      ],
    ],
    [
      [
        [0.1, 0.3],
        [0.9, 0.3],
        [0.8, 1],
        [0.2, 1],
      ],
      [
        [0, 0],
        [1, 0.5],
        [0, 1],
      ],
    ],
    [
      [
        [0, 0.2],
        [1, 0.2],
        [1, 0.75],
        [0, 0.75],
      ],
      'circle',
    ],
    [
      [
        [0, 0.15],
        [0.5, 0],
        [1, 0.15],
        [1, 1],
        [0.5, 0.85],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0.3],
        [1, 0.7],
        [0, 1],
      ],
    ],
    [
      [
        [0, 0],
        [1, 0.5],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ],
  ],
} as const satisfies {
  shapes: readonly (readonly [Shape | 'circle', Shape | 'circle'])[];
} & Record<string, unknown>;

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

/**
 * The screen a rail's tile opens, a Correction Type's or a Curated
 * Collection's (board `SlovoApp`, «fix» and «cat»): the red halftone hero,
 * its height under the board's status bar and its bottom cut, the back tile,
 * the add button, the icon tile with its glyph, the column of kicker, title
 * and description, the progress label and skewed bar, the Mascot, and the
 * cards under it with their chip, struck form, button and revealed block.
 */
export const railScreen = {
  /** The board's status bar: the hero's places are measured from the screen's top. */
  statusBar: 54,
  height: 392,
  /** The hero's bottom: the left corner at the bottom, the right one at 88%. */
  cut: [
    [0, 0],
    [1, 0],
    [1, 0.88],
    [0, 1],
  ],
  back: { left: 12, top: 54, side: 44, radius: 14, icon: 18 },
  add: {
    right: 12,
    top: 54,
    height: 44,
    paddingHorizontal: 16,
    radius: 14,
    gap: 8,
    icon: 14,
    edge: 3,
    edgeAlpha: 0.35,
    /** The tick's pop once the button turns on, the board's `slPop .35s`, in ms. */
    popDuration: 350,
  },
  /** The add button's plus and the tick it turns into, in a 26 × 22 box. */
  addIcons: {
    plus: [
      [11 / 26, 0],
      [15 / 26, 0],
      [15 / 26, 9 / 22],
      [1, 9 / 22],
      [1, 13 / 22],
      [15 / 26, 13 / 22],
      [15 / 26, 1],
      [11 / 26, 1],
      [11 / 26, 13 / 22],
      [0, 13 / 22],
      [0, 9 / 22],
      [11 / 26, 9 / 22],
    ],
    tick: [
      [0, 12 / 22],
      [4 / 26, 8 / 22],
      [10 / 26, 14 / 22],
      [22 / 26, 0],
      [1, 4 / 22],
      [10 / 26, 1],
    ],
  },
  column: { left: 22, top: 116, right: 22, gap: 12, kickerGap: 10, descriptionWidth: 220 },
  icon: { side: 34, radius: 10, glyph: 18 },
  progress: { left: 22, top: 292, width: 170, gap: 8, bar: 8, skew: '-20deg', empty: 0.2 },
  /**
   * The room under the progress bar to the hero's bottom: 392 − (292 + 11 + 8 + 8).
   * A title or description longer than the board's pushes the bar and the
   * hero's bottom down by as much, so they flow instead of overlapping.
   */
  bottom: 73,
  mascot: { right: 20, top: 238, width: 124 },
  list: { top: 4, side: 16, gap: 12, wordGap: 10, bottom: 40 },
  /** A card's box; `line` is the 1-point border round its face. */
  card: { radius: 18, padding: 16, gap: 12, wordGap: 8, edge: 4, labelGap: 6, line: 1 },
  /** The cards rise in one after another (the board's `slCasc`): each lasts `duration`, `stagger` after the one before. */
  cascade: { duration: 450, stagger: 70 },
  /** The cards after the first `cascadeCap` rise in together, so a long list does not keep the last ones waiting. */
  cascadeCap: 8,
  /** A Correction Type's cards start rising `cascadeDelay` ms after the screen opens (the board's `slCasc .45s ${.2+i*.07}s`). */
  cascadeDelay: 200,
  chip: { paddingHorizontal: 9, paddingVertical: 5, radius: 8 },
  /**
   * The struck form's red line: `at` is where its middle falls, as a share of
   * the line's height. The board's CSS line-through sits two thirds of the
   * font's ascent below the text's top: on Onest 600 18/23.4 that is
   * (23.4 − 22.95) / 2 + ⅔ · 17.46 ≈ 11.9 points, a share of 0.508.
   */
  strike: { thickness: 3, at: 0.508 },
  button: { height: 52, radius: 14, paddingHorizontal: 18 },
  /** The revealed block: red, its top falling 8 points to the left, a little wider than the card. */
  revealed: {
    padding: 14,
    paddingTop: 20,
    gap: 8,
    overhang: 4,
    slant: 8,
    /**
     * The block pops in as it shows (the board's `slPop .35s`): from `from`
     * of its size to `peak` at `peakAt` of `duration` ms, then to its size,
     * each leg on the board's `ease`.
     */
    pop: { duration: 350, from: 0.6, peak: 1.12, peakAt: 0.6 },
    /** The slanted top strip: its left end `slant` lower than its right. */
    topCut: [
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  },
  known: { paddingHorizontal: 8, paddingVertical: 5, turn: '-3deg' },
  bars: { width: 9, height: 8, gap: 2, skew: '-20deg' },
} as const;

/**
 * The quiet variant (k3) of a Category's screen, for a quiet Category (spec
 * #1604): the hero on the sunken surface with no halftone, cut at the
 * bottom as the loud one, its padding, back tile, name and description
 * widths and the mourning Mascot's place; the plain rows under it, each
 * fading in `fade.duration`, `fade.stagger` after the one before.
 */
export const quietScreen = {
  height: 360,
  cut: railScreen.cut,
  padding: { top: 110, side: 22 },
  back: { left: 16, top: 58, side: 40, radius: 12, icon: 16 },
  gap: 10,
  titleWidth: 260,
  descriptionWidth: 250,
  mascot: { right: 14, bottom: 56, width: 130 },
  row: { paddingVertical: 14, gap: 4 },
  fade: { duration: 600, stagger: 120 },
} as const;

/** The box of a tile on the Dashboard's Categories rail. */
export const categoryRailBox = {
  width: categoryTile.width,
  height: categoryTile.height,
  radius: categoryTile.radius,
  padding: categoryTile.padding,
  big: categoryTile.big,
  small: categoryTile.small,
  name: 'categoryName',
} as const;

/**
 * The box of a k1 grid tile (board 05.2), for the Categories and the
 * Collections in their style; its width is the column's.
 */
export const categoryGridBox = {
  height: categoryGrid.height,
  radius: categoryGrid.radius,
  padding: categoryGrid.tilePadding,
  big: categoryGrid.big,
  small: categoryGrid.small,
  name: 'gridTileName',
} as const;

/**
 * The box of a k2 grid tile (board 05.2): the k1 tile's corners and padding,
 * taller, with its own shapes' places; its width is the column's.
 */
export const correctionGridBox = {
  height: correctionGrid.height,
  radius: categoryGrid.radius,
  padding: categoryGrid.tilePadding,
  big: correctionGrid.big,
  small: correctionGrid.small,
  name: 'gridTileName',
} as const;
