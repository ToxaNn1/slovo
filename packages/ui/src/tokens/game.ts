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

/**
 * The Round's progress (board 07): 10 skewed segments under the header's
 * row, filled as the Rounds pass towards the mode's Round limit.
 */
export const roundProgress = { height: 6, gap: 4, skew: '-20deg', segments: 10 } as const;

/**
 * Gaps and paddings of the Game's Round off the 4-pt grid, from the design:
 * between the options and between the header's parts, a tight one (the
 * progress label over its bar, «Далі» under the sheet), the sheet's own and
 * the vertical padding and least height of the Round's card; and how far
 * the largest text sizes of iOS may scale the Round's smaller text, so it
 * never breaks a word.
 */
export const roundLayout = {
  gap: 10,
  tightGap: 6,
  sheetGap: 14,
  cardPaddingVertical: 30,
  cardMinHeight: 220,
  textMaxFontScale: 1.5,
} as const;

/**
 * The Round's header (board 07): the gap between its row and the bar and
 * label under it, between the row's parts and between Lives; a Life's flag;
 * the ✕'s 40-pt sunken square, its corners and glyph; the pop of a Life as
 * it is lost (`slPop`: its scale at the start, at 60 % and the end, and how
 * long it takes); how far the title may shrink to fit its line beside the
 * Lives, so «ВГАДАЙ СЛОВО · 3/15» shows whole on a narrow iPhone.
 */
export const roundHeader = {
  titleMinScale: 0.6,
  gap: 14,
  rowGap: 12,
  lifeGap: 4,
  life: { width: 16, height: 22 },
  exit: 40,
  exitRadius: 12,
  exitGlyph: 14,
  lostPop: { from: 0.6, peak: 1.12, duration: 400 },
} as const;

/**
 * A pick Round's option, board 07's answer tile (owner decision G6): its
 * least height, corners and side padding; how much an answered Round's other options fade, how far
 * a wrong choice drops and how a right one pops (`slPop`: its scale at the
 * start, 60 % and the end); the key at its left (side, corners, border and
 * the gap to the text); and the most characters a sentence option has before
 * it is a long text.
 */
export const answerOption = {
  minHeight: 66,
  radius: 16,
  paddingLeft: 16,
  paddingRight: 18,
  dimmedOpacity: 0.5,
  drop: 8,
  pop: [0.6, 1.12, 1],
  key: { side: 30, radius: 9, border: 2, gap: 14 },
  sentenceMost: 60,
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
 * The crossing Daily Crossword's card on the hub, board 08's three states
 * (ADR 0087): its padding and the gaps between its parts, its button's
 * height and side padding, the progress bar's height and slant, and the
 * solved card's small grid: a cell's side, corner and gap, how faint a block
 * shows on the ink, and how faint the time line is.
 */
export const crosswordDayCard = {
  padding: 18,
  gap: 14,
  lineGap: 6,
  barGap: 8,
  button: { height: 46, paddingHorizontal: 18, depth: 4 },
  bar: { height: 8, skew: '-20deg' },
  mini: { cell: 22, radius: 5, gap: 3 },
  solvedGap: 16,
  blockOpacity: 0.12,
  resultOpacity: 0.75,
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

/**
 * The traced Daily Crossword (ADR 0073): how much of a cell's side, from its
 * centre, catches the finger, so a diagonal passes between corners; the dotted
 * trace's dot and the gap between dots; an answer tile's side; how long a
 * trace that locked nothing takes to fade (ms).
 */
export const tracedCrosswordLayout = {
  hitRadius: 0.42,
  dot: 6,
  dotGap: 12,
  tile: 28,
  missFade: 300,
} as const;

/**
 * The crossing Daily Crossword (ADR 0087, board 08): a grid cell's side and
 * the gap between cells; how far a solved cell pops; the room above the clue
 * bar and above the path slot, and the slot's height, where the path chips or
 * the line on how to trace show; the Letter Wheel's side, the depth of its
 * disc's inner top edge, its tiles' side and corner radius, how far their
 * centres sit from the wheel's and how much of a tile, from its centre,
 * catches the finger; the red trace's width; a path chip's side; how far a
 * miss shakes and how long each beat takes (ms); the hand coach's fingertip
 * and how long one sweep between two tiles takes (ms).
 */
export const crossingCrosswordLayout = {
  cell: 54,
  cellGap: 7,
  pop: 1.12,
  clueGap: 14,
  slotGap: 8,
  slot: 48,
  wheel: 260,
  discEdge: 6,
  tile: 62,
  tileRadius: 18,
  orbit: 88,
  hitRadius: 0.5,
  trace: 12,
  chip: 34,
  shake: 8,
  shakeBeat: 60,
  coach: 30,
  coachRing: 3,
  pathGap: 4,
  coachSweep: 1100,
} as const;

/** The «Знаю» and «Не знаю» pair: two equal columns across the card's width (XActions). */
export const knowledgePair = { gap: 10 } as const;
