import { describe, expect, it } from 'vitest';

import type { Correction, SynonymRow, Word } from '@slovo/contracts';

import { buildWordCard, createEntries } from '../index';
import { createMemoryContentPort } from '../testing';

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
    categoryId: 'everyday',
    sources: [{ title: 'Test source' }],
    literaryUses: [],
    retired,
  };
}

/** A Synonym Row of five plain members, with `members` put first; each test adds what it needs. */
function synonymRow(
  id: string,
  members: readonly { text: string; wordId?: string }[],
  overrides: Partial<SynonymRow> = {},
): SynonymRow {
  return {
    kind: 'synonymRow',
    id,
    dominant: { text: 'безлад', stress: [4] },
    meaning: 'Відсутність порядку.',
    members: [...members, 'гармидер', 'кавардак', 'розгардіяш', 'шарварок']
      .slice(0, 5)
      .map((member) =>
        typeof member === 'string' ? { text: member, stress: [0] } : { stress: [0], ...member },
      ),
    sources: [{ title: 'Test source' }],
    retired: false,
    ...overrides,
  };
}

const build = (
  from: Word,
  corrections: readonly Correction[] = [],
  {
    words = [],
    synonymRows = [],
    synonymRowsOn = true,
    illustrations = [],
    illustrationsOn = true,
  }: {
    words?: readonly Word[];
    synonymRows?: readonly SynonymRow[];
    synonymRowsOn?: boolean;
    illustrations?: readonly string[];
    illustrationsOn?: boolean;
  } = {},
) =>
  buildWordCard({
    word: from,
    entries: createEntries({
      content: createMemoryContentPort({
        categories: [{ id: 'household-crafts', displayName: 'Побут і ремесла' }],
        words: [from, ...words],
        corrections,
        synonymRows,
      }),
      edition: {
        isFeatureEnabled: (feature) =>
          (feature !== 'synonymRows' || synonymRowsOn) &&
          (feature !== 'illustrations' || illustrationsOn),
        illustrations: new Set(illustrations),
      },
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
      region: undefined,
      history: undefined,
      categoryId: 'household-crafts',
      categoryName: 'Побут і ремесла',
      details: undefined,
      linkedCorrections: [],
      synonymRow: undefined,
      illustration: undefined,
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

  describe('the Synonym Row back-link', () => {
    const member = { text: 'веремія', wordId: 'w_veremija' };

    it('carries the first live row that links the Word as a member, with its dominant linked as members are', async () => {
      const card = await build(word(), [], {
        words: [word({ id: 'w_bezlad', lemma: 'безлад' })],
        synonymRows: [
          synonymRow('r_retired', [member], { retired: true }),
          synonymRow('r_bezlad', [member], {
            dominant: { text: 'безлад', stress: [4], wordId: 'w_bezlad' },
          }),
          synonymRow('r_kolotnecha', [member], { dominant: { text: 'колотнеча', stress: [6] } }),
        ],
      });

      expect(card.synonymRow).toEqual({
        synonymRowId: 'r_bezlad',
        dominant: { text: 'безла́д', stressedVowels: ['а'], wordId: 'w_bezlad' },
      });
    });

    it('leaves the dominant as plain text when its Word is Retired or not in the Language Pack', async () => {
      const card = await build(word(), [], {
        words: [word({ id: 'w_bezlad', lemma: 'безлад', retired: true })],
        synonymRows: [
          synonymRow('r_bezlad', [member], {
            dominant: { text: 'безлад', stress: [4], wordId: 'w_bezlad' },
          }),
        ],
      });

      expect(card.synonymRow?.dominant.wordId).toBeUndefined();
    });

    it('carries nothing for a Word in no row, the dominant of a row or a member as plain text', async () => {
      const card = await build(word(), [], {
        synonymRows: [
          synonymRow('r_dominant', [], {
            dominant: { text: 'веремія', stress: [5], wordId: 'w_veremija' },
          }),
          synonymRow('r_plain', [{ text: 'веремія' }]),
        ],
      });

      expect(card.synonymRow).toBeUndefined();
    });

    it('carries nothing when only a Retired row links the Word', async () => {
      const card = await build(word(), [], {
        synonymRows: [synonymRow('r_retired', [member], { retired: true })],
      });

      expect(card.synonymRow).toBeUndefined();
    });

    it('carries nothing for a Retired Word, which no row links', async () => {
      const card = await build(word({ retired: true }), [], {
        synonymRows: [synonymRow('r_bezlad', [member])],
      });

      expect(card.synonymRow).toBeUndefined();
    });

    it('carries nothing while the Edition turns Synonym Rows off', async () => {
      const card = await build(word(), [], {
        synonymRows: [synonymRow('r_bezlad', [member])],
        synonymRowsOn: false,
      });

      expect(card.synonymRow).toBeUndefined();
    });
  });

  it('carries the history of a Word that has one', async () => {
    const card = await build(word({ history: 'Слово вилучили зі словників 1933 року.' }));

    expect(card.history).toBe('Слово вилучили зі словників 1933 року.');
    expect(card.details).toBeUndefined();
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

  describe('its Illustration', () => {
    const illustrated = word({ illustration: 'veremija.png' });

    it('is the file the Word names when the app bundles it', async () => {
      expect((await build(illustrated, [], { illustrations: ['veremija.png'] })).illustration).toBe(
        'veremija.png',
      );
    });

    it('is none when a content update names a file the app does not bundle', async () => {
      expect(
        (await build(illustrated, [], { illustrations: ['other.png'] })).illustration,
      ).toBeUndefined();
    });

    it('is none while the illustrations Feature Switch is off', async () => {
      expect(
        (await build(illustrated, [], { illustrations: ['veremija.png'], illustrationsOn: false }))
          .illustration,
      ).toBeUndefined();
    });

    it('is none for a Word without an Illustration', async () => {
      expect(
        (await build(word(), [], { illustrations: ['veremija.png'] })).illustration,
      ).toBeUndefined();
    });
  });
});
