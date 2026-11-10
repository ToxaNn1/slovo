import { describe, expect, it } from 'vitest';

import { LanguageTraitsSchema } from './edition';

const traits = { alphabet: 'а б в', sortLocale: 'uk' };

describe('the Stress of the language traits', () => {
  it('reads a language that marks no Stress', () => {
    const parsed = LanguageTraitsSchema.parse({ ...traits, stress: { marked: false } });

    expect(parsed.stress).toEqual({ marked: false });
  });

  it('reads a language that marks Stress with its vowels', () => {
    const parsed = LanguageTraitsSchema.parse({
      ...traits,
      stress: { marked: true, vowels: 'а' },
    });

    expect(parsed.stress).toEqual({ marked: true, vowels: ['а'] });
  });

  it('refuses Stress without vowels', () => {
    const marked = LanguageTraitsSchema.safeParse({ ...traits, stress: { marked: true } });
    const empty = LanguageTraitsSchema.safeParse({
      ...traits,
      stress: { marked: true, vowels: '' },
    });

    expect(marked.success).toBe(false);
    expect(empty.success).toBe(false);
  });

  it('refuses vowels of a language that marks no Stress', () => {
    const parsed = LanguageTraitsSchema.safeParse({
      ...traits,
      stress: { marked: false, vowels: 'а' },
    });

    expect(parsed.success).toBe(false);
  });

  it('refuses a vowel that is not a letter of the alphabet', () => {
    const parsed = LanguageTraitsSchema.safeParse({
      ...traits,
      stress: { marked: true, vowels: 'а е' },
    });

    expect(parsed.error?.issues.map(({ path }) => path.join('.'))).toEqual(['stress.vowels.1']);
  });

  it('refuses a Distractor rule', () => {
    const stress = { marked: false };

    expect(LanguageTraitsSchema.safeParse({ ...traits, stress }).success).toBe(true);
    expect(
      LanguageTraitsSchema.safeParse({ ...traits, stress, distractorRule: 'same-part-of-speech' })
        .success,
    ).toBe(false);
  });
});
