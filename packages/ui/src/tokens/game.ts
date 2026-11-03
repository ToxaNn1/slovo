/** The tokens of the Game and its modes. */

/**
 * A Game Mode's row on the mode screen, from the design: its tile's side,
 * corner and edge, the gap to its texts and the row's padding; the red mark
 * before a group's title.
 */
export const modeRow = {
  tile: 46,
  tileRadius: 13,
  tileDepth: 4,
  gap: 14,
  paddingVertical: 12,
  groupMark: { width: 10, height: 14 },
} as const;

/**
 * The Game's result, from the design: the red panel's height, how far its
 * title sits over the slant; the gaps between the number tiles and inside
 * one, a tile's corner.
 */
export const resultLayout = {
  panelHeight: 400,
  panelFootBottom: 96,
  numbersGap: 10,
  numberGap: 6,
  numberRadius: 16,
} as const;

/** The mark that leads a Round of the Game Review: a square with ✓ or ✗. */
export const reviewMark = { side: 28, radius: 8 } as const;

/** The Round's progress (design `SlovoApp`): a skewed segment per Round. */
export const roundProgress = { height: 8, gap: 4, skew: '-20deg' } as const;

/**
 * Gaps and paddings of the Game's Round off the 4-pt grid, from the design:
 * between the options and between the header's parts, a tight one (the
 * progress label over its bar, «Далі» under the sheet), the sheet's own and
 * the vertical padding of the Round's card; and the most of the Round's
 * head the Mascot and its line take, so the label keeps room for its whole
 * words.
 */
export const roundLayout = {
  gap: 10,
  tightGap: 6,
  sheetGap: 14,
  cardPaddingVertical: 30,
  mascotShare: '40%',
} as const;

/**
 * The Daily Crossword's red card on the mode screen, from the design: its
 * padding, the gap between its grid and its lines and between its lines, the
 * gap over the state, and the small grid's cell (side, corner, edge) and gap.
 */
export const dailyCrosswordCard = {
  padding: 18,
  gap: 16,
  lineGap: 6,
  stateGap: 4,
  mini: { cell: 22, radius: 5, depth: 2, gap: 4 },
} as const;

/**
 * The Daily Crossword, from the design: a cell's side and the gap between
 * cells (five of them fit the SE's width with the screen's margins), the
 * selected cell's ink ring, where a word's number sits in its first cell;
 * the clue bar's padding, the gap between its parts and its red number
 * badge (least width, height, corner radius and side padding); the
 * keyboard's key height and corner radius, the gaps between keys and between
 * rows, and how much wider the delete key is than a letter key.
 */
export const crosswordLayout = {
  cell: 62,
  cellGap: 8,
  ring: 3,
  cellNumberLeft: 6,
  cellNumberTop: 5,
  cluePadding: 12,
  clueGap: 10,
  clueNumber: { minWidth: 40, height: 34, radius: 9, paddingHorizontal: 6 },
  keyHeight: 46,
  keyRadius: 9,
  keyGap: 4,
  keyRowGap: 7,
  eraseKeyFlex: 1.5,
} as const;

/** The «Знаю» and «Не знаю» pair: two equal columns across the card's width (XActions). */
export const knowledgePair = { gap: 10 } as const;
