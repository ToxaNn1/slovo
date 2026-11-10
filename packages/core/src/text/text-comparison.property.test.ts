import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createTextComparison, type ComparisonPurpose } from './text-comparison';
import { STRESS_MARK } from '../entries/stress';

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261110, numRuns: 200 };

const APOSTROPHES = ['ʼ', "'", '’'];

/** The UA Edition's Language Traits and Search letters. */
const comparison = createTextComparison({
  languageTraits: { apostrophes: APOSTROPHES, sortLocale: 'uk' },
  searchLetters: { ґ: 'г', ё: 'е' },
});

const PURPOSES: readonly ComparisonPurpose[] = ['typedAnswer', 'searchQuery', 'definition'];

const LETTERS = Array.from('абвгґдеєжзиіїйклмнопрстуфхцчшщьюяё');

/** A text of letters, apostrophes and spaces, in either case. */
const text = fc
  .array(
    fc.oneof(
      { weight: 8, arbitrary: fc.constantFrom(...LETTERS) },
      { weight: 2, arbitrary: fc.constantFrom(...LETTERS).map((letter) => letter.toUpperCase()) },
      { weight: 1, arbitrary: fc.constantFrom(...APOSTROPHES) },
      { weight: 1, arbitrary: fc.constantFrom(' ', '  ', '\n') },
    ),
    { maxLength: 20 },
  )
  .map((characters) => characters.join(''));

const purpose = fc.constantFrom(...PURPOSES);

describe('the Comparison Key', () => {
  it('is its own Comparison Key', () => {
    fc.assert(
      fc.property(text, purpose, (typed, kept) => {
        const key = comparison.key(typed, kept);
        expect(comparison.key(key, kept)).toBe(key);
      }),
      runs,
    );
  });

  it('ignores case', () => {
    fc.assert(
      fc.property(text, purpose, (typed, kept) => {
        expect(comparison.key(typed.toLocaleUpperCase('uk'), kept)).toBe(
          comparison.key(typed.toLocaleLowerCase('uk'), kept),
        );
      }),
      runs,
    );
  });

  it('ignores a Stress mark after any letter', () => {
    fc.assert(
      fc.property(text, fc.nat(), purpose, (typed, at, kept) => {
        const letters = Array.from(typed);
        const place = letters.length === 0 ? 0 : at % letters.length;
        const stressed = [...letters.slice(0, place + 1), STRESS_MARK, ...letters.slice(place + 1)];
        expect(comparison.key(stressed.join(''), kept)).toBe(comparison.key(typed, kept));
      }),
      runs,
    );
  });

  it.each(APOSTROPHES)('reads %s as every other apostrophe', (apostrophe) => {
    fc.assert(
      fc.property(text, purpose, (typed, kept) => {
        const asThis = Array.from(typed, (character) =>
          APOSTROPHES.includes(character) ? apostrophe : character,
        ).join('');
        expect(comparison.key(asThis, kept)).toBe(comparison.key(typed, kept));
      }),
      runs,
    );
  });

  it('ignores spaces at the ends', () => {
    fc.assert(
      fc.property(text, fc.constantFrom(' ', '\n', '\t '), purpose, (typed, space, kept) => {
        expect(comparison.key(`${space}${typed}${space}`, kept)).toBe(comparison.key(typed, kept));
      }),
      runs,
    );
  });

  it('keeps a space between two words in every purpose', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LETTERS),
        fc.constantFrom(...LETTERS),
        purpose,
        (first, second, kept) => {
          expect(comparison.same(`${first} ${second}`, `${first}${second}`, kept)).toBe(false);
        },
      ),
      runs,
    );
  });

  it('reads spaces between words as one only in a Definition', () => {
    fc.assert(
      fc.property(text, text, fc.constantFrom('  ', '\n', ' \t '), (first, second, spaces) => {
        const words = [first, second].map((part) => part.trim()).filter((part) => part !== '');
        const spaced = words.join(spaces);
        const once = words.join(' ');
        expect(comparison.key(spaced, 'definition')).toBe(comparison.key(once, 'definition'));
      }),
      runs,
    );
  });
});
