import type { Wedge } from './base';

/** The tokens of Settings and its panels. */

/**
 * A Settings row's drawing (design `SlovoApp`, Settings): its padding, the
 * gap between its parts, the sunken icon tile at its start with the slanted
 * shape inside, and the chevron that ends a row that opens a screen.
 */
export const settingsRowDrawing = {
  paddingVertical: 14,
  paddingHorizontal: 16,
  gap: 12,
  iconTile: 30,
  iconTileRadius: 9,
  icon: 14,
  chevronWidth: 8,
  chevronHeight: 13,
} as const;

/**
 * The About screen's red panel (design `SlovoApp`, `subAbout`): its height,
 * corner and padding, where the giant letter sits off its top right, and the
 * wedge before the app's name with the gap after it.
 */
export const aboutPanel = {
  height: 150,
  radius: 20,
  padding: 18,
  giant: { right: -30, top: -40 },
  wedge: { width: 23, height: 34 },
  gap: 10,
} as const;

/** The widget guide's numbered steps: the square that holds the number. */
export const guideStep = { badge: 28, badgeRadius: 4 } as const;

/**
 * The drawing of the widgets in the widget guide. It is a picture of the
 * phone, so it does not follow the text size of iOS and its wallpaper is no
 * Edition token. Its widgets are about as wide as board 15's (158 and 346),
 * so its type roles take the board's sizes, scaled to the drawing's width.
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
  /** The lock-screen widget's width over its height and its corner radius, from the board's 160 × 64 and 18. */
  lockScreenAspectRatio: 160 / 64,
  lockScreenRadius: 18,
} as const;

/**
 * The Narrator Voice screen (design `XVoice`): the red scene of the sample
 * Word, its play button and the 16 bars beside it, and the 2×2 voice tiles.
 * The bars take their heights, as shares of `barsHeight`, in turn from the
 * pattern in `barShares` at the chosen voice's position (the board's seeds); while the voice reads, each swings between `barRest` and its full
 * height in `barSwing` ms plus `barSwingStep` for every third bar, a bar
 * `barDelay` ms after the one before it. Each syllable lifts by
 * `syllableLift` for `syllableLiftDuration` ms, `syllableStep` ms after the
 * one before it.
 */
export const narratorVoiceDrawing = {
  sceneRadius: 26,
  scenePaddingTop: 22,
  scenePaddingHorizontal: 20,
  scenePaddingBottom: 20,
  sceneGap: 16,
  syllableGap: 2,
  play: 64,
  playRadius: 18,
  playIcon: 22,
  playGap: 14,
  bars: 16,
  barsGap: 4,
  barsHeight: 40,
  barShares: [
    [0.58, 0.79, 0.69, 0.93, 0.72, 0.86, 0.65, 0.76, 0.62],
    [0.86, 0.965, 0.79, 1, 0.895, 0.72, 0.93, 0.825, 0.79],
    [0.51, 0.93, 0.58, 1, 0.545, 0.895, 0.65, 0.965, 0.58],
    [0.72, 0.825, 0.895, 0.79, 0.93, 0.86, 0.755, 0.825, 0.72],
  ],
  barRest: 0.3,
  barSwing: 420,
  barSwingStep: 80,
  barDelay: 40,
  syllableLift: 5,
  syllableLiftDuration: 500,
  syllableStep: 450,
  choosePaddingTop: 22,
  choosePaddingBottom: 10,
  tile: 64,
  tileRadius: 16,
  tileGap: 10,
  tilePaddingHorizontal: 14,
  tileLineGap: 5,
  descriptionOpacity: 0.75,
} as const;

/**
 * «Мої Теми» (board XMix, variant E): the three setting tiles over the
 * Category groups, each tile with its small bars; a group's covers in two
 * columns while it holds `twoColumnsUpTo` Categories or fewer, else three,
 * each cover with its pictogram, the pictogram's offset shadow, a halftone
 * spot under it, the small shape and the check box in its corner.
 */
export const mixScreenDrawing = {
  tile: { height: 118, radius: 18, padding: 12, gap: 10, barsHeight: 22, barGap: 3 },
  /** A bar's height on a tile: the lowest, and how much each step adds. */
  bar: { base: 6, rarityStep: 4, levelStep: 5, radius: 3 },
  groupGap: 22,
  twoColumnsUpTo: 4,
  cover: {
    radius: 20,
    check: {
      side: 24,
      radius: 7,
      inset: 8,
      border: 2,
      /** The empty box's fill, white through, as the board's. */
      emptyFill: 'rgba(255, 255, 255, 0.6)',
      mark: { width: 12, height: 10 },
    },
    /** The line over a cover's name. */
    nameRule: 2,
    shadowOffset: 7,
    offAlpha: 0.45,
    /** The pictogram's middle, a share of the picture's height. */
    glyphMiddle: 0.46,
    /** The small shape's side, and a big small shape's (`MixCoverPictogram.bigAccent`). */
    two: {
      gap: 12,
      height: 132,
      glyph: 78,
      small: 20,
      bigSmall: 30,
      name: { x: 14, top: 12, bottom: 14 },
    },
    three: {
      gap: 8,
      height: 92,
      glyph: 50,
      small: 14,
      bigSmall: 20,
      name: { x: 10, top: 9, bottom: 11 },
    },
  },
  sheetOption: { height: 56, radius: 14 },
  /** The dashed row of the kinds' sheet that opens the Categories of Corrections. */
  subRow: { radius: 12, border: 1.5 },
} as const;

/** The board's points, in per cent of the box, as a Wedge in fractions of it. */
const percent = (points: readonly (readonly [number, number])[]): Wedge =>
  points.map(([x, y]) => [x / 100, y / 100] as const);
const radians = (degrees: number) => (degrees * Math.PI) / 180;
/** The point `r` per cent from (`cx`, `cy`) at `degrees`. */
const around = (cx: number, cy: number, r: number, degrees: number) =>
  [cx + r * Math.cos(radians(degrees)), cy + r * Math.sin(radians(degrees))] as const;

const person = (() => {
  const head: (readonly [number, number])[] = [];
  for (let d = 90; d >= -270; d -= 20) head.push(around(50, 14, 13, d));
  return percent([
    ...head,
    [50, 27],
    [46, 27],
    [46, 33],
    [22, 36],
    [10, 60],
    [18, 63],
    [28, 46],
    [30, 100],
    [46, 100],
    [50, 70],
    [54, 100],
    [70, 100],
    [72, 46],
    [82, 63],
    [90, 60],
    [78, 36],
    [54, 33],
    [54, 27],
    [50, 27],
  ]);
})();
const gear = (() => {
  const points: (readonly [number, number])[] = [];
  for (let k = 0; k < 8; k++) {
    const a = k * 45;
    for (const [d, r] of [
      [a - 9, 50],
      [a + 9, 50],
      [a + 16, 37],
      [a + 36, 37],
    ] as const)
      points.push(around(50, 50, r, d));
  }
  return percent(points);
})();
const pin = (() => {
  const points: (readonly [number, number])[] = [];
  for (let d = 140; d <= 400; d += 15) points.push(around(50, 38, 36, d));
  return percent([...points, [50, 100]]);
})();
const leaf = (() => {
  const right: (readonly [number, number])[] = [];
  for (let k = 0; k < 5; k++) {
    const y = 10 + k * 16;
    right.push([52, y + 10], [82, y], [84, y + 8], [52, y + 18]);
  }
  const left: (readonly [number, number])[] = [];
  for (let k = 4; k >= 0; k--) {
    const y = 10 + k * 16;
    left.push([48, y + 18], [16, y + 8], [18, y], [48, y + 10]);
  }
  return percent([
    [46, 2],
    [50, 0],
    [54, 2],
    [54, 10],
    ...right,
    [54, 96],
    [52, 100],
    [48, 100],
    [46, 96],
    ...left,
    [46, 10],
  ]);
})();
const spiral = (() => {
  const outer: (readonly [number, number])[] = [];
  const inner: (readonly [number, number])[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2.6;
    const r = 48 - a * 5.2;
    outer.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
    inner.unshift([50 + (r - 13) * Math.cos(a), 50 + (r - 13) * Math.sin(a)]);
  }
  return percent([...outer, ...inner]);
})();

/**
 * The pictograms of the Category covers of «Мої Теми» (board XMix), in the
 * order of the Edition's Categories: a person, a heart, a sun over
 * mountains, a house, a gear, a shield, a sword, columns, a flask, a speech
 * bubble, a pin, a lightning bolt, a leaf, a T, a tower and a spiral. Each
 * has its small shape's place, in shares of the picture, and whether the
 * small shape is a big circle, as the sun's, and its turn.
 */
export const mixCoverPictograms: readonly {
  readonly glyph: Wedge;
  readonly accent: {
    readonly left: number;
    readonly top: number;
    readonly big: boolean;
    /** Its turn, in degrees. */
    readonly rotate: number;
  };
}[] = (
  [
    person,
    percent([
      [50, 100],
      [0, 35],
      [25, 5],
      [50, 25],
      [75, 5],
      [100, 35],
    ]),
    percent([
      [0, 100],
      [32, 38],
      [50, 62],
      [70, 28],
      [100, 100],
    ]),
    percent([
      [50, 0],
      [100, 45],
      [100, 100],
      [0, 100],
      [0, 45],
    ]),
    gear,
    percent([
      [6, 0],
      [94, 0],
      [94, 52],
      [50, 100],
      [6, 52],
      [6, 0],
      [20, 30],
      [20, 44],
      [50, 66],
      [80, 44],
      [80, 30],
      [50, 52],
      [20, 30],
      [6, 0],
    ]),
    percent([
      [85, 0],
      [100, 15],
      [55, 62],
      [40, 80],
      [8, 100],
      [20, 60],
      [38, 45],
    ]),
    percent([
      [0, 30],
      [50, 0],
      [100, 30],
      [100, 40],
      [88, 40],
      [88, 100],
      [70, 100],
      [70, 40],
      [59, 40],
      [59, 100],
      [41, 100],
      [41, 40],
      [30, 40],
      [30, 100],
      [12, 100],
      [12, 40],
      [0, 40],
    ]),
    percent([
      [38, 0],
      [62, 0],
      [62, 8],
      [58, 8],
      [58, 38],
      [100, 92],
      [94, 100],
      [6, 100],
      [0, 92],
      [42, 38],
      [42, 8],
      [38, 8],
    ]),
    percent([
      [0, 0],
      [100, 0],
      [100, 75],
      [35, 75],
      [15, 100],
      [15, 75],
      [0, 75],
    ]),
    pin,
    percent([
      [58, 0],
      [14, 56],
      [46, 56],
      [36, 100],
      [86, 42],
      [54, 42],
      [66, 0],
    ]),
    leaf,
    percent([
      [8, 4],
      [92, 4],
      [92, 30],
      [58, 30],
      [58, 100],
      [42, 100],
      [42, 30],
      [8, 30],
    ]),
    percent([
      [50, 0],
      [62, 18],
      [56, 30],
      [64, 30],
      [64, 100],
      [36, 100],
      [36, 30],
      [44, 30],
      [38, 18],
    ]),
    spiral,
  ] as const
).map((glyph, at) => {
  const rotate = ((at * 37) % 60) - 30;
  return {
    glyph,
    accent:
      at === 2
        ? { left: 0.68, top: 0.1, big: true, rotate }
        : {
            left: at % 2 === 1 ? 0.14 : 0.7,
            top: at % 3 === 0 ? 0.58 : 0.14,
            big: false,
            rotate,
          },
  };
});

/** A stepper's drawing (board 11, 90): the sunken track's padding and corner, and the − and + tiles. */
export const stepperDrawing = { padding: 10, radius: 20, tile: 64, tileRadius: 16 } as const;

/**
 * An option screen's drawing (board 11, 85): the padding of the card that
 * holds the sample and its explaining line, the gap between the two, the
 * narrowest the line gets beside the sample before it drops under it, and
 * the padding of an option's row.
 */
export const optionScreenDrawing = {
  samplePadding: 18,
  sampleGap: 16,
  explanationMinWidth: 140,
  optionPaddingVertical: 17,
} as const;

/** A code cell's drawing (board 11, 96): its height, corner and ring. */
export const codeCellDrawing = { height: 62, radius: 13, border: 2 } as const;

/** The Account card of the signed-in Account screen (board 11, 97): its corner. */
export const accountCardRadius = 20;

/**
 * The Rarity Range picker of Settings (owner's shots 16.11): five slanted bars
 * of rising height, the lowest `barBase` points tall and each next one
 * `barStep` taller, `gap` apart and leaning `skew` to the right; the number
 * sits `numberInset` above a bar's foot. A bar the range takes dips to
 * `dip` of its height and springs back with `spring`. A drag starts once the
 * finger moves `dragStart` points sideways and gives way to the page's scroll
 * after `scrollYield` points up or down.
 */
export const rarityRangeDrawing = {
  headerGap: 12,
  barBase: 34,
  barStep: 10,
  gap: 6,
  radius: 3,
  skew: '-12deg',
  numberInset: 6,
  dip: 0.82,
  spring: { dampingRatio: 0.45, duration: 520 },
  dragStart: 6,
  scrollYield: 12,
} as const;
