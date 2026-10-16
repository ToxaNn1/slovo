import { describe, expect, it } from 'vitest';

import { renderStress } from '../index';

describe('renderStress', () => {
  it('puts a combining acute accent after the stressed vowel', () => {
    expect(renderStress({ lemma: 'drizzle', stress: [2] })).toBe('dri\u0301zzle');
  });

  it('marks every valid Stress of a Lemma', () => {
    expect(renderStress({ lemma: 'always', stress: [3, 0] })).toBe('a\u0301lwa\u0301ys');
  });

  it('leaves a Lemma without Stress unchanged', () => {
    expect(renderStress({ lemma: 'word', stress: [] })).toBe('word');
  });
});
