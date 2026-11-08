import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

import { EditionTokensSchema } from '@slovo/contracts';
import {
  coreTokens,
  designTokens,
  fontSizeSteps,
  halftone,
  idiomExpressionLength,
  motion,
  offsetShadow,
  roleAt,
  roleSize,
  roundPromptLength,
  shadowEdge,
  sizeForLength,
  typeRoles,
  typeStyle,
  type TypeRole,
  wedges,
  withAlpha,
} from '@slovo/ui/tokens';
import { describe, expect, it } from 'vitest';

describe('withAlpha', () => {
  it('turns a #RRGGBB colour into rgba at the given opacity', () => {
    expect(withAlpha('#161616', 0.5)).toBe('rgba(22, 22, 22, 0.5)');
  });

  it('reads the hex digits in either case', () => {
    expect(withAlpha('#FfA000', 1)).toBe('rgba(255, 160, 0, 1)');
  });

  it.each(['rgba(0, 0, 0, 0.1)', '#FFF', '#GGGGGG', 'red'])('leaves %s as it is', (color) => {
    expect(withAlpha(color, 0.5)).toBe(color);
  });
});

describe('designTokens', () => {
  it('takes the Core’s neutral values for every group the Edition leaves out', () => {
    expect(designTokens({})).toEqual(coreTokens);
  });

  it('keeps the Core’s palette neutral: the accent marks a right answer and the heart, the ink a wrong one', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const colors = coreTokens.colors[scheme];
      expect([colors.correct, colors.heart]).toEqual([colors.accent, colors.accent]);
      expect(colors.wrong).toBe(colors.ink);
    }
  });

  it('takes an Edition’s group over the Core’s, group by group', () => {
    const radii = { tile: 5, card: 1, chip: 2, button: 3, sheet: 4 };
    expect(designTokens({ radii })).toEqual({ ...coreTokens, radii });
  });
});

describe('the Ukrainian Edition’s design tokens', () => {
  const tokens = designTokens(
    EditionTokensSchema.parse(
      JSON.parse(
        readFileSync(new URL('../../../editions/uk/tokens.json', import.meta.url), 'utf8'),
      ),
    ),
  );

  it('yields the design’s light palette', () => {
    expect(tokens.colors.light).toMatchObject({
      background: '#FFF4E6',
      surface: '#FFFBF5',
      ink: '#140C0A',
      accent: '#FF3B2F',
      accentEdge: '#C4271D',
      tile: '#FFFBF5',
      tileEdge: '#DCC2A6',
      onAccent: '#FFF4E6',
    });
  });

  it('yields the design’s dark palette', () => {
    expect(tokens.colors.dark).toMatchObject({
      background: '#140C0A',
      surface: '#221714',
      ink: '#FFF4E6',
      accent: '#FF3B2F',
      tile: '#33241F',
      tileEdge: '#050302',
    });
  });

  it('draws an answer, the heart and a destructive action in the design’s red in both Themes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const colors = tokens.colors[scheme];
      expect([colors.correct, colors.heart, colors.destructive]).toEqual(Array(3).fill('#FF3B2F'));
      expect(colors.wrong).toBe(colors.ink);
    }
  });

  it('sets the word in Unbounded and the UI in Onest', () => {
    expect(typeStyle('heroWord', tokens)).toEqual({
      fontFamily: 'Unbounded',
      fontSize: 50,
      fontWeight: '900',
      lineHeight: 50,
      letterSpacing: -1.5,
      textTransform: 'none',
      paddingTop: 13,
      marginTop: -13,
    });
    expect(typeStyle('definition', tokens)).toMatchObject({
      fontFamily: 'Onest',
      fontSize: 19,
      fontWeight: '500',
    });
  });
});

describe('the Core’s shape, type and motion roles', () => {
  it('sets the eyebrow in capitals, spaced out', () => {
    expect(typeStyle('eyebrow', coreTokens)).toMatchObject({
      textTransform: 'uppercase',
      letterSpacing: 2,
      fontWeight: '700',
    });
  });

  it('sets the screen titles and the button labels in capitals, as the board', () => {
    const transform = (name: Parameters<typeof typeStyle>[0]) =>
      typeStyle(name, coreTokens).textTransform;
    expect([transform('screenTitle'), transform('gamesTitle'), transform('buttonLabel')]).toEqual([
      'uppercase',
      'uppercase',
      'uppercase',
    ]);
  });

  it('gives a capital with a mark above it room above a tight line in every word role, without moving the line', () => {
    // Measured in Unbounded Black: Ї rises 1.010 em above the baseline, the
    // descent is 0.245 em. iOS cuts a line set tighter than the font from the
    // top, so the baseline sits 0.245 em above the line's bottom. A capital Й
    // or Ї can open any word role, capitalised or not.
    const isTypeRole = (name: string): name is TypeRole => name in typeRoles;
    const wordRoles = Object.keys(typeRoles)
      .filter(isTypeRole)
      .filter((name) => typeRoles[name].family === 'word');
    expect(wordRoles).toEqual(
      expect.arrayContaining(['buttonLabel', 'screenTitle', 'heading', 'heroWord', 'giantLetter']),
    );
    for (const name of wordRoles) {
      const { fontSize, lineHeight, paddingTop = 0, marginTop = 0 } = typeStyle(name, coreTokens);
      const capitalTop = lineHeight - 0.245 * fontSize - 1.01 * fontSize;
      expect({ name, room: paddingTop + capitalTop >= 0 }).toEqual({ name, room: true });
      expect({ name, line: paddingTop + marginTop }).toEqual({ name, line: 0 });
    }
  });

  it('gives a word role drawn at another size room for its capital marks at that size', () => {
    // The Share Card's giant glyph, 320 points on a 320-point line, drawn at
    // three times the size: Ї needs 1.255 × 960 = 1204.8 points of line.
    expect(roleAt('shareGiant', 960)).toEqual({
      fontSize: 960,
      lineHeight: 960,
      paddingTop: 245,
      marginTop: -245,
    });
    // A role outside the word family needs no room at any size.
    expect(roleAt('definition', 57)).toEqual({ fontSize: 57, lineHeight: 81 });
  });

  it('keeps the button label’s 16-point line on the board', () => {
    expect(typeStyle('buttonLabel', coreTokens)).toMatchObject({
      fontSize: 16,
      lineHeight: 16,
      paddingTop: 5,
      marginTop: -5,
    });
  });

  it('carries each role’s weight, so a component sets none: black for the loud roles, light for reading text', () => {
    const weight = (name: Parameters<typeof typeStyle>[0]) =>
      typeStyle(name, coreTokens).fontWeight;
    expect([weight('shout'), weight('screenTitle'), weight('buttonLabel')]).toEqual([
      '900',
      '900',
      '900',
    ]);
    expect([weight('heading'), weight('listWord')]).toEqual(['800', '800']);
    expect([weight('definition'), weight('example'), weight('explanation')]).toEqual([
      '500',
      '400',
      '400',
    ]);
  });

  it('maps the font size setting to the design’s three steps', () => {
    expect(fontSizeSteps.S).toEqual(fontSizeSteps.M);
    expect(fontSizeSteps.M.lemma).toBe(typeStyle('heroWord', coreTokens).fontSize);
    expect(fontSizeSteps.L.definition).toBeCloseTo(fontSizeSteps.M.definition * 1.15, 0);
    expect(fontSizeSteps.XL.lemma).toBeCloseTo(fontSizeSteps.M.lemma * 1.3, 0);
  });

  it('drops a pressed tile by the depth its shadow loses, onto the red edge under red', () => {
    expect(offsetShadow.rest.depth - offsetShadow.pressed.depth).toBe(
      offsetShadow.pressed.translateY,
    );
    expect(shadowEdge(coreTokens.colors.light, true)).toBe(coreTokens.colors.light.accentEdge);
    expect(shadowEdge(coreTokens.colors.light, false)).toBe(coreTokens.colors.light.tileEdge);
  });

  it('gives every wedge points inside its box', () => {
    for (const points of Object.values(wedges)) {
      expect(points.length).toBeGreaterThanOrEqual(3);
      expect(points.flat().every((value) => value >= 0 && value <= 1)).toBe(true);
    }
  });

  it('answers a press in 80 ms and fades everything in 300 ms under Reduce Motion', () => {
    expect(motion.press.duration).toBe(80);
    expect(motion.reduceMotion.duration).toBe(300);
    expect(halftone).toEqual({ dot: 'rgba(20, 12, 10, 0.22)', radius: 1.1, cell: 6 });
  });
});

describe('sizeForLength', () => {
  const size = { fontSize: 50, lineHeight: 60 };
  const steps = {
    steps: [
      { upTo: 5, scale: 1 },
      { upTo: 10, scale: 0.8 },
    ],
    longer: 0.6,
  } as const;
  const text = (length: number) => 'a'.repeat(length);

  it('keeps the full size for a short text and steps it down as the text grows', () => {
    expect(sizeForLength(size, text(5), steps)).toEqual(size);
    expect(sizeForLength(size, text(10), steps)).toEqual({ fontSize: 40, lineHeight: 48 });
    expect(sizeForLength(size, text(11), steps)).toEqual({ fontSize: 30, lineHeight: 36 });
  });

  it('counts no Stress mark as a letter', () => {
    expect(sizeForLength(size, `${text(2)}\u0301${text(3)}`, steps)).toEqual(size);
  });

  it('sets a Round prompt at 24, a longer one at 20 and a long one at 18 (owner 08.11)', () => {
    const at = (length: number) =>
      sizeForLength(roleSize('roundPrompt'), text(length), roundPromptLength).fontSize;
    expect(at(22)).toBe(24);
    expect(at(68)).toBe(20);
    // The owner's Quick Question of 110 letters.
    expect(at(110)).toBe(18);
  });

  it("sets an Idiom's expression at the Lemma size, a longer one at 40 and a long one at 30 at M (owner 08.11)", () => {
    const lemma = { fontSize: fontSizeSteps.M.lemma, lineHeight: 65 };
    const at = (length: number) =>
      sizeForLength(lemma, text(length), idiomExpressionLength).fontSize;
    expect(at(7)).toBe(50);
    expect(at(14)).toBe(40);
    // «мокрим рядном накрити» and «І долоню протиснути не можна».
    expect(at(21)).toBe(30);
    expect(at(28)).toBe(30);
  });
});
