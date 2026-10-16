import { stressLabel } from '@slovo/ui/stress-label';
import { describe, expect, it } from 'vitest';

const strings = { stress: 'stress on {vowels}', stressOr: 'or' };

describe('stressLabel', () => {
  it('reads the text alone when it has no stressed vowel', () => {
    expect(stressLabel(strings, 'lemma', [])).toBe('lemma');
  });

  it('names the stressed vowel after the text', () => {
    expect(stressLabel(strings, 'lemma', ['e'])).toBe('lemma, stress on e');
  });

  it('joins several valid stresses with the Edition’s "or"', () => {
    expect(stressLabel(strings, 'lemma', ['e', 'a'])).toBe('lemma, stress on e or a');
  });
});
