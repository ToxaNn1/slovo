import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import { buildWordCard, createEntries, createMemoryContentPort } from '../index';

/** A Word with only what every Word has; each test adds what it needs. */
function word(overrides: Partial<Word> = {}): Word {
  return {
    kind: 'word',
    id: 'w_veremija',
    lemma: 'веремія',
    stress: [5],
    partOfSpeech: 'noun',
    gender: 'feminine',
    primaryDefinition: 'Метушня, безлад.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'household-crafts',
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
    ...overrides,
  };
}

function correction(id: string, nonStandardForm: string, retired = false): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm,
    correctionType: 'russianism',
    standardEquivalents: ['протягом'],
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    sources: [{ title: 'Test source' }],
    retired,
  };
}

const build = (from: Word, corrections: readonly Correction[] = []) =>
  buildWordCard({
    word: from,
    entries: createEntries({
      content: createMemoryContentPort({
        categories: [{ id: 'household-crafts', displayName: 'Побут і ремесла' }],
        corrections,
      }),
      edition: { isFeatureEnabled: () => true },
    }),
  });

describe('the Word card', () => {
  it('shows the Lemma with Stress, the part of speech, gender, primary Definition and Category, named by the Language Pack, of a bare Word, and no other section', async () => {
    expect(await build(word())).toEqual({
      kind: 'word',
      wordId: 'w_veremija',
      lemma: 'веремі́я',
      stressedVowels: ['і'],
      partOfSpeech: 'noun',
      gender: 'feminine',
      primaryDefinition: 'Метушня, безлад.',
      example: undefined,
      synonyms: [],
      antonyms: [],
      registers: [],
      categoryId: 'household-crafts',
      categoryName: 'Побут і ремесла',
      details: undefined,
      linkedCorrections: [],
    });
  });

  it('names no Category the Language Pack does not have', async () => {
    expect((await build(word({ categoryId: 'gone' }))).categoryName).toBeUndefined();
  });

  it('shows the first Example with its author when the source names one', async () => {
    const card = await build(
      word({
        examples: [
          { text: 'На ярмарку зчинилася така веремія.', author: 'Панас Мирний' },
          { text: 'Друга веремія.' },
        ],
      }),
    );

    expect(card.example).toEqual({
      text: 'На ярмарку зчинилася така веремія.',
      author: 'Панас Мирний',
    });
  });

  it('shows the first Example without an author line when the source names none', async () => {
    const card = await build(word({ examples: [{ text: 'Така веремія.' }] }));

    expect(card.example).toEqual({ text: 'Така веремія.' });
    expect(card.example).not.toHaveProperty('author');
  });

  it('shows at most the first 3 Synonyms', async () => {
    const card = await build(
      word({ synonyms: ['колотнеча', 'гармидер', 'катавасія', 'тарарам', 'шарварок'] }),
    );

    expect(card.synonyms).toEqual(['колотнеча', 'гармидер', 'катавасія']);
  });

  it('shows every Synonym when there are fewer than 3', async () => {
    const card = await build(word({ synonyms: ['колотнеча'] }));

    expect(card.synonyms).toEqual(['колотнеча']);
  });

  it('shows every antonym and register key', async () => {
    const card = await build(
      word({
        partOfSpeech: 'adverb',
        gender: undefined,
        antonyms: ['одесну'],
        registers: ['archaic', 'dialectal'],
      }),
    );

    expect(card).toMatchObject({
      partOfSpeech: 'adverb',
      gender: undefined,
      antonyms: ['одесну'],
      registers: ['archaic', 'dialectal'],
    });
  });

  it('marks both Stresses of a Lemma with two valid Stresses', async () => {
    const card = await build(
      word({ lemma: 'завжди', stress: [1, 5], partOfSpeech: 'adverb', gender: undefined }),
    );

    // за́вжди and завжди́, written with U+0301 after each stressed vowel.
    expect(card.lemma).toBe('за\u0301вжди\u0301');
  });

  it('names the stressed vowels, so VoiceOver can say where the Stress falls', async () => {
    expect((await build(word())).stressedVowels).toEqual(['і']);
    expect(
      (
        await build(
          word({ lemma: 'завжди', stress: [1, 5], partOfSpeech: 'adverb', gender: undefined }),
        )
      ).stressedVowels,
    ).toEqual(['а', 'и']);
  });

  describe('linked Corrections', () => {
    it('list each live Correction the Word is the standard form for, in the order the Word links them', async () => {
      const card = await build(word({ correctionIds: ['c_naprotjazi', 'c_vprodovzh'] }), [
        correction('c_vprodovzh', 'в продовж'),
        correction('c_naprotjazi', 'на протязі'),
      ]);

      expect(card.linkedCorrections).toEqual([
        { correctionId: 'c_naprotjazi', nonStandardForm: 'на протязі' },
        { correctionId: 'c_vprodovzh', nonStandardForm: 'в продовж' },
      ]);
    });

    it('leave out a Retired Correction and one the Language Pack lacks', async () => {
      const card = await build(word({ correctionIds: ['c_retired', 'c_missing', 'c_live'] }), [
        correction('c_retired', 'старе', true),
        correction('c_live', 'на протязі'),
      ]);

      expect(card.linkedCorrections).toEqual([
        { correctionId: 'c_live', nonStandardForm: 'на протязі' },
      ]);
    });
  });

  describe('details', () => {
    it('are left out when the Word has one Example and no etymology or extra Definitions', async () => {
      const card = await build(word({ examples: [{ text: 'Така веремія.' }] }));

      expect(card.details).toBeUndefined();
    });

    it('hold the etymology alone when that is all the Word has beyond the card', async () => {
      const card = await build(word({ etymology: 'Від дієслова *vьrěti.' }));

      expect(card.details).toEqual({
        etymology: 'Від дієслова *vьrěti.',
        extraDefinitions: [],
        examples: [],
      });
    });

    it('hold the extra Definitions alone', async () => {
      const card = await build(word({ extraDefinitions: ['Гамір.', 'Сварка.'] }));

      expect(card.details).toEqual({
        etymology: undefined,
        extraDefinitions: ['Гамір.', 'Сварка.'],
        examples: [],
      });
    });

    it('hold the Examples after the first one', async () => {
      const card = await build(
        word({
          examples: [
            { text: 'Перша веремія.' },
            { text: 'Друга веремія.', author: 'Леся Українка' },
            { text: 'Третя веремія.' },
          ],
        }),
      );

      expect(card.example).toEqual({ text: 'Перша веремія.' });
      expect(card.details).toEqual({
        etymology: undefined,
        extraDefinitions: [],
        examples: [{ text: 'Друга веремія.', author: 'Леся Українка' }, { text: 'Третя веремія.' }],
      });
    });
  });
});
