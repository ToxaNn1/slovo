import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  EditionDecorSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  PluralLabelSchema,
  PluralSchema,
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

describe('the 0.4 UI strings groups', () => {
  const groups = ['stats', 'onboarding', 'notifications', 'notificationBody'] as const;
  const strings = readJson('uk', 'strings.json') as Record<string, unknown>;

  it.each(groups)('the Ukrainian Edition needs the %s group', (group) => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== group));

    const result = EditionStringsSchema.safeParse(without);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(group);
  });

  it('gives every count the plural forms Ukrainian has', () => {
    const categories = new Intl.PluralRules('uk-UA').resolvedOptions().pluralCategories;
    const counts = [
      ...pluralsOf(strings['stats']),
      ...pluralsOf(strings['onboarding']),
      ...pluralsOf(strings['notifications']),
    ];

    expect(counts.length).toBeGreaterThan(0);
    for (const forms of counts) expect(Object.keys(forms).sort()).toEqual([...categories].sort());
  });
});

describe('the 0.5 UI strings group', () => {
  const strings = readJson('uk', 'strings.json') as Record<string, unknown>;

  it('the Ukrainian Edition needs the game group', () => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== 'game'));

    const result = EditionStringsSchema.safeParse(without);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('game');
  });

  /** The strings group without the key. */
  const without = (group: unknown, key: string) =>
    Object.fromEntries(
      Object.entries(group as Record<string, unknown>).filter(([name]) => name !== key),
    );
  const game = strings['game'] as Record<string, unknown>;

  it.each([
    ['game.best', { ...strings, game: without(game, 'best') }],
    [
      'game.result.record',
      { ...strings, game: { ...game, result: without(game['result'], 'record') } },
    ],
    ['stats.gameBest', { ...strings, stats: without(strings['stats'], 'gameBest') }],
  ])('the Ukrainian Edition needs %s, the best result', (path, stringsWithout) => {
    const result = EditionStringsSchema.safeParse(stringsWithout);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
  });

  it('needs the Rounds of a Game in every form of the best result on the mode screen', () => {
    const best = { ...(game['best'] as object), few: 'Найкраще — {count}.' };

    const result = EditionStringsSchema.safeParse({ ...strings, game: { ...game, best } });

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['game.best.few']);
  });

  it('gives every count and label of the Game the plural forms Ukrainian has', () => {
    const categories = new Intl.PluralRules('uk-UA').resolvedOptions().pluralCategories;
    const counts = [...pluralsOf(strings['game']), ...pluralsOf(strings['stats'])];

    expect(counts.length).toBeGreaterThan(0);
    for (const forms of counts) expect(Object.keys(forms).sort()).toEqual([...categories].sort());
  });
});

/** Every plural-forms object (one with an `other` form) in a strings group. */
function pluralsOf(value: unknown): Record<string, string>[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return 'other' in record
    ? [record as Record<string, string>]
    : Object.values(record).flatMap(pluralsOf);
}

describe('plural forms of a count', () => {
  it('takes the forms a language has, each with the count in it', () => {
    expect(
      PluralSchema.safeParse({
        one: '{count} запис',
        few: '{count} записи',
        other: '{count} записів',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['a form without the count', { one: 'один запис', other: '{count} записів' }],
    ['no `other` form', { one: '{count} запис', many: '{count} записів' }],
    ['a form that is not a CLDR category', { single: '{count} запис', other: '{count} записів' }],
  ])('rejects %s', (_, forms) => {
    expect(PluralSchema.safeParse(forms).success).toBe(false);
  });
});

describe('plural forms of a label beside its number', () => {
  it('takes the forms a language has, none with the count in it', () => {
    expect(
      PluralLabelSchema.safeParse({
        one: 'день поспіль',
        few: 'дні поспіль',
        other: 'днів поспіль',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['no `other` form', { one: 'день поспіль', many: 'днів поспіль' }],
    ['a form that is not a CLDR category', { single: 'день поспіль', other: 'днів поспіль' }],
    ['an empty form', { one: '', other: 'днів поспіль' }],
    ['a form with the count in it', { one: '{count} день поспіль', other: 'днів поспіль' }],
  ])('rejects %s', (_, forms) => {
    expect(PluralLabelSchema.safeParse(forms).success).toBe(false);
  });
});

describe('Edition design tokens', () => {
  it.each(editions.filter((edition) => existsSync(`${editionsDir}${edition}/tokens.json`)))(
    'the %s Edition supplies valid design tokens',
    (edition) => {
      expect(EditionTokensSchema.safeParse(readJson(edition, 'tokens.json')).error).toBeUndefined();
    },
  );

  it.each(['light', 'dark'] as const)(
    'needs the colour of a wrong answer in %s, from 0.5',
    (scheme) => {
      const tokens = EditionTokensSchema.parse(readJson('uk', 'tokens.json'));
      const withoutWrong = Object.fromEntries(
        Object.entries(tokens.colors?.[scheme] ?? {}).filter(([role]) => role !== 'wrong'),
      );

      const result = EditionTokensSchema.safeParse({
        ...tokens,
        colors: { ...tokens.colors, [scheme]: withoutWrong },
      });

      expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
        `colors.${scheme}.wrong`,
      ]);
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

  it('the Ukrainian Edition fills every Decor slot the Feed, the Game result and the splash use', () => {
    const decor = EditionDecorSchema.parse(readJson('uk', 'decor/decor.json'));

    expect(Object.keys(decor).sort()).toEqual([
      'background',
      'corners',
      'divider',
      'emptyState',
      'splash',
      'victory',
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

/** The Core's colours and those of every Edition that supplies its own. */
const tokenSets = [
  ['the Core', coreTokens.colors] as const,
  ...editions
    .filter((edition) => existsSync(`${editionsDir}${edition}/tokens.json`))
    .flatMap((edition) => {
      const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens.json'));
      return colors === undefined ? [] : [[`the ${edition} Edition`, colors] as const];
    }),
];

/** The other colour scheme, whose colours an inverted card draws its content in. */
const otherScheme = { light: 'dark', dark: 'light' } as const;

describe('WCAG AA contrast of the 0.2 screens', () => {
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

describe('WCAG AA contrast of the 0.3 Favorites screens', () => {
  describe.each(tokenSets)('%s', (_, colors) => {
    it.each(['light', 'dark'] as const)(
      'keeps the Favorites card, drawn in the other scheme on the ink fill, at 4.5:1 or more in %s',
      (scheme) => {
        const fill = parseColor(colors[scheme].ink);
        for (const text of ['ink', 'muted', 'inkSecondary', 'accent'] as const) {
          expect(
            contrast(parseColor(colors[otherScheme[scheme]][text]), fill),
            `the other scheme's ${text} on ink`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      },
    );

    it.each(['light', 'dark'] as const)(
      'keeps white on the destructive action at 4.5:1 and the filled heart at 3:1 in %s',
      (scheme) => {
        const { destructive, heart, background, surface } = colors[scheme];
        expect(contrast([255, 255, 255], parseColor(destructive))).toBeGreaterThanOrEqual(4.5);
        // The heart is a graphic, which needs 3:1 against what it sits on (WCAG 1.4.11).
        for (const behind of [background, surface]) {
          expect(contrast(parseColor(heart), parseColor(behind))).toBeGreaterThanOrEqual(3);
        }
      },
    );
  });
});

describe('WCAG AA contrast of the 0.5 Game screens', () => {
  describe.each(tokenSets)('%s', (_, colors) => {
    it('keeps white on the right and the wrong option, filled in the light colours, at 4.5:1 or more', () => {
      for (const fill of [colors.light.correct, colors.light.wrong]) {
        expect(contrast([255, 255, 255], parseColor(fill)), fill).toBeGreaterThanOrEqual(4.5);
      }
    });

    it.each(['light', 'dark'] as const)(
      "keeps the answer sheet's title, drawn in the other scheme on its surface, at 4.5:1 or more in %s",
      (scheme) => {
        const { surface, correct, wrong } = colors[otherScheme[scheme]];
        for (const title of [correct, wrong]) {
          expect(contrast(parseColor(title), parseColor(surface)), title).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      },
    );
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
