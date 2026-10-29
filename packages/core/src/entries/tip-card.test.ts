import { describe, expect, it } from 'vitest';

import type { Tip } from '@slovo/contracts';

import { buildTipCard } from './tip-card';

/** A Tip with a non-standard form and no example; each test adds or drops what it needs. */
function tip(overrides: Partial<Tip> = {}): Tip {
  return {
    kind: 'tip',
    id: 't_kotrahodyna',
    title: 'Котра година?',
    nonStandardForm: 'Скільки час?',
    standardForm: 'Котра година?',
    explanation: 'Про час питають «котра година».',
    sources: [{ title: 'Test source' }],
    gameQuestion: {
      prompt: 'Як запитати про час?',
      rightAnswer: 'Котра година?',
      wrongAnswers: ['Скільки час?', 'Скільки годин?', 'Який час?'],
    },
    retired: false,
    ...overrides,
  };
}

describe('the Tip card', () => {
  it('shows the title, the non-standard form, the standard form, the explanation, the example and the sources', () => {
    const card = buildTipCard({
      tip: tip({
        example: { text: '— Котра година? — Пів на третю.', author: 'Test author' },
        sources: [{ title: 'Антоненко-Давидович' }, { title: 'Горох' }],
      }),
    });

    expect(card).toEqual({
      kind: 'tip',
      tipId: 't_kotrahodyna',
      title: 'Котра година?',
      nonStandardForm: 'Скільки час?',
      standardForm: 'Котра година?',
      explanation: 'Про час питають «котра година».',
      example: { text: '— Котра година? — Пів на третю.', author: 'Test author' },
      sourceTitles: ['Антоненко-Давидович', 'Горох'],
    });
  });

  it('shows only the right way for a Tip without a non-standard form, and leaves out a missing example', () => {
    const card = buildTipCard({
      tip: tip({
        id: 't_klychnyi',
        title: 'Кличний відмінок у звертанні',
        nonStandardForm: undefined,
        standardForm: 'пане Андрію',
        explanation: 'У звертанні ім’я стоїть у кличному відмінку.',
      }),
    });

    expect(card).toEqual({
      kind: 'tip',
      tipId: 't_klychnyi',
      title: 'Кличний відмінок у звертанні',
      nonStandardForm: undefined,
      standardForm: 'пане Андрію',
      explanation: 'У звертанні ім’я стоїть у кличному відмінку.',
      example: undefined,
      sourceTitles: ['Test source'],
    });
  });
});
