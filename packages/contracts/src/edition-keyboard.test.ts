import { describe, expect, it } from 'vitest';

import { LanguageTraitsSchema } from './edition';

const traits = {
  stress: { marked: false },
  alphabet: 'а б в',
  sortLocale: 'uk',
};

/** Where the traits fail to parse, and why. */
function issuesOf(input: object) {
  return LanguageTraitsSchema.safeParse(input).error?.issues.map(({ path, message }) => [
    path.join('.'),
    message,
  ]);
}

describe('the keyboard of the language traits', () => {
  it('reads the rows of the keyboard', () => {
    const parsed = LanguageTraitsSchema.parse({ ...traits, keyboard: ['в а', 'б'] });

    expect(parsed.keyboard).toEqual([['в', 'а'], ['б']]);
  });

  it('reads letters apart however many spaces part them', () => {
    expect(LanguageTraitsSchema.parse({ ...traits, alphabet: ' а  б в ' }).alphabet).toEqual([
      'а',
      'б',
      'в',
    ]);
  });

  it('refuses a key that is not a letter of the alphabet, where it stands', () => {
    expect(issuesOf({ ...traits, keyboard: ['а б', 'в г'] })).toEqual([
      ['keyboard.1.1', '"г" is not a letter of the alphabet'],
    ]);
  });

  it('refuses a keyboard that leaves a letter out or holds it twice', () => {
    expect(issuesOf({ ...traits, keyboard: ['а б'] })).toEqual([
      ['keyboard', 'Expected "в" once on the keyboard, found 0'],
    ]);
    expect(issuesOf({ ...traits, keyboard: ['а б', 'в а'] })).toEqual([
      ['keyboard', 'Expected "а" once on the keyboard, found 2'],
    ]);
  });
});
