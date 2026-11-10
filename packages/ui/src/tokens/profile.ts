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
 * The Badge stamp, from board 10.7: under the giant cream kicker the earned
 * Badge's mark lands on red in five frames, Підліт (it flies in), Удар (an
 * ink burst and a light shake), Відскок (it springs to `bounce`), Відбиток
 * (it rests at `turn`), then the ribbon and the button.
 */
export const badgeStamp = {
  markSide: 210,
  /** The mark flies in from this scale and turn. */
  from: { scale: 3, turn: -26 },
  /** The turn of the kicker and of the mark at rest. */
  turn: -8,
  bounce: 1.06,
  /** The ink burst behind the mark at the blow grows to this share of the mark's side. */
  burst: 1.5,
  /** The light shake at the blow, in points. */
  shake: 6,
  /** Where each frame ends, as a share of the motion; the ribbon and the button come in after `rest`. */
  frames: { fly: 0.35, blow: 0.5, bounce: 0.7, rest: 0.85 },
  /** The depth of the hard ink edge under the stamped mark. */
  drop: 8,
  padding: { top: 90, horizontal: 28, bottom: 40 },
  /** The mark overlaps the giant word's foot. */
  markTop: -18,
  nameTop: 16,
  lineTop: 6,
  ribbon: { top: 18, turn: -3, padding: { vertical: 6, horizontal: 18 } },
} as const;

/** The toast of a Badge earned during a Game: the mark, its name and the stamp's line on ink. */
export const badgeToast = {
  markSide: 40,
  gap: 12,
  padding: 12,
  radius: 16,
  /** Over the bottom of the screen, clear of the Game's buttons. */
  bottom: 96,
  horizontal: 16,
} as const;

/** The Badge's mark on its Share Card, as on the poster. */
export const badgeShareMark = { side: 28 } as const;

/**
 * The Badge grid, from the design (board 10): marks in rows of their Badge
 * family under its name, five to a row of the Profile (`side`), larger on
 * the Badges screen (`screenSide`) with each Badge's condition and date or
 * progress under its mark.
 */
export const badgeGrid = {
  side: 48,
  columns: 5,
  gap: 10,
  screenSide: 72,
  /** The Badges screen's cell: the mark with its condition and its date or progress under it. */
  screenCell: 100,
  screenGap: 12,
  captionGap: 6,
  familyGap: 14,
  headGap: 10,
  pressedScale: 0.88,
} as const;

/**
 * An earned Badge's mark, from the design (board 10): the family's shape in
 * its tone's ring, the face set inside it by `ring` of the side, over a drop
 * shadow `drop.large` deep above `drop.over` and `drop.small` at it and below.
 */
export const badgeMark = {
  ring: 0.09,
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

/** The checker tile shape of a Badge family, two corners cut: top left and bottom right (ADR 0087). */
export const badgeChecker = [
  [0.2, 0],
  [1, 0],
  [1, 0.8],
  [0.8, 1],
  [0, 1],
  [0, 0.2],
] as const satisfies Wedge;

/**
 * The face of a `checker` Badge in place of its symbol (ADR 0087): a square of
 * `cells` by `cells`, `side` of the mark's side, centred on the cream inset.
 */
export const badgeCheckerFace = { cells: 3, side: 0.48 } as const;

/** The «НОВА» tag over an earned Badge's top right corner, turned as on board 10.5. */
export const badgeNewTag = {
  turn: 8,
  top: -4,
  right: -8,
  paddingHorizontal: 5,
  paddingVertical: 2,
  radius: 3,
} as const;

/** Spacing the design draws between the steps of the 4-pt grid on the field that names a Collection. */
export const cardSpace = {
  /** Around the content of the field that names a Collection. */
  collectionPadding: 18,
} as const;

/** A Collection's card on the Collections screen (design `SlovoApp`, the Collections tab). */
export const collectionCard = {
  height: 150,
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

/** The Profile's Streak freeze card (p2), an ink card: its chip, its 7-day strip and the frost on a frozen day. */
export const freezeCard = {
  padding: 20,
  radius: 24,
  gap: 14,
  chip: { paddingX: 10, paddingY: 4, radius: 999 },
  tilesGap: 10,
  tilePadding: 12,
  tileRadius: 16,
  /** The frost mark of a frozen day: its box and its stroke. */
  frost: { box: 14, stroke: 1.6 },
} as const;

/**
 * The new Level screen (p6), from the design: the giant «РІВЕНЬ» with the
 * Level's number stamped into it on red, as the Badge stamp lands.
 */
export const newLevelStamp = {
  padding: { top: 110, horizontal: 28, bottom: 40 },
  /** The number lands from this scale and turn to its rest. */
  from: { scale: 3, turn: -26 },
  turn: -8,
  /** The number overlaps the giant word's foot. */
  numberTop: -18,
  /** The ink frame of the stamped number. */
  frame: 6,
  framePadding: { vertical: 4, horizontal: 22 },
  titleTop: 30,
} as const;

/** The Profile's Level ladder, from board 10.8: a card per Level name in two columns, and the bar to the next name. */
export const levelLadder = {
  gap: 10,
  card: { padding: 14, radius: 16, border: 2, gap: 4 },
  /** The wedge mark in a card's top right corner, one of the Collection marks in turn. */
  mark: { side: 26, top: 12, right: 12 },
  bar: { padding: 16, radius: 16, gap: 4 },
} as const;

/**
 * The Badge sheet, from the design (board 10 p3/p4): the mark at `markSide`
 * under the kicker, the name and the date or progress under it, and while
 * not earned a bar slanted by `barSkew` degrees, `barHeight` tall.
 */
export const badgeSheet = {
  markSide: 120,
  markTop: 14,
  nameTop: 14,
  statusTop: 6,
  barTop: 14,
  barHeight: 10,
  barSkew: -14,
  doneTop: 22,
} as const;
