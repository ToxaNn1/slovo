import { describe, expect, it } from 'vitest';

import { WordOutputSchema, WordSchema } from './word';

const noun = {
  id: 'w_1',
  lemma: 'олія',
  partOfSpeech: 'noun',
  gender: 'feminine',
  primaryDefinition: 'Жир.',
  categoryId: 'c',
  rarity: 3,
  sources: [{ title: 'СУМ' }],
};

const { gender: _gender, ...verb } = { ...noun, lemma: 'байдикувати', partOfSpeech: 'verb' };

/** Where a Word fails to parse, and why; none when it parses. */
function issuesOf(word: object, schema: typeof WordSchema | typeof WordOutputSchema = WordSchema) {
  return schema.safeParse(word).error?.issues.map(({ path, message }) => [path.join('.'), message]);
}

describe('a Word', () => {
  it('takes a noun with its gender and a word of another part of speech without one', () => {
    expect(issuesOf(noun)).toBeUndefined();
    expect(issuesOf(verb)).toBeUndefined();
  });

  it('refuses a noun without a gender and another part of speech with one', () => {
    expect(issuesOf({ ...noun, gender: undefined })).toEqual([['gender', 'Required for a noun']]);
    expect(issuesOf({ ...verb, gender: 'masculine' })).toEqual([
      ['gender', 'Only nouns carry a gender'],
    ]);
  });

  it('takes a region on a dialect Word alone', () => {
    expect(issuesOf({ ...noun, registers: ['dialectal'], region: 'Гуцульщина' })).toBeUndefined();
    expect(issuesOf({ ...noun, registers: ['archaic'], region: 'Гуцульщина' })).toEqual([
      ['region', 'Only a dialect Word, with the dialectal register label, carries a region'],
    ]);
  });

  it('refuses a Lemma that is not in Unicode NFC', () => {
    expect(issuesOf({ ...noun, lemma: 'ї'.normalize('NFD') })).toEqual([
      ['lemma', 'Expected the Lemma in Unicode NFC, with every letter composed'],
    ]);
  });

  it('holds its rules as an output too', () => {
    expect(issuesOf({ ...noun, gender: undefined }, WordOutputSchema)).toEqual([
      ['gender', 'Required for a noun'],
    ]);
  });

  it('takes a Short Definition and reads a Word without one as before', () => {
    const short = 'Той, хто пасе худобу.';
    expect(WordSchema.parse({ ...noun, shortDefinition: short }).shortDefinition).toBe(short);
    expect(WordOutputSchema.parse({ ...noun, shortDefinition: short }).shortDefinition).toBe(short);
    expect('shortDefinition' in WordSchema.parse(noun)).toBe(false);
    expect(issuesOf({ ...noun, shortDefinition: ' ' })?.map(([path]) => path)).toEqual([
      'shortDefinition',
    ]);
  });

  it('reads as an output a Word with a field a later build adds, as the build before the Short Definition reads one with it', () => {
    const later = { ...noun, fieldOfALaterBuild: 'Той, хто пасе худобу.' };
    expect(issuesOf(later, WordOutputSchema)).toBeUndefined();
    expect(issuesOf(later)?.map(([path]) => path)).toEqual(['']);
    expect(WordOutputSchema.parse(later)).toMatchObject({
      primaryDefinition: noun.primaryDefinition,
    });
  });
});
