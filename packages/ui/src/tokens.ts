import type { ColorTokens, EditionTokens, FontSize, MascotState } from '@slovo/contracts';

/**
 * The design tokens from `docs/design/README.md`. The Core names every
 * token and holds the neutral values; an Edition supplies its own values in
 * `editions/<edition>/tokens.json` (ADR 0006). Sizes and spacing belong to the
 * layouts, so they stay in the Core.
 */

/** Light or dark: how the app is drawn right now. */
export type ColorScheme = 'light' | 'dark';

export interface DesignTokens {
  readonly colors: Readonly<Record<ColorScheme, ColorTokens>>;
  /** Font family names, or `undefined` for the platform's system font. */
  readonly fontFamilies: { readonly word: string | undefined; readonly ui: string | undefined };
  readonly radii: {
    readonly tile: number;
    readonly card: number;
    readonly chip: number;
    readonly button: number;
    readonly sheet: number;
  };
}

/**
 * The Core's neutral tokens, used for every group an Edition leaves out. The
 * design leaves some Core values open (its gaps #21 and #22); those marked
 * "derived" follow the nearest named value.
 */
export const coreTokens: DesignTokens = {
  colors: {
    light: {
      background: '#F4F4F2',
      surface: '#FFFFFF',
      ink: '#161616',
      muted: '#6A6A6A',
      accent: '#161616',
      decor: '#D6D6D2',
      inkSecondary: '#3D3D3D',
      surfaceSunken: '#EFEFEC',
      track: '#E8E8E5', // derived
      line: 'rgba(0, 0, 0, 0.1)',
      // The design's #8A8A8A is only 3.1:1 on the background; muted keeps AA.
      inactiveTab: '#6A6A6A',
      correct: '#2F6B45',
      wrong: '#A3271F',
      heart: '#C8372D',
      destructive: '#A3271F',
      tile: '#FFFFFF',
      tileEdge: '#D6D6D2',
      accentEdge: '#000000',
      onAccent: '#FFFFFF',
      highlight: '#E8E8E5',
      silhouette: 'rgba(0, 0, 0, 0.14)',
      tabBar: 'rgba(244, 244, 242, 0.94)',
    },
    dark: {
      background: '#111111',
      surface: '#1C1C1C',
      ink: '#F2F2F0',
      muted: '#9C9C9C',
      accent: '#F2F2F0',
      decor: '#3A3A3A',
      inkSecondary: '#D0D0CC', // derived
      surfaceSunken: '#262626', // derived
      track: '#262626', // derived
      line: 'rgba(255, 255, 255, 0.12)', // derived
      inactiveTab: '#8A8A8A', // derived
      correct: '#8FC79F',
      wrong: '#E8877D', // derived, like correct, to read on the dark surfaces
      heart: '#C8372D',
      destructive: '#A3271F',
      tile: '#262626',
      tileEdge: '#000000',
      accentEdge: '#9C9C9C',
      onAccent: '#111111',
      highlight: '#3A3A3A',
      silhouette: 'rgba(255, 255, 255, 0.1)',
      tabBar: 'rgba(17, 17, 17, 0.94)',
    },
  },
  fontFamilies: { word: undefined, ui: undefined },
  radii: { tile: 14, card: 22, chip: 14, button: 14, sheet: 22 },
};

/** The Edition's tokens over the Core's neutral ones, group by group. */
export function designTokens(edition: EditionTokens): DesignTokens {
  return {
    colors: edition.colors ?? coreTokens.colors,
    fontFamilies: edition.fontFamilies ?? coreTokens.fontFamilies,
    radii: edition.radii ?? coreTokens.radii,
  };
}

/** A font weight a type role sets; the Edition's families bring these weights. */
export type FontWeight = '400' | '500' | '600' | '700' | '800' | '900';

/** One type role of the design: which family slot it takes and how it sets text. */
export interface TypeRoleSpec {
  readonly family: 'word' | 'ui';
  readonly size: number;
  readonly weight: FontWeight;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly textTransform: 'none' | 'uppercase';
}

const role = (
  family: TypeRoleSpec['family'],
  weight: FontWeight,
  size: number,
  lineHeight: number,
  letterSpacing = 0,
  textTransform: TypeRoleSpec['textTransform'] = 'none',
): TypeRoleSpec => ({ family, size, weight, lineHeight, letterSpacing, textTransform });

/**
 * The Core's type roles (ADR 0070): a role carries its weight, so components
 * write none. The word family sets the loud roles, the UI family the reading
 * text and the meta.
 */
export const typeRoles = {
  shout: role('word', '900', 96, 88, -5),
  heroWord: role('word', '900', 50, 50, -1.5),
  screenTitle: role('word', '900', 30, 30, -1),
  heading: role('word', '800', 18, 20, 0.5),
  eyebrow: role('word', '700', 11, 13, 2, 'uppercase'),
  buttonLabel: role('word', '900', 16, 16),
  listWord: role('word', '800', 17, 20),
  /** Reading text: a Definition. */
  definition: role('ui', '500', 19, 27),
  /** Reading text: an Example. */
  example: role('ui', '400', 17, 25),
  /** Reading text: the line under a heading. */
  sub: role('ui', '500', 15, 21),
  meta: role('ui', '500', 13, 17),
  /** A tab's label under its icon. */
  tabLabel: role('ui', '600', 11, 11),
  /** The rotated black title of a bottom sheet. */
  sheetTitle: role('word', '900', 18, 18, 0.5, 'uppercase'),
  /** A toast's message. */
  toast: role('ui', '600', 14, 19),
  /** The label of a toast's button. */
  toastAction: role('word', '800', 12, 12, 0, 'uppercase'),
  /** The app's name beside the wedge at the top of the Feed. */
  logo: role('word', '900', 22, 22, -0.5),
  /** Today in the Feed's header. */
  headerDate: role('ui', '600', 13, 13),
  /** The Streak in its pill. */
  streak: role('word', '800', 14, 14),
  /** The word an onboarding step shouts on its red top. */
  stepShout: role('word', '900', 168, 151, -8),
  /** An onboarding step's title. */
  stepTitle: role('word', '800', 28, 31, -0.5),
  /** An onboarding step's text under its title. */
  stepText: role('ui', '400', 16, 23),
  /** The number on a Daily Goal tile of the onboarding. */
  goalNumber: role('word', '900', 26, 26),
  /** The unit under a Daily Goal tile's number. */
  goalUnit: role('ui', '600', 12, 12),
  /** The title of a Feed Notice's card. */
  noticeTitle: role('word', '900', 22, 24),
  /** The text of a Feed Notice's card, under its title. */
  noticeText: role('ui', '400', 15, 22),
  /** A number of the Weekly Recap. */
  recapNumber: role('word', '900', 24, 24),
  /** The label under a number of the Weekly Recap. */
  recapLabel: role('ui', '500', 12, 14),
  /** The Word of the Community Word card. */
  communityWord: role('word', '900', 30, 30, -0.5),
  /** The Definition under the Word of the Community Word card. */
  communityDefinition: role('ui', '500', 16, 22),
  /** The title of the end-of-Cycle card. */
  endOfCycleTitle: role('word', '900', 26, 29),
  /** The name of a mood on its chip. */
  moodName: role('ui', '700', 15, 15),
  /** The Games screen's title. */
  gamesTitle: role('word', '900', 36, 36, -1),
  /** The title of a group of Game Modes, after its red mark. */
  groupTitle: role('word', '800', 13, 13, 1.5, 'uppercase'),
  /** The glyph on a Game Mode's tile. */
  modeGlyph: role('word', '900', 15, 15),
  /** A Game Mode's name in its row. */
  modeName: role('ui', '700', 16, 18),
  /** A Game Mode's line under its name. */
  modeLine: role('ui', '400', 13, 16),
  /** A Game Mode's Best result at the end of its row. */
  modeBest: role('word', '800', 12, 12),
  /** The Daily Crossword's name on its red card. */
  crosswordTitle: role('word', '900', 19, 20, 0, 'uppercase'),
  /** How far today's Daily Crossword has come, on its red card. */
  crosswordState: role('word', '800', 12, 12, 1, 'uppercase'),
} as const satisfies Record<string, TypeRoleSpec>;

export type TypeRole = keyof typeof typeRoles;

/** The text style of a type role in the given tokens' families. */
export function typeStyle(name: TypeRole, tokens: Pick<DesignTokens, 'fontFamilies'>) {
  const { family, size, weight, lineHeight, letterSpacing, textTransform } = typeRoles[name];
  return {
    fontFamily: tokens.fontFamilies[family],
    fontSize: size,
    fontWeight: weight,
    lineHeight,
    letterSpacing,
    textTransform,
  };
}

/**
 * The hard offset shadow under a pressed tile or button: no blur, the edge
 * colour straight below. Pressed, the tile drops by the difference, so its
 * bottom edge stays where it was.
 */
export const offsetShadow = {
  rest: { depth: 5 },
  pressed: { depth: 1, translateY: 4 },
  /** A key of an on-screen keyboard: a shallower edge, pressed down to the same thin one. */
  key: { depth: 3, translateY: 2 },
} as const;

/** The edge colour of a tile's offset shadow: `accentEdge` under red, `tileEdge` under the rest. */
export function shadowEdge(colors: ColorTokens, onAccent: boolean): string {
  return onAccent ? colors.accentEdge : colors.tileEdge;
}

/** The halftone raster: ink dots of this radius on a square grid of this cell. */
export const halftone = { dot: 'rgba(20, 12, 10, 0.22)', radius: 1.1, cell: 6 } as const;

/** A wedge shape as polygon points, each `[x, y]` a fraction of the box. */
export type Wedge = readonly (readonly [number, number])[];

/** The design's wedge cuts. */
export const wedges = {
  /** A right edge narrower than the left: the toast. */
  wedge: [
    [0, 0],
    [1, 0.3],
    [1, 0.7],
    [0, 1],
  ],
  /** The logo's wedge at the top of the Feed: a right edge narrower than the left. */
  logo: [
    [0, 0],
    [1, 0.22],
    [1, 0.78],
    [0, 1],
  ],
  /** The Streak's mark in its pill: a cut gem, pointed at the top. */
  streak: [
    [0.5, 0.04],
    [0.875, 0.54],
    [0.667, 0.96],
    [0.333, 0.96],
    [0.125, 0.54],
    [0.375, 0.38],
  ],
  /** The two chevrons under the end-of-Cycle card, which point down to swipe on. */
  swipeOn: [
    [0, 0],
    [0.5, 0.333],
    [1, 0],
    [1, 0.267],
    [0.5, 0.6],
    [0, 0.267],
  ],
  swipeOnLower: [
    [0, 0.4],
    [0.5, 0.733],
    [1, 0.4],
    [1, 0.667],
    [0.5, 1],
    [0, 0.667],
  ],
  /** The loader's wedge: a right edge narrower than the left, from the middle. */
  loader: [
    [0, 0],
    [1, 0.25],
    [1, 0.75],
    [0, 1],
  ],
  /** A slanted band: the toast's mark. */
  band: [
    [0, 0],
    [1, 0.25],
    [1, 1],
    [0, 0.75],
  ],
  /** A box with its bottom right corner cut up. */
  cut: [
    [0, 0],
    [1, 0],
    [1, 0.8],
    [0, 1],
  ],
  /** A band whose top rises to the right: the Share Card's footer. */
  rise: [
    [0, 0.3],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  /** A shield, pointed at the bottom. */
  shield: [
    [0, 0],
    [1, 0],
    [1, 0.64],
    [0.5, 1],
    [0, 0.64],
  ],
  /** A hexagon lying on its side: the Streak Badges. */
  hexagon: [
    [0.25, 0.03],
    [0.75, 0.03],
    [1, 0.5],
    [0.75, 0.97],
    [0.25, 0.97],
    [0, 0.5],
  ],
  /** A diamond standing on its point: the Level Badges. */
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
} as const satisfies Record<string, Wedge>;

/** The marks of the Collection cards of the Saved overview, in turn by the card's place. */
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
  levelSize: 44,
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
  titleSize: 30,
  nameSize: 16,
} as const;

/** The Profile's Badge grid: marks of this side in rows of their family. */
export const badgeGrid = { side: 42, gap: 6, familyGap: 14, pressedScale: 0.88 } as const;

/** The depth of the hard edge under an earned Badge's shape. */
export const badgeEdge = 4;

/** A cubic Bézier easing curve, as CSS `cubic-bezier(x1, y1, x2, y2)` takes it. */
export type Easing = readonly [number, number, number, number];

/** CSS `ease`, for the motions the design gives no curve. */
const ease: Easing = [0.25, 0.1, 0.25, 1];

/** The design's motions: durations in milliseconds and their curves (ADR 0070). */
export const motion = {
  press: { duration: 80, easing: ease },
  screen: { duration: 500, easing: [0.2, 0.8, 0.2, 1] },
  fly: { duration: 600, easing: [0.2, 0.9, 0.25, 1.15] },
  toast: { duration: 350, easing: [0.2, 0.9, 0.3, 1.1] },
  stamp: { duration: 450, easing: [0.2, 0.9, 0.3, 1.2] },
  /** The Level ring fills to the reader's progress. */
  ring: { duration: 1100, easing: [0.2, 0.8, 0.2, 1] },
  sheet: { duration: 450, easing: [0.2, 0.9, 0.3, 1] },
  pop: { duration: 300, easing: ease },
  /** One beat of the loader's wedges, from short to tall and back. */
  loader: { duration: 800, easing: [0.42, 0, 0.58, 1] },
  /** The toggle's knob slides over and overshoots. */
  switch: { duration: 280, easing: [0.3, 1.9, 0.5, 1] },
  /** Rows rise this far into place, one after another. */
  cascade: { duration: 400, easing: ease, rise: 16 },
  /** The tab indicator stretching in under the tab it moves to. */
  tab: { duration: 300, easing: [0.3, 1.6, 0.5, 1] },
  /** The red band sweeping over a screen as it enters. */
  sweep: { duration: 500, easing: [0.6, 0, 0.3, 1] },
  /** Under Reduce Motion every motion is this one fade. */
  reduceMotion: { duration: 300, easing: ease },
} as const satisfies Record<
  string,
  { readonly duration: number; readonly easing: Easing; readonly rise?: number }
>;

/**
 * The splash cut of the design (`startSplash` in `SlovoApp.dc.html`), on its
 * 390 × 844 frame, which the splash scales to the screen's width. The wordmark's
 * letters fly in one after another, the ink band cuts across with the tagline,
 * the Mascot rolls in shouting, and the app takes over after `hold`. The daily
 * open runs the same cut at `pace` of the first launch's; under Reduce Motion
 * the cut is one fade and the app takes over after `reduceMotionHold`.
 */
export const splashMotion = {
  frame: { width: 390, height: 844 },
  first: { pace: 1, hold: 2050, reduceMotionHold: 800 },
  daily: { pace: 0.28, hold: 560, reduceMotionHold: 350 },
  /** Each letter: where it stands, its turn, and its fly in from the screen's middle. */
  letters: [
    { x: -40, y: 70, rotate: -4 },
    { x: 178, y: 110, rotate: 6 },
    { x: -56, y: 300, rotate: 3 },
    { x: 190, y: 330, rotate: -7 },
    { x: 40, y: 520, rotate: -10 },
  ],
  letter: {
    size: 250,
    letterSpacing: -10,
    /** The middle of the frame the letters fly from, less the letter's own offset. */
    from: { x: 90, y: 580 },
    fromScale: 0.15,
    fromTurn: -30,
    duration: 500,
    delay: 500,
    stagger: 80,
    easing: [0.2, 0.9, 0.25, 1.15],
  },
  /** The ink band, as fractions of the screen, drawn in from the left. */
  band: [
    [0, 0.58],
    [1, 0.36],
    [1, 0.52],
    [0, 0.74],
  ],
  cut: { duration: 350, delay: 1250, easing: [0.7, 0, 0.3, 1] },
  tagline: { size: 15, letterSpacing: 4, turn: -12.5 },
  mascot: { x: 110, y: 640 },
  /** The Mascot rolls in from the left, turning as it comes. */
  roll: { duration: 600, from: -360, turn: -560, easing: [0.25, 0.9, 0.3, 1.1] },
} as const;

/**
 * A screen's entrance (the design's `slScr` and `slSweep`), in fractions of
 * the screen's width: the screen slides in by `shift` points while its
 * slanted left edge, `slant` wider at the bottom than at the top, wipes from
 * the right edge `travel` across; a red band of `band.width` sweeps over it,
 * slanted by `band.skewX`, from `band.from` to `band.to` of its own width.
 */
export const screenEnter = {
  shift: 30,
  slant: 0.25,
  travel: 1.4,
  band: { width: 0.45, skewX: '-18deg', from: -1.7, to: 2.8 },
} as const;

/**
 * An Entry card's reveal (the design's `slFly` and `slCasc` on the Word of the
 * Day): each letter of the headline flies in from `letters.from`, small and
 * turned, the n-th after `letters.delay + n × letters.stagger` ms, then the
 * card's details rise into place one after another at `details` ms.
 */
export const entryReveal = {
  letters: {
    duration: 550,
    easing: [0.2, 0.9, 0.25, 1.2],
    delay: 120,
    stagger: 60,
    /** The n-th letter starts `x - n × xStep` points across and `y` points down. */
    from: { x: 40, xStep: 44, y: 240, scale: 0.15, rotate: -30 },
  },
  details: [650, 720, 800, 900],
} as const satisfies {
  readonly letters: { readonly easing: Easing } & Record<string, unknown>;
  readonly details: readonly number[];
};

/** The tab bar of the design. */
export const tabBar = {
  /** A tab's height above the safe area. */
  height: 56,
  /** A tab's icon, square. */
  icon: 24,
  /** Space between a tab's icon and its label. */
  gap: 5,
  /** The red slanted indicator over the active tab, `top` points over the tab. */
  indicator: { width: 34, height: 6, top: -9, skewX: '-24deg' },
} as const;

/** The Mascot's width in points; its height follows the Edition's vector. */
export const mascotWidth = 130;

/**
 * Where the Mascot's figure stands at one point of its motion: `at` from 0 to
 * 1 through the cycle, a shift in points, a turn in degrees and a scale. What
 * a frame leaves out stays at rest.
 */
export interface MascotFrame {
  readonly at: number;
  readonly y?: number;
  readonly rotate?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

/**
 * The Mascot's motion in each state, from the design's keyframes (`rpBob`,
 * `rpBreath`, `rpShout`, `rpHop`, `rpPop`, `rpSquish`, `rpSway`), turning
 * about 30% across and 60% down the figure. `loop` repeats, `alternate` goes
 * back and forth, `once` plays and holds its end. The hat-off state is still,
 * and under Reduce Motion every state is the one fade of `motion.reduceMotion`.
 */
export const mascotMotion = {
  waits: {
    duration: 2400,
    repeat: 'loop',
    easing: [0.42, 0, 0.58, 1],
    frames: [{ at: 0 }, { at: 0.5, y: -5 }, { at: 1 }],
  },
  sleeps: {
    duration: 3000,
    repeat: 'loop',
    easing: [0.42, 0, 0.58, 1],
    frames: [{ at: 0 }, { at: 0.5, scaleX: 1.04, scaleY: 0.97 }, { at: 1 }],
  },
  shouts: {
    duration: 320,
    repeat: 'alternate',
    easing: [0.42, 0, 0.58, 1],
    frames: [{ at: 0 }, { at: 1, scaleX: 1.07, scaleY: 1.07, rotate: -3 }],
  },
  happy: {
    duration: 800,
    repeat: 'loop',
    easing: ease,
    frames: [{ at: 0 }, { at: 0.4, y: -12, rotate: -4 }, { at: 1 }],
  },
  celebrates: {
    duration: 550,
    repeat: 'loop',
    easing: ease,
    frames: [{ at: 0 }, { at: 0.4, y: -12, rotate: -4 }, { at: 1 }],
  },
  surprised: {
    duration: 450,
    repeat: 'once',
    easing: ease,
    frames: [
      { at: 0, scaleX: 0.7, scaleY: 0.7 },
      { at: 0.6, scaleX: 1.15, scaleY: 1.15 },
      { at: 1 },
    ],
  },
  cringes: {
    duration: 500,
    repeat: 'once',
    easing: ease,
    frames: [{ at: 0 }, { at: 0.4, scaleX: 0.86, scaleY: 1.08 }, { at: 1, scaleX: 0.94 }],
  },
  sad: {
    duration: 3200,
    repeat: 'loop',
    easing: [0.42, 0, 0.58, 1],
    frames: [{ at: 0 }, { at: 0.5, rotate: 3 }, { at: 1 }],
  },
  hatOff: undefined,
} as const satisfies Record<
  MascotState,
  | {
      readonly duration: number;
      readonly repeat: 'loop' | 'alternate' | 'once';
      readonly easing: Easing;
      readonly frames: readonly MascotFrame[];
    }
  | undefined
>;

/**
 * How the Core poses the Mascot's parts in some states: the turn of the whole
 * figure about the Edition's pivot, in degrees, and how far the hat drops.
 */
export const mascotPose = { sadTurn: 14, hatOffTurn: 26, cringeHatDrop: 4 } as const;

/** A `#RRGGBB` colour at the given opacity; any other colour as it is. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex === null) return color;
  const [r, g, b] = hex.slice(1).map((pair) => parseInt(pair, 16));
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/** The scrim behind a bottom sheet, from the design: the key ink at 55% in both Themes. */
export const scrim = 'rgba(20, 12, 10, 0.55)';

/** The 4-pt spacing grid. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

/** Type sizes of the UI roles; the UI body follows iOS Dynamic Type. */
export const typeSize = {
  screenTitle: 34,
  /** An empty state's title (Literata 500); also a Game mode's title. */
  emptyStateTitle: 28,
  overline: 11,
  /** `Big number`, the Streak. */
  streak: 64,
  /** `Big number`, a count of the stats sheet (the Scale gives 26–30). */
  count: 28,
  chip: 12.5,
  labelChip: 11.5,
  body: 15,
  button: 16,
  /** A sheet's title; also a result's number, an empty state's title and the Correction's non-standard form. */
  sheetTitle: 26,
  partOfSpeech: 14,
  /** `Block heading` (Manrope 700): the name of a card or a Collection, a sheet's text button; also an Example, an onboarding step's subtitle, a Round's sheet title. */
  blockHeading: 17,
  /** What an Entry's row leads with in a list, and over a sheet (the design's 20–22). */
  rowLemma: 20,
  /** A Collection row's newest Lemmas (the design's Literata 22). */
  collectionLemmas: 22,
  /** A line of a card's list, a Collection's name in a sheet, a name field. */
  listItem: 18,
  /** A recent query of Search. */
  recentQuery: 16,
  /** A count or a refusal beside a name; also the onboarding sample notification's body, a row's subtitle, a swipe action's label and a note under a button. */
  caption: 14,
  /** What goes on the right of a card's row, such as a relative time; also the Round's progress and tags, an Example's author, a notification's app name and time. */
  meta: 13,
  /** `Big number`, the count on a card of the Saved overview (the Scale gives 26–30). */
  cardCount: 30,
  /** The Correction's explanation (Manrope 16 / 1.55); also a result's line and a Game mode's sample. */
  explanation: 16,
  /** A step's wordmark, the hero Definition and the app icon's mark; also an Entry row's title, the count of a Collection or of Favorites, a time and the About description. */
  subhead: 22,
  /** A Round's option (Literata 500). */
  roundOption: 21,
  /** A Round's prompt. */
  roundPrompt: 25,
  /** The answer on a Round's sheet. */
  roundAnswer: 30,
  /** The title of an onboarding step (Literata 500). */
  onboardingTitle: 32,
  /** A small label beside a value: a row's trailing text, the name of a result's number. */
  smallLabel: 12,
  /** A Game mode's description. */
  modeDescription: 14.5,
  /** The title of the Game's result (Unbounded 900). */
  resultTitle: 34,
  /** The Game Review's title (Unbounded 800). */
  reviewTitle: 15,
  /** A Round of the Game Review (Onest 600). */
  reviewRow: 16,
  /** `Lemma, hero`: the onboarding welcome's Lemma (Literata 500, 76 / 1). */
  heroLemma: 76,
} as const;

/** The overline label's type: bold capitals spaced 0.14em apart. */
export const overlineType = {
  fontSize: typeSize.overline,
  fontWeight: '700',
  letterSpacing: typeSize.overline * 0.14,
  textTransform: 'uppercase',
} as const;

/**
 * The Word card's type sizes at each font-size step: the design's three
 * steps, the hero word and the reading text at their base size, 1.15 times it
 * and 1.3 times it (ADR 0070). S and M both take the base step.
 */
export const fontSizeSteps: Readonly<
  Record<
    FontSize,
    { readonly lemma: number; readonly definition: number; readonly example: number }
  >
> = {
  S: { lemma: 50, definition: 19, example: 17 },
  M: { lemma: 50, definition: 19, example: 17 },
  L: { lemma: 58, definition: 22, example: 20 },
  XL: { lemma: 65, definition: 25, example: 22 },
};

/**
 * Spacing the design draws between the steps of the 4-pt grid on the cards of
 * the Saved overview and of the Collections screen.
 */
export const cardSpace = {
  /** Between the blocks of a card of the Saved overview, and between its cards. */
  gap: 14,
  /** Around the content of a Collection's row and of the field that names one. */
  collectionPadding: 18,
} as const;

/** A Collection's card on the Saved overview (design `SlovoApp`, the Collections tab). */
export const collectionCard = {
  height: 150,
  padding: 14,
  /** Between the cards, across and down. */
  gap: 12,
  mark: 34,
  /** Between the name and the count. */
  textGap: 6,
  nameSize: 14,
  nameLineHeight: 17,
  countSize: 12,
  countOpacity: 0.85,
} as const;

/** The line heights the design gives in pixels rather than as a multiple of the size. */
export const lineHeight = { pronunciationNote: 20, aboutDescription: 30 } as const;

/** Vertical padding of a row in a list, off the 4-pt grid (the design's 14); also the space under a screen's header or over its list. */
export const rowPadding = 14;

/** The gap between the blocks of a Word card, a result or an empty state, off the 4-pt grid (the design's 18). */
export const blockGap = 18;

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
 * The Correction card's padding over its content, off the 4-pt grid (the
 * design's 28; its sides are the Word card's and its bottom is `space[6]`),
 * and the side of the mark before each sentence of its example pair.
 */
export const correctionCardLayout = { paddingTop: 28, exampleMark: 18 } as const;

/** The side of each button of the action row under the Entry card, from the design. */
export const actionButtonSize = 52;

/** The padding of the Word of the day badge. */
export const badgePadding = { horizontal: 10, vertical: 6 } as const;

/** The XP bar's side padding. */
export const xpBarPadding = 14;

/**
 * The Feed's header, from the design: the logo's wedge and its gap to the
 * name, and the gap between today and the Streak pill.
 */
export const feedHeader = { logoWedge: { width: 15, height: 22 }, logoGap: 8, endGap: 10 } as const;

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

/** The height of a mood's chip, and the gap between the chips. */
export const moodChip = { height: 52, gap: 10 } as const;

/** The padding of a label chip, by density. */
export const labelChipPadding = {
  tight: { horizontal: 7, vertical: 3 },
  roomy: { horizontal: 10, vertical: 5 },
} as const;

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
 * title sits over the slant and where the victory illustration (Decor slot 4)
 * sits in it; the gaps between the number tiles and inside one, a tile's
 * corner; the illustration's width on a win and on a loss.
 */
export const resultLayout = {
  panelHeight: 400,
  panelFootBottom: 96,
  illustrationTop: 70,
  numbersGap: 10,
  numberGap: 6,
  numberRadius: 16,
  winIllustration: 120,
  lossIllustration: 64,
} as const;

/** The mark that leads a Round of the Game Review: a square with ✓ or ✗. */
export const reviewMark = { side: 28, radius: 8 } as const;

/** The empty state's space over its illustration. */
export const emptyStatePaddingTop = 80;

/** The segmented control's drawing (design `SlovoApp`): a sunken track around its segments. */
export const segmentedDrawing = {
  padding: 4,
  gap: 4,
  radius: 12,
  segmentHeight: 38,
  segmentRadius: 9,
  labelSize: 13,
} as const;

/** The toggle's drawing (design `SlovoApp`): a track and the knob that travels inside it. */
export const switchDrawing = {
  width: 54,
  height: 32,
  radius: 10,
  knob: 26,
  knobRadius: 8,
  /** The gap between the knob and the track's edge. */
  inset: 3,
  /** The knob's hard shadow straight below it. */
  knobShadow: { depth: 2, color: 'rgba(20, 12, 10, 0.3)' },
} as const;

/** The chip's drawing (design `SlovoApp`, the Saved tabs): a label with an optional count. */
export const chipDrawing = {
  height: 38,
  paddingHorizontal: 14,
  gap: 6,
  labelSize: 14,
  countSize: 12,
  /** How far the count fades beside its label. */
  countOpacity: 0.7,
  /** The chip's scale while it is pressed. */
  pressedScale: 0.95,
} as const;

/** The search field's drawing (design `SlovoApp`): a sunken box, a magnifier and a clear button. */
export const searchFieldDrawing = {
  height: 50,
  radius: 14,
  paddingHorizontal: 14,
  gap: 10,
  icon: 18,
  inputSize: 16,
  clear: 28,
  clearRadius: 8,
  clearIcon: 10,
} as const;

/** The text field's drawing (design `XSettings`): its box, and the border a problem draws. */
export const textFieldDrawing = {
  height: 58,
  radius: 15,
  border: 2.5,
  inputSize: 16,
  problemSize: 13,
} as const;

/** The drawing of a slider on a row that is not available yet: track, fill and thumb. */
export const sliderDrawing = {
  trackHeight: 4,
  trackRadius: 2,
  thumbSize: 20,
  thumbRadius: 10,
} as const;

/** The checkbox's and the radio's mark: its side, the checkbox's corner and the outline. */
export const choiceMark = { size: 26, radius: 8, border: 2.5, tick: 16 } as const;

/** The text size scale above which a row puts its value, button or switch under its label, so no word breaks. */
export const STACK_AT_FONT_SCALE = 1.3;

/** The format of a Share Card's image: Story (9:16) or Square (1:1). */
export type ShareCardFormat = 'story' | 'square';

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

/** The smallest side of anything the user taps. */
export const minTouchTarget = 44;

/**
 * A day of the Active Days calendar: a tile of this height and corner on a
 * grid with this gap, over a hard edge this deep, a day to come outlined by a
 * dashed line this wide, and the day's number at this size.
 */
export const calendarDay = {
  height: 42,
  radius: 11,
  gap: 7,
  edge: 4,
  futureBorder: 2,
  number: 13,
  weekday: 11,
} as const;

/** How much a button that takes no press is dimmed. */
export const disabledOpacity = 0.5;

/** The opacity a pressed tile fades to where its face does not sink: under Reduce Motion, or with no edge. */
export const pressedFade = 0.7;

/** The heights of a button's face: the design's 58 pt main button, and a small one as tall as a tap area. */
export const buttonHeight = { large: 58, small: 44 } as const;

/** The side of the design's square icon button, and of the icon inside it. */
export const iconButton = { side: 44, icon: 20 } as const;

/**
 * Gaps and paddings of the Game's Round off the 4-pt grid, from the design:
 * between the options and between the header's parts, a tight one (the
 * progress label over its bar, «Далі» under the sheet), the sheet's own and
 * the vertical padding of the Round's card.
 */
/** The Round's progress (design `SlovoApp`): a skewed segment per Round. */
export const roundProgress = { height: 8, gap: 4, skew: '-20deg' } as const;

export const roundLayout = { gap: 10, tightGap: 6, sheetGap: 14, cardPaddingVertical: 30 } as const;

/**
 * The Daily Crossword, from the design: a cell's side and the gap between
 * cells (five of them fit the SE's width with the screen's margins), the
 * selected cell's ink ring and a cell's letter size; the clue bar's text
 * size and padding; the keyboard's key height, corner radius and letter
 * size, the gaps between keys and between rows, and how much wider the
 * delete key is than a letter key.
 */
/** The Daily Crossword's red card on the mode screen, from the design: its padding and the gap between its lines. */
export const dailyCrosswordCard = { padding: 18, gap: 6 } as const;

export const crosswordLayout = {
  cell: 62,
  cellGap: 8,
  ring: 3,
  letterSize: 26,
  clueSize: 15,
  cluePadding: 12,
  keyHeight: 46,
  keyRadius: 9,
  keySize: 15,
  keyGap: 4,
  keyRowGap: 7,
  eraseKeyFlex: 1.5,
} as const;

/** The sample notification of the onboarding: its app icon (side and corner radius) and the gap between its lines. */
export const sampleNotification = { iconSize: 38, iconRadius: 9, lineGap: 2 } as const;

/** SLOVO ID's mark on the onboarding's sign-in button: its side, corner radius and letter size. */
export const accountMark = { size: 26, radius: 6, letterSize: 17 } as const;

/**
 * An onboarding step of the design (`isOb` in `SlovoApp.dc.html`): the red
 * halftone top cut by `wedges.cut`, its shout word turned and flown in from
 * the left, the on-red Mascot, the skewed step dots and the Daily Goal tiles.
 */
export const onboardingLayout = {
  heroHeight: 440,
  shout: { left: -14, top: 96, turn: '-8deg', flyFrom: -120 },
  /** The Mascot's corner, less its own padding. */
  mascot: { right: 10, top: 270 },
  dot: { height: 8, width: 14, currentWidth: 34, gap: 6, skew: '-20deg' },
  side: 24,
  contentTop: 6,
  gap: 14,
  bottom: 40,
  goalTile: { height: 78, gap: 10, radius: 16, lineGap: 2 },
} as const;

/** The width of the rosette (Decor slot 4) between the SLOVO ID step's text and its buttons. */
export const onboardingRosetteWidth = 120;

/** The text on a filled option of the Game and on a destructive swipe action, white in both Themes. */
export const onFill = '#FFFFFF';

/**
 * «Sign in with Google» in Google's branding rules for the button
 * (https://developers.google.com/identity/branding-guidelines): the fill,
 * stroke and label of its light and dark themes, which follow the Theme, and
 * the side and the four colours of Google's "G" logo. Google's, not an
 * Edition's, so no Edition token changes them.
 */
export const googleSignInButton = {
  light: { fill: '#FFFFFF', stroke: '#747775', label: '#1F1F1F' },
  dark: { fill: '#131314', stroke: '#8E918F', label: '#E3E3E3' },
  logoSize: 20,
  logo: { blue: '#4285F4', green: '#34A853', yellow: '#FBBC05', red: '#EA4335' },
} as const;

/** The height of the provider sign-in buttons, Google's and Apple's, like the secondary button's. */
export const signInButtonHeight = 50;

/** The colour of a shadow, black in both Themes. */
export const shadowColor = '#000000';

/** A toast's corner radius, from the design; layout, not an Edition token. */
export const toastRadius = 6;

/** `elev.toast`: `0 10 30 rgba(0, 0, 0, .4)`. */
export const toastElevation = {
  shadowColor,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.4,
  shadowRadius: 15,
} as const;

/**
 * The widget guide's numbered steps: the square that holds the number, the
 * title's size (Manrope 700, 17 in the design) and the hint's line height as a
 * multiple of its size.
 */
export const guideStep = { badge: 28, badgeRadius: 4, titleSize: 17, hintLeading: 1.4 } as const;

/**
 * The drawing of the widgets in the widget guide. It is a picture of the
 * phone, so it does not follow the text size of iOS and its wallpaper is no
 * Edition token. The type sizes are smaller than the design's real widgets
 * (28–30 for the Lemma at 170×170, 34 at 364×170), which the drawing scales
 * down with its own width.
 */
export const widgetDrawing = {
  wallpaper: '#3F3128',
  /** The white of the drawing's app icons and caption, with the opacity of each. */
  white: '#FFFFFF',
  iconOpacity: 0.16,
  captionOpacity: 0.7,
  /** The app icons are drawn in two rows of two. */
  iconRows: 2,
  iconRadius: 12,
  /** The widgets' corner radius, the design's 22–24. */
  widgetRadius: 22,
  /** The medium widget's width over its height, from the design's 364 × 170. */
  mediumAspectRatio: 364 / 170,
  lemmaSize: 24,
  lineSize: 12,
} as const;
