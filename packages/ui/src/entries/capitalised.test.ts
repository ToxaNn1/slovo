import { capitalised } from '@slovo/ui/capitalised';
import { describe, expect, it } from 'vitest';

describe('capitalised', () => {
  it('starts a text with a capital and leaves the rest as it is', () => {
    expect(capitalised('coffee with milk, not an iPhone')).toBe('Coffee with milk, not an iPhone');
  });

  it('capitalises the first letter after leading quotes, dashes and spaces', () => {
    expect(capitalised('«not the point»')).toBe('«Not the point»');
    expect(capitalised('— enough, — he says')).toBe('— Enough, — he says');
  });

  it('keeps a Stress mark on the first letter', () => {
    expect(capitalised('átlas')).toBe('Átlas');
    expect(capitalised('élan')).toBe('Élan');
  });

  it('uses the language given for the capital', () => {
    expect(capitalised('istanbul', 'tr')).toBe('İstanbul');
  });

  it('leaves a text with no letter, one that starts with a digit, or a capitalised one unchanged', () => {
    expect(capitalised('')).toBe('');
    expect(capitalised('1, 2 — …')).toBe('1, 2 — …');
    expect(capitalised('2 apples')).toBe('2 apples');
    expect(capitalised('Already')).toBe('Already');
  });
});
