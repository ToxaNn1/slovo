import type { Wedge } from './base';

/** The tokens of the Profile and Saved: Level, Badges, the calendar and Collections. */

/** The marks of the Collection cards of the Collections screen, in turn by the card's place. */
export const collectionMarks = [
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
  [
    [0.3, 0],
    [1, 0],
    [0.7, 1],
    [0, 1],
  ],
] as const satisfies readonly Wedge[];

/** The Profile's Level card, from the design: an ink card with a red wedge and the XP ring. */
/** The Profile's header (board 11, t8): the avatar, the reader's name and the Level. */
export const profileHeader = {
  padding: 16,
  radius: 20,
  gap: 14,
  /** The square avatar with the name's first letter, or the neutral mark. */
  avatar: { side: 58, radius: 16, mark: 28 },
  /** Between the name and the Level under it. */
  lines: 5,
};

export const levelCard = {
  padding: 20,
  radius: 24,
  gap: 18,
  /** The ring's box, its radius and its stroke. */
  ring: { box: 124, radius: 54, stroke: 12, track: 'rgba(127, 127, 127, 0.3)' },
  /** The red wedge in the bottom right corner, past the card's edges. */
  wedge: { side: 170, right: -30, bottom: -40, opacity: 0.95 },
  /** The wedge's slant: from 40% along the top to the bottom left corner. */
  wedgeShape: [
    [0.4, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  linesGap: 6,
} as const;

/**
 * The Badge stamp, from board XBadges «Штамп» (decision 13): under the giant
 * cream kicker the earned Badge's mark in its family's shape lands on red.
 * It flies in from `from`, presses to `press` at the blow, under a dotted
 * ink ring and a light shake, springs to `bounce` and rests at `turn`: the
 * hit, about 0.7 s. Then the ribbon flies in from the left and the button
 * comes in, and the stamp rests, about 1.1 s.
 */
export const badgeStamp = {
  markSide: 120,
  /** The mark flies in from this scale and turn. */
  from: { scale: 2.6, turn: -26 },
  /** The scale of the mark at the blow. */
  press: 0.9,
  /** The turn of the kicker and of the mark at rest. */
  turn: -8,
  bounce: 1.06,
  /** The dotted ink ring round the mark: it grows from `from` to 1 at the blow, then to `to` as it fades. */
  ring: { side: 180, width: 6, from: 0.6, to: 1.35 },
  /** The light shake at the blow, in points, one step per `frames.shake` share. */
  shake: { x: [0, -3, 3, -1, 0], y: [0, 2, -2, 1, 0] },
  /**
   * Where each frame ends, as a share of the motion: the mark lands pressed
   * at `fly`, springs at `bounce` and rests at `rest`, which ends the hit;
   * the ribbon and the button are in by `ribbon`; the rest of the motion is
   * the stamp at rest.
   */
  frames: {
    fly: 0.21,
    bounce: 0.3,
    rest: 0.39,
    ribbon: 0.51,
    ring: { in: 0.18, blow: 0.27, out: 0.63 },
    shake: [0.19, 0.22, 0.25, 0.28, 0.33],
  },
  /** The depth of the hard ink edge under the stamped mark. */
  drop: 6,
  padding: { top: 90, horizontal: 28, bottom: 40 },
  /** The ring round the mark overlaps the giant word's foot. */
  markTop: -18,
  nameTop: 16,
  lineTop: 6,
  /** The ink ribbon at the bottom left, over the button: it flies in from `from` points to the left. */
  ribbon: { top: 18, turn: -6, from: -30, padding: { vertical: 7, horizontal: 10 } },
} as const;

/** The toast of a Badge earned during a Game: the mark, its name and the stamp's line, on the Theme's ink. */
export const badgeToast = {
  markSide: 40,
  gap: 12,
  padding: 12,
  radius: 16,
  /** The toast is this wide at most, with `horizontal` free on each side. */
  width: 340,
  /** Over the bottom of the screen, clear of the Game's buttons. */
  bottom: 96,
  horizontal: 16,
  /** The space between the name and the line. */
  linesGap: 4,
  /** The line is a little quieter than the name. */
  lineOpacity: 0.85,
  /** A hard shadow under the toast. */
  shadow: '0 6px 0 rgba(0, 0, 0, 0.3)',
} as const;

/** The Badge's mark on its Share Card, as on the poster. */
export const badgeShareMark = { side: 28 } as const;

/**
 * The Badge grid: marks in rows of their Badge family under its name, five
 * to a row of the Profile (`side`), a card for each Badge on the Badges
 * screen (`card`, ADR 0145).
 */
export const badgeGrid = {
  side: 48,
  columns: 5,
  gap: 10,
  familyGap: 14,
  headGap: 10,
  pressedScale: 0.88,
  /**
   * A Badge's card on the Badges screen (`XBadges` all): the mark at `mark`
   * over the name, condition and status, two to a row up to `width` wide,
   * each at least `basis` of the row.
   */
  card: {
    width: 176,
    basis: '45%',
    mark: 96,
    paddingTop: 20,
    paddingX: 14,
    paddingBottom: 18,
    radius: 20,
    gap: 8,
    border: 1,
    edge: 4,
  },
  /** The Badges screen's spacing: between families, a family's head and its cards, and the cards. */
  screen: { familyGap: 30, headGap: 14, cardGap: 14 },
} as const;

/**
 * The Badge families overview heading the Badges screen (`XBadges` fams): a
 * card of `width` for each family in a row that scrolls sideways, its mark
 * at `mark` beside the name and count, the description, and the shape under
 * a rule.
 */
export const badgeFamilies = {
  width: 260,
  mark: 96,
  padding: 22,
  radius: 22,
  gap: 18,
  headGap: 18,
  nameGap: 6,
  shapeGap: 10,
  shapeTop: 14,
  rule: 1,
  edge: 5,
  cardGap: 14,
} as const;

/**
 * A Badge's mark (`XBadges`): the family's shape in its tone's ring, the face
 * set inside it by `ring` of the side, over a drop shadow `drop.large` deep
 * above `drop.over` and `drop.small` at it and below. A locked face is the
 * ring's grey at `lockedFace`; a Badge in progress fills its face in red at
 * `progress`.
 */
export const badgeMark = {
  ring: 0.07,
  lockedFace: 0.5,
  progress: 0.38,
  drop: { over: 40, large: 4, small: 2 },
} as const;

/** The square tile shape of a Badge family, its corners cut. */
export const badgeTile = [
  [0.14, 0],
  [0.86, 0],
  [1, 0.14],
  [1, 0.86],
  [0.86, 1],
  [0.14, 1],
  [0, 0.86],
  [0, 0.14],
] as const satisfies Wedge;

/** The checker tile shape of a Badge family, two corners cut by 10% of the side: top left and bottom right (ADR 0087, 0145). */
export const badgeChecker = [
  [0.1, 0],
  [1, 0],
  [1, 0.9],
  [0.9, 1],
  [0, 1],
  [0, 0.1],
] as const satisfies Wedge;

/** The wedge shape of the Рівні Badge family (ADR 0145): its left edge short, its right edge full height. */
export const badgeWedge = [
  [0, 0.18],
  [1, 0],
  [1, 1],
  [0, 0.82],
] as const satisfies Wedge;

/**
 * The face of a `checker` Badge in place of its symbol (ADR 0087): a square of
 * `cells` by `cells`, `side` of the mark's side, centred on the cream inset.
 */
export const badgeCheckerFace = { cells: 3, side: 0.48 } as const;

/** The «НОВА» tag over an earned Badge's top right corner, turned as on `XBadges`. */
export const badgeNewTag = {
  turn: 8,
  top: -6,
  right: -18,
  paddingHorizontal: 9,
  paddingVertical: 6,
} as const;

/** Spacing the design draws between the steps of the 4-pt grid on the field that names a Collection. */
export const cardSpace = {
  /** Around the content of the field that names a Collection. */
  collectionPadding: 18,
} as const;

/** The Collection menu's group of rows (board 09): its corner and the padding of a row. */
export const collectionMenu = {
  radius: 16,
  rowPaddingVertical: 17,
  rowPaddingHorizontal: 16,
} as const;

/** The box of the Collection Link on its share sheet (board 09): height, corner, side padding. */
export const collectionLinkBox = {
  height: 56,
  radius: 14,
  paddingHorizontal: 16,
} as const;

/**
 * The name sheet of a Collection (board 09): the field's height, corner,
 * border and side padding, the gap between the input and the counter, the
 * inset of the refusal and the shake of a refused name.
 */
export const collectionNameField = {
  height: 60,
  radius: 16,
  border: 2,
  paddingHorizontal: 16,
  gap: 10,
  /** The refusal under the field sits in this far. */
  refusalInset: 4,
  shake: [-8, 7, -4, 3, 0],
  shakeDuration: 400,
} as const;

/**
 * A Collection's screen (board 09): the chevron that ends a row, the gap
 * between the header's tiles and the title, between the title and its count,
 * the space around the «Поділитися посиланням» button at the foot and its
 * red wedge.
 */
export const collectionScreen = {
  chevron: { width: 10, height: 16 },
  titleTop: 18,
  countGap: 6,
  footerPadding: 20,
  /** The red wedge before the button's label. */
  mark: { width: 12, height: 14 },
} as const;

/** A Collection's card on the Collections screen (design `SlovoApp`, the Collections tab). */
export const collectionCard = {
  height: 150,
  /** The corner of a card and of the dashed «Нова колекція» card (board 09). */
  radius: 18,
  /** The dashed outline of the «Нова колекція» card. */
  newBorder: 2.5,
  /** The red «+» tile of the «Нова колекція» card: its side, its corner, the depth of its edge and its glyph. */
  plus: { side: 40, radius: 12, depth: 4, glyph: 18 },
  padding: 14,
  /** Between the cards, across and down. */
  gap: 12,
  mark: 34,
  /** Between the name and the count. */
  textGap: 6,
  countOpacity: 0.85,
} as const;

/**
 * A day of the Active Days calendar: a tile of this height and corner on a
 * grid with this gap, over a hard edge this deep, a day to come outlined by a
 * dashed line this wide.
 */
export const calendarDay = {
  height: 42,
  radius: 11,
  gap: 7,
  edge: 4,
  futureBorder: 2,
  /** The frost over a frozen day: diagonal stripes this wide, this far apart, in this ink. */
  frost: { stripe: 2, step: 7, color: 'rgba(20, 12, 10, 0.25)' },
} as const;

/**
 * The Profile's Break card (p1), from board 10: the card's padding, corner
 * and gap, the ghost number's place and opacity, the two slanted bars before
 * «ПЕРЕРВА», the width the paused line wraps in, the strip's card and the
 * inset of the next Break's line.
 */
export const breakCard = {
  padding: { vertical: 22, horizontal: 20 },
  radius: 24,
  gap: 12,
  ghost: { right: -6, top: -30, opacity: 0.35 },
  bar: { width: 7, height: 24, gap: 4, skew: '-14deg' },
  kickerGap: 10,
  pausedWidth: 230,
  strip: { padding: 16, radius: 20, gap: 6 },
  /** The next Break's line sits this far in from the card's sides. */
  nextInset: 4,
} as const;

/**
 * The Profile's Streak freeze card (p2): an ink card with its chip and its
 * 7-day strip of square days, and under it a row of two sunken tiles.
 */
export const freezeCard = {
  padding: 20,
  radius: 24,
  gap: 14,
  chip: { height: 30, paddingX: 10, radius: 9 },
  strip: { gap: 6 },
  day: { radius: 9 },
  tiles: { gap: 12, padding: 16, radius: 20, inside: 8 },
} as const;

/**
 * The new Level screen (board 10, p6): the small turned cream «РІВЕНЬ» in
 * the corner, the Level's giant number stamped on red under it, then the
 * title and the line.
 */
export const newLevelStamp = {
  padding: { top: 120, horizontal: 28, bottom: 40 },
  /** The cream kicker sits in the top corner, turned on its left edge. */
  kicker: { left: 20, top: 92 },
  /**
   * The number lands as the design's `slStamp`: hidden until `delay`, then over
   * `duration` from 3× at −26° through .92× at −8° (70 %, fully shown) to rest,
   * each step on `easing`. The kicker keeps the rest's `turn`.
   */
  land: {
    delay: 200,
    duration: 600,
    easing: [0.3, 1.4, 0.5, 1],
    from: { scale: 3, turn: -26 },
    press: { at: 0.7, scale: 0.92 },
  },
  turn: -8,
  numberTop: 96,
  titleTop: 30,
  lineTop: 12,
  mascotBottom: 22,
  mascotWidth: 120,
} as const;

/** The Profile's Level ladder, from board 10.8: a card per Level name in two columns, and the bar to the next name. */
export const levelLadder = {
  gap: 10,
  /** The six cards in one row, each `width` wide; the row scrolls when the screen is narrower. */
  card: { width: 112, padding: 12, radius: 16, border: 1, gap: 8 },
  /** The Level wedge holding a range's first Level (ADR 0145), its fill inset by `inset` of the side. */
  wedge: {
    width: 56,
    height: 44,
    inset: 0.07,
    shape: [
      [0, 0.18],
      [1, 0],
      [1, 1],
      [0, 0.82],
    ] as const satisfies Wedge,
  },
  /** The bar under the row to the next name, slanted by `skew` degrees. */
  bar: { height: 14, skew: -20, gap: 10 },
} as const;

/**
 * The Badge sheet, from the design (`XSaved` p3/p4): the mark at `markSide`
 * under the «ВІДЗНАКА» plate, the name, the condition and the date or
 * progress under it, and while not earned a bar slanted by `barSkew`
 * degrees, `barHeight` tall, over the button; the board's gap is 14.
 */
export const badgeSheet = {
  markSide: 150,
  markTop: 20,
  nameTop: 14,
  conditionTop: 14,
  statusTop: 6,
  barTop: 14,
  barHeight: 10,
  barSkew: -20,
  doneTop: 14,
} as const;

/**
 * The Due Quiz «Перевір себе» of the «Вчу» list (board 09, screen 73): the
 * red card's padding (more on the left), the gap between its text and its
 * button, the big count's place from the card's right and top edges and its
 * opacity; the sheet's segments (one per Word, slanted), the gap between
 * them, and an option's height.
 */
export const dueQuiz = {
  card: { padding: 18, paddingLeft: 20, gap: 14, textGap: 6 },
  count: { right: 90, top: -30, opacity: 0.85 },
  segment: { width: 26, height: 6, gap: 4, skew: '-20deg' },
  optionHeight: 54,
} as const;
