import { readFileSync } from 'node:fs';

import { EditionTokensSchema } from '@slovo/contracts';
import {
  coreTokens,
  designTokens,
  fontSizeSteps,
  halftone,
  motion,
  offsetShadow,
  shadowEdge,
  typeStyle,
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
