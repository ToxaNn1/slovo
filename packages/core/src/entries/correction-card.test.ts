import { describe, expect, it } from 'vitest';

import type { Correction } from '@slovo/contracts';

import { buildCorrectionCard, createEntries } from '../index';
import { createMemoryContentPort } from '../testing';

/** A Correction with one standard equivalent; each test adds what it needs. */
function correction(overrides: Partial<Correction> = {}): Correction {
  return {
    kind: 'correction',
    id: 'c_protiazi',
    nonStandardForm: 'на протязі року',
    correctionType: 'russianism',
    standardEquivalents: ['протягом року'],
    explanation: 'Протяг — це рух повітря.',
    examplePair: {
      nonStandard: 'Ремонт тривав на протязі року.',
      standard: 'Ремонт тривав протягом року.',
    },
    categoryId: 'everyday',
    sources: [{ title: 'Test source' }],
    literaryUses: [],
    retired: false,
    ...overrides,
  };
}

const build = (from: Correction) =>
  buildCorrectionCard({
    correction: from,
    entries: createEntries({
      content: createMemoryContentPort({
        correctionCategories: [{ id: 'everyday', displayName: 'Побут' }],
      }),
      edition: { isFeatureEnabled: () => true },
    }),
  });

describe('the Correction card', () => {
  it('shows the non-standard form, the main equivalent, the Correction Type, the Category, named by the Language Pack, the explanation and the example pair', async () => {
    expect(await build(correction())).toEqual({
      kind: 'correction',
      correctionId: 'c_protiazi',
      nonStandardForm: 'на протязі року',
      nonStandardStressedVowels: [],
      mainEquivalent: 'протягом року',
      mainEquivalentStressedVowels: [],
      otherEquivalents: [],
      correctionType: 'russianism',
      explanation: 'Протяг — це рух повітря.',
      examplePair: {
        nonStandard: 'Ремонт тривав на протязі року.',
        standard: 'Ремонт тривав протягом року.',
      },
      categoryId: 'everyday',
      categoryName: 'Побут',
      sourceTitles: ['Test source'],
      literaryUses: [],
    });
  });

  it('names no Category the Language Pack does not have', async () => {
    expect((await build(correction({ categoryId: 'gone' }))).categoryName).toBeUndefined();
  });

  it('names its sources by their titles, in their order', async () => {
    const card = await build(
      correction({
        sources: [
          { title: 'За СУМ-20', url: 'https://example.com' },
          { title: 'Антоненко-Давидович' },
        ],
      }),
    );

    expect(card.sourceTitles).toEqual(['За СУМ-20', 'Антоненко-Давидович']);
  });

  it('puts the first standard equivalent first and the others after it, in their order', async () => {
    const card = await build(
      correction({ standardEquivalents: ['протягом року', 'упродовж року', 'цілий рік'] }),
    );

    expect(card.mainEquivalent).toBe('протягом року');
    expect(card.otherEquivalents).toEqual(['упродовж року', 'цілий рік']);
  });

  it('carries the literary uses of the standard form, in their order, each with its author and work', async () => {
    const literaryUses = [
      {
        text: 'Протягом року він писав щодня.',
        author: 'Test Author',
        work: 'Test Work',
        authorDeathYear: 1900,
        workYear: 1890,
        url: 'https://example.com/work',
      },
      {
        text: 'Протягом року нічого не змінилось.',
        author: 'Second Author',
        work: 'Second Work',
        authorDeathYear: 1910,
      },
    ];

    expect((await build(correction({ literaryUses }))).literaryUses).toEqual(literaryUses);
  });
});
