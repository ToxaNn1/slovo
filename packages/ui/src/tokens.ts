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
      inactiveTab: '#8A8A8A',
      correct: '#2F6B45',
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

/** The 4-pt spacing grid. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

/** Type sizes of the UI roles; the UI body follows iOS Dynamic Type. */
export const typeSize = {
  screenTitle: 34,
  emptyStateTitle: 28,
  overline: 11,
  body: 15,
  partOfSpeech: 14,
  tabLabel: 10.5,
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

/** The smallest side of anything the user taps. */
export const minTouchTarget = 44;
