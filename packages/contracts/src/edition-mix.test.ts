import { describe, expect, it } from 'vitest';

import { MixConfigSchema } from './edition';

const kinds = { correction: true, idiom: false, synonymRow: true, tip: false };
const mix = { categories: 'all', correctionCategories: 'all', kinds };

describe('the default Mix of the Edition config', () => {
  it('reads each kind of Entry beside Words as on or off', () => {
    expect(MixConfigSchema.parse(mix).kinds).toEqual(kinds);
  });

  it('refuses a default Mix that leaves a kind of Entry out', () => {
    const { tip: _tip, ...withoutTips } = kinds;

    expect(MixConfigSchema.safeParse({ ...mix, kinds: withoutTips }).success).toBe(false);
  });

  it('refuses a kind of Entry it does not know', () => {
    const parsed = MixConfigSchema.safeParse({ ...mix, kinds: { ...kinds, word: true } });

    expect(parsed.success).toBe(false);
  });

  it('refuses the kinds as fields of their own', () => {
    const parsed = MixConfigSchema.safeParse({
      categories: 'all',
      correctionCategories: 'all',
      corrections: true,
      idioms: true,
      synonymRows: true,
      tips: true,
    });

    expect(parsed.success).toBe(false);
  });
});
