import { coreTokens, designTokens, fontSizeSteps, withAlpha } from '@slovo/ui/tokens';
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

  it('takes an Edition’s group over the Core’s, group by group', () => {
    const radii = { card: 1, chip: 2, button: 3, sheet: 4 };
    expect(designTokens({ radii })).toEqual({ ...coreTokens, radii });
  });
});

describe('fontSizeSteps', () => {
  it('grows every Word card size from step to step', () => {
    const steps = (['S', 'M', 'L', 'XL'] as const).map((step) => fontSizeSteps[step]);
    for (const role of ['lemma', 'definition', 'example'] as const) {
      const sizes = steps.map((step) => step[role]);
      expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
      expect(new Set(sizes).size).toBe(sizes.length);
    }
  });
});
