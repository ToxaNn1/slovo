import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  EditionDecorSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  SplashDecorSchema,
  type ColorTokens,
} from '@slovo/contracts';
import { coreTokens } from '@slovo/ui/tokens';
import { describe, expect, it } from 'vitest';

const editionsDir = fileURLToPath(new URL('../../../editions/', import.meta.url));
const editions = readdirSync(editionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

function readJson(edition: string, file: string): unknown {
  return JSON.parse(readFileSync(`${editionsDir}${edition}/${file}`, 'utf8'));
}

// The Language Pack build reads neither the UI strings nor the design tokens,
// so the shell checks them here.
describe('Edition UI strings', () => {
  it.each(editions)('the %s Edition has every UI string the shell needs', (edition) => {
    expect(EditionStringsSchema.safeParse(readJson(edition, 'strings.json')).error).toBeUndefined();
  });
});

describe('Edition design tokens', () => {
  it.each(editions.filter((edition) => existsSync(`${editionsDir}${edition}/tokens.json`)))(
    'the %s Edition supplies valid design tokens',
    (edition) => {
      expect(EditionTokensSchema.safeParse(readJson(edition, 'tokens.json')).error).toBeUndefined();
    },
  );

  it('the Ukrainian Edition supplies its own colours, type families and radii', () => {
    const tokens = EditionTokensSchema.parse(readJson('uk', 'tokens.json'));

    expect(Object.keys(tokens).sort()).toEqual(['colors', 'fontFamilies', 'radii']);
  });

  it.each([
    ['a colour that is not #RRGGBB or rgba()', { colors: { light: { ink: 'red' } } }],
    ['a missing colour in a scheme', { colors: { light: {}, dark: {} } }],
    ['a negative radius', { radii: { card: -1, chip: 2, button: 4, sheet: 22 } }],
    ['an unknown token group', { shadows: {} }],
  ])('rejects %s', (_, tokens) => {
    expect(EditionTokensSchema.safeParse(tokens).success).toBe(false);
  });
});

describe('Edition Decor', () => {
  const withDecor = editions.filter((edition) =>
    existsSync(`${editionsDir}${edition}/decor/decor.json`),
  );

  it.each(withDecor)('the %s Edition supplies valid Decor', (edition) => {
    expect(
      EditionDecorSchema.safeParse(readJson(edition, 'decor/decor.json')).error,
    ).toBeUndefined();
  });

  it('the Ukrainian Edition fills every Decor slot the Feed and the splash use', () => {
    const decor = EditionDecorSchema.parse(readJson('uk', 'decor/decor.json'));

    expect(Object.keys(decor).sort()).toEqual([
      'background',
      'corners',
      'divider',
      'emptyState',
      'splash',
    ]);
    expect(decor.emptyState?.error).toBeDefined();
    expect(decor.splash?.band).toBeDefined();
  });

  it.each(
    editions.filter(
      (edition) =>
        existsSync(`${editionsDir}${edition}/tokens.json`) &&
        existsSync(`${editionsDir}${edition}/decor/splash.json`),
    ),
  )('the %s Edition has a native splash on its own background colour in both Themes', (edition) => {
    const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens.json'));
    const splash = SplashDecorSchema.parse(readJson(edition, 'decor/splash.json'));

    expect(splash.light.backgroundColor).toBe(colors?.light.background);
    expect(splash.dark.backgroundColor).toBe(colors?.dark.background);
  });

  /** The text colour roles drawn straight on the screen background. */
  const textRoles = ['ink', 'muted', 'inkSecondary', 'accent'] as const;

  describe.each(withDecor.filter((edition) => existsSync(`${editionsDir}${edition}/tokens.json`)))(
    'the %s Edition',
    (edition) => {
      const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens.json'));
      const { background } = EditionDecorSchema.parse(readJson(edition, 'decor/decor.json'));

      it.each(['light', 'dark'] as const)(
        'keeps text at WCAG AA contrast over its background Decor in %s',
        (scheme) => {
          if (colors === undefined || background === undefined) return;
          const screen = colors[scheme].background;
          const stitched = background.tile.layers.map((layer) => over(layer[scheme], screen));

          for (const role of textRoles) {
            const text = colors[scheme][role satisfies keyof ColorTokens];
            for (const behind of [parseColor(screen), ...stitched]) {
              expect(
                contrast(parseColor(text), behind),
                `${role} over ${String(behind)}`,
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
        },
      );
    },
  );
});

/**
 * Every pair of a text colour and the colour it is drawn on in the 0.2
 * screens: the Feed, its cards and states, Settings and the tab bar.
 */
const textPairs: readonly (readonly [text: keyof ColorTokens, behind: keyof ColorTokens])[] = [
  // Screen titles, the end-of-Cycle and error states, the loading line, the tab bar.
  ['ink', 'background'],
  ['muted', 'background'],
  ['accent', 'background'],
  ['inactiveTab', 'background'],
  // The Word card and the Correction card.
  ['ink', 'surface'],
  ['muted', 'surface'],
  ['inkSecondary', 'surface'],
  ['accent', 'surface'],
  // The Category chip and the Correction's example pair.
  ['ink', 'surfaceSunken'],
  ['muted', 'surfaceSunken'],
  // The segmented control.
  ['ink', 'track'],
  // Inverted: the Word of the Day badge, the error button, the swipe hint.
  ['background', 'accent'],
  ['background', 'ink'],
  // The Pronunciation message on ink, and the speaker while it plays on accent.
  ['surface', 'ink'],
  ['surface', 'accent'],
];

describe('WCAG AA contrast of the 0.2 screens', () => {
  const tokenSets = [
    ['the Core', coreTokens.colors] as const,
    ...editions
      .filter((edition) => existsSync(`${editionsDir}${edition}/tokens.json`))
      .flatMap((edition) => {
        const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens.json'));
        return colors === undefined ? [] : [[`the ${edition} Edition`, colors] as const];
      }),
  ];

  describe.each(tokenSets)('%s', (_, colors) => {
    it.each(['light', 'dark'] as const)('keeps every text at 4.5:1 or more in %s', (scheme) => {
      for (const [text, behind] of textPairs) {
        expect(
          contrast(parseColor(colors[scheme][text]), parseColor(colors[scheme][behind])),
          `${text} on ${behind}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

type Rgb = readonly [number, number, number];

/** `#RRGGBB` or `rgba(r, g, b, a)` as red, green, blue and alpha. */
function parseRgba(color: string): readonly [number, number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex !== null) {
    const [, r = '', g = '', b = ''] = hex;
    return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), 1];
  }
  const [r = 0, g = 0, b = 0, a = 1] = (/\(([^)]*)\)/.exec(color)?.[1] ?? '')
    .split(',')
    .map(Number);
  return [r, g, b, a];
}

function parseColor(color: string): Rgb {
  const [r, g, b] = parseRgba(color);
  return [r, g, b];
}

/** A colour drawn over an opaque one. */
function over(color: string, behind: string): Rgb {
  const [r, g, b, a] = parseRgba(color);
  const [br, bg, bb] = parseColor(behind);
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}

/** The WCAG 2 contrast ratio of two opaque colours. */
function contrast(first: Rgb, second: Rgb): number {
  const luminance = (rgb: Rgb) => {
    const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
