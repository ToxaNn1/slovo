import { describe, expect, it } from 'vitest';

import { LanguageTraitsSchema } from './edition';

const traits = {
  marksStress: false,
  alphabet: 'а б в',
  sortLocale: 'uk',
  distractorRule: 'same-part-of-speech',
};

describe('the keyboard of the language traits', () => {
  it('reads the rows of the keyboard', () => {
    const parsed = LanguageTraitsSchema.parse({ ...traits, keyboard: ['в а', 'б'] });

    expect(parsed.keyboard).toEqual([['в', 'а'], ['б']]);
  });

  it('refuses a key that is not a letter of the alphabet', () => {
    expect(LanguageTraitsSchema.safeParse({ ...traits, keyboard: ['а б', 'в г'] }).success).toBe(
      false,
    );
  });

  it('refuses a keyboard that leaves a letter out or holds it twice', () => {
    expect(LanguageTraitsSchema.safeParse({ ...traits, keyboard: ['а б'] }).success).toBe(false);
    expect(LanguageTraitsSchema.safeParse({ ...traits, keyboard: ['а б', 'в а'] }).success).toBe(
      false,
    );
  });
});
