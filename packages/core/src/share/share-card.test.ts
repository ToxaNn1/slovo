import { describe, expect, it } from 'vitest';

import type { SynonymRow, SynonymRowMember, Tip } from '@slovo/contracts';

import {
  buildSynonymRowCard,
  buildSynonymRowShareCard,
  buildTipCard,
  buildTipShareCard,
  createEntries,
} from '../index';
import { createMemoryContentPort } from '../testing';

/** Twelve members of «іти», each with its Stress. */
const TWELVE: readonly SynonymRowMember[] = [
  { text: 'простувати', stress: [7] },
  { text: 'чимчикувати', stress: [4] },
  { text: 'шкандибати', stress: [7] },
  { text: 'дибати', stress: [1] },
  { text: 'чалапати', stress: [3] },
  { text: 'чвалати', stress: [4] },
  { text: 'плентатися', stress: [3] },
  { text: 'тюпати', stress: [1] },
  { text: 'дріботіти', stress: [6] },
  { text: 'ступати', stress: [4] },
  { text: 'крокувати', stress: [6] },
  { text: 'мандрувати', stress: [7] },
];

/** A row of the first `count` members. */
function row(count: number): SynonymRow {
  return {
    kind: 'synonymRow',
    id: 'r_ity',
    dominant: { text: 'іти', stress: [2] },
    meaning: 'Рухатися пішки.',
    members: TWELVE.slice(0, count),
    example: { text: 'Простує він полем.' },
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

const shareCardOf = async (synonymRow: SynonymRow) =>
  buildSynonymRowShareCard(
    await buildSynonymRowCard({
      synonymRow,
      entries: createEntries({
        content: createMemoryContentPort({}),
        edition: { isFeatureEnabled: () => true },
      }),
    }),
  );

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

describe('the Share Card of a Synonym Row', () => {
  it('shows the dominant, the meaning and every member of a row of 5, with nothing more to mark', async () => {
    expect(await shareCardOf(row(5))).toEqual({
      kind: 'synonymRow',
      synonymRowId: 'r_ity',
      dominant: 'іти́',
      meaning: 'Рухатися пішки.',
      members: ['простува́ти', 'чимчи́кувати', 'шкандиба́ти', 'ди́бати', 'чала́пати'],
      moreMembers: false,
    });
  });

  it('shows the first 6 members of a row of 12, and marks that there are more', async () => {
    const card = await shareCardOf(row(12));

    expect(card.members).toEqual([
      'простува́ти',
      'чимчи́кувати',
      'шкандиба́ти',
      'ди́бати',
      'чала́пати',
      'чвала́ти',
    ]);
    expect(card.moreMembers).toBe(true);
  });

  it('marks nothing more for a row of exactly 6', async () => {
    const card = await shareCardOf(row(6));

    expect(card.members).toHaveLength(6);
    expect(card.moreMembers).toBe(false);
  });
});

describe('the Share Card of a Tip', () => {
  it('shows the title, the non-standard form and the standard form', () => {
    expect(buildTipShareCard(buildTipCard({ tip: tip() }))).toEqual({
      kind: 'tip',
      tipId: 't_kotrahodyna',
      title: 'Котра година?',
      nonStandardForm: 'Скільки час?',
      standardForm: 'Котра година?',
    });
  });

  it('shows no non-standard form for a Tip without one', () => {
    const card = buildTipShareCard(
      buildTipCard({
        tip: tip({ title: 'Звертання', nonStandardForm: undefined, standardForm: 'пане Андрію' }),
      }),
    );

    expect(card).toEqual({
      kind: 'tip',
      tipId: 't_kotrahodyna',
      title: 'Звертання',
      nonStandardForm: undefined,
      standardForm: 'пане Андрію',
    });
  });
});
