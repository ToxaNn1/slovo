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

/** The Badge stamp, from the design: the earned Badge's mark lands on red. */
export const badgeStamp = {
  markSide: 210,
  /** The mark lands from this scale and turn to its rest. */
  from: { scale: 3, turn: -26 },
  turn: -8,
  /** The depth of the hard ink edge under the stamped mark. */
  drop: 8,
  padding: { top: 110, horizontal: 28, bottom: 40 },
  markTop: 70,
  titleTop: 34,
  nameTop: 10,
} as const;

/**
 * The Badge grid, from the design: marks in rows of their family under its
 * name, seven to a row of the Profile (`side`), larger on the Badges screen
 * (`screenSide`).
 */
export const badgeGrid = {
  side: 44,
  screenSide: 58,
  /** The Badges screen's cell: the mark with its date or progress under it. */
  screenCell: 80,
  captionGap: 6,
  gap: 6,
  familyGap: 14,
  headGap: 10,
  pressedScale: 0.88,
} as const;

/** The depth of the hard edge under an earned Badge's shape. */
export const badgeEdge = 4;

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
