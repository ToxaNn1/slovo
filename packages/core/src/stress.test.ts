import { describe, expect, it } from 'vitest';

import { renderStress } from './index';

describe('renderStress', () => {
  it('puts a combining acute accent after the stressed vowel', () => {
    expect(renderStress({ lemma: 'мжичка', stress: [2] })).toBe('мжи́чка');
  });

  it('marks every valid Stress of a Lemma', () => {
    expect(renderStress({ lemma: 'завжди', stress: [5, 1] })).toBe('за́вжди́');
  });

  it('leaves a Lemma without Stress unchanged', () => {
    expect(renderStress({ lemma: 'word', stress: [] })).toBe('word');
  });
});
