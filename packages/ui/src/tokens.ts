import type { ColorTokens, EditionTokens, FontSize } from '@slovo/contracts';

/**
 * The design tokens from `docs/design/design-system.md`. The Core names every
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
    },
  },
  fontFamilies: { word: undefined, ui: undefined },
  radii: { card: 22, chip: 14, button: 14, sheet: 22 },
};

/** The Edition's tokens over the Core's neutral ones, group by group. */
export function designTokens(edition: EditionTokens): DesignTokens {
  return {
    colors: edition.colors ?? coreTokens.colors,
    fontFamilies: edition.fontFamilies ?? coreTokens.fontFamilies,
    radii: edition.radii ?? coreTokens.radii,
  };
}

/** A `#RRGGBB` colour at the given opacity; any other colour as it is. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex === null) return color;
  const [r, g, b] = hex.slice(1).map((pair) => parseInt(pair, 16));
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/** The 4-pt spacing grid. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

/** Type sizes of the UI roles; the UI body follows iOS Dynamic Type. */
export const typeSize = {
  screenTitle: 34,
  emptyStateTitle: 28,
  overline: 11,
  /** `Big number`, the Streak. */
  streak: 64,
  /** `Big number`, a count of the stats sheet (the Scale gives 26–30). */
  count: 28,
  chip: 12.5,
  outlinedChip: 11.5,
  body: 15,
  button: 16,
  sheetTitle: 26,
  partOfSpeech: 14,
  tabLabel: 10.5,
} as const;

/** The overline label's type: bold capitals spaced 0.14em apart. */
export const overlineType = {
  fontSize: typeSize.overline,
  fontWeight: '700',
  letterSpacing: typeSize.overline * 0.14,
  textTransform: 'uppercase',
} as const;

/** The Word card's type sizes at each font-size step (spec #51: one table). */
export const fontSizeSteps: Readonly<
  Record<
    FontSize,
    { readonly lemma: number; readonly definition: number; readonly example: number }
  >
> = {
  S: { lemma: 40, definition: 17, example: 15 },
  M: { lemma: 48, definition: 19, example: 17 },
  L: { lemma: 56, definition: 21, example: 19 },
  XL: { lemma: 64, definition: 23, example: 21 },
};

/** The text size scale above which a row puts its value, button or switch under its label, so no word breaks. */
export const STACK_AT_FONT_SCALE = 1.3;

/** The Story Share Card's image in pixels: a true 9:16 (design-system gap 17). */
export const storyImage = { width: 1080, height: 1920 } as const;

/** The smallest side of anything the user taps. */
export const minTouchTarget = 44;

/** A toast's corner radius, from the design; layout, not an Edition token. */
export const toastRadius = 6;

/** `elev.toast`: `0 10 30 rgba(0, 0, 0, .4)`. */
export const toastElevation = {
  shadowColor: '#000000',
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
