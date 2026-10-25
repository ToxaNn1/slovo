import { describe, expect, it } from 'vitest';

import type { Correction } from '@slovo/contracts';

import { buildCorrectionCard } from '../index';

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
    retired: false,
    ...overrides,
  };
}

describe('the Correction card', () => {
  it('shows the non-standard form, the main equivalent, the Correction Type, the explanation and the example pair', () => {
    expect(buildCorrectionCard(correction())).toEqual({
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
      sourceTitles: ['Test source'],
    });
  });

  it('names its sources by their titles, in their order', () => {
    const card = buildCorrectionCard(
      correction({
        sources: [
          { title: 'За СУМ-20', url: 'https://example.com' },
          { title: 'Антоненко-Давидович' },
        ],
      }),
    );

    expect(card.sourceTitles).toEqual(['За СУМ-20', 'Антоненко-Давидович']);
  });

  it('puts the first standard equivalent first and the others after it, in their order', () => {
    const card = buildCorrectionCard(
      correction({ standardEquivalents: ['протягом року', 'упродовж року', 'цілий рік'] }),
    );

    expect(card.mainEquivalent).toBe('протягом року');
    expect(card.otherEquivalents).toEqual(['упродовж року', 'цілий рік']);
  });
});
