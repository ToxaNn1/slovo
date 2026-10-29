import { describe, expect, it } from 'vitest';

import type { Tip } from '@slovo/contracts';

import { selfCheckSynonymRowCard, selfCheckTipCard, type SynonymRowCardModel } from '../index';
import { buildTipCard } from './tip-card';

const rowCard: SynonymRowCardModel = {
  kind: 'synonymRow',
  synonymRowId: 'r_ity',
  dominant: { text: 'іти́', stressedVowels: ['и'], wordId: 'w_ity' },
  meaning: 'Рухатися пішки.',
  members: [
    { text: 'простува́ти', stressedVowels: ['а'], wordId: undefined, shadeNote: undefined },
    {
      text: 'шкандиба́ти',
      stressedVowels: ['а'],
      wordId: undefined,
      shadeNote: 'кульгаючи',
    },
  ],
  example: { text: 'Простує він полем.', author: 'Test author' },
  sourceTitles: ['Словник синонімів'],
};

/** A Tip with a non-standard form; each test drops what it needs. */
function tip(overrides: Partial<Tip> = {}): Tip {
  return {
    kind: 'tip',
    id: 't_kotrahodyna',
    title: 'Котра година?',
    nonStandardForm: 'Скільки час?',
    standardForm: 'Котра година?',
    explanation: 'Про час питають «котра година».',
    example: { text: '— Котра година? — Пів на третю.', author: 'Test author' },
    sources: [{ title: 'Антоненко-Давидович' }],
    gameQuestion: {
      prompt: 'Як запитати про час?',
      rightAnswer: 'Котра година?',
      wrongAnswers: ['Скільки час?', 'Скільки годин?', 'Який час?'],
    },
    retired: false,
    ...overrides,
  };
}

describe('Self-check on a Synonym Row card', () => {
  it('shows only the dominant until the reveal, with the mark buttons inactive', () => {
    expect(selfCheckSynonymRowCard({ card: rowCard, concealed: true })).toEqual({
      concealed: true,
      marksActive: false,
      card: {
        kind: 'synonymRow',
        synonymRowId: 'r_ity',
        dominant: { text: 'іти́', stressedVowels: ['и'], wordId: 'w_ity' },
      },
    });
  });

  it('shows the whole row once revealed, with the mark buttons working', () => {
    expect(selfCheckSynonymRowCard({ card: rowCard, concealed: false })).toEqual({
      concealed: false,
      marksActive: true,
      card: rowCard,
    });
  });
});

describe('Self-check on a Tip card', () => {
  it('shows only the title and the non-standard form until the reveal, with the mark buttons inactive', () => {
    expect(selfCheckTipCard({ card: buildTipCard({ tip: tip() }), concealed: true })).toEqual({
      concealed: true,
      marksActive: false,
      card: {
        kind: 'tip',
        tipId: 't_kotrahodyna',
        title: 'Котра година?',
        nonStandardForm: 'Скільки час?',
      },
    });
  });

  it('shows only the title of a Tip without a non-standard form until the reveal', () => {
    const card = buildTipCard({
      tip: tip({ id: 't_klychnyi', title: 'Кличний відмінок', nonStandardForm: undefined }),
    });

    expect(selfCheckTipCard({ card, concealed: true })).toEqual({
      concealed: true,
      marksActive: false,
      card: {
        kind: 'tip',
        tipId: 't_klychnyi',
        title: 'Кличний відмінок',
        nonStandardForm: undefined,
      },
    });
  });

  it('shows the whole Tip once revealed, with or without a non-standard form, with the mark buttons working', () => {
    for (const card of [
      buildTipCard({ tip: tip() }),
      buildTipCard({ tip: tip({ nonStandardForm: undefined }) }),
    ]) {
      expect(selfCheckTipCard({ card, concealed: false })).toEqual({
        concealed: false,
        marksActive: true,
        card,
      });
    }
  });
});
