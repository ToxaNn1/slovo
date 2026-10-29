import { describe, expect, it } from 'vitest';

import type { SynonymRow, SynonymRowMember, Tip } from '@slovo/contracts';

import {
  buildSynonymRowShareCard,
  buildTipShareCard,
  buildWeeklyRecapShareCard,
  createEntries,
  type WeeklyRecapModel,
} from '../index';
import { buildSynonymRowCard } from '../entries/synonym-row-card';
import { buildTipCard } from '../entries/tip-card';
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

/** The Ukrainian Edition's texts of the Weekly Recap's Share Card. */
const WEEK_STRINGS = {
  title: 'Мій тиждень у SLOVO',
  week: '{from}–{to} {month}',
  weekAcrossMonths: '{from} {fromMonth} – {to} {toMonth}',
  months: [
    'січня',
    'лютого',
    'березня',
    'квітня',
    'травня',
    'червня',
    'липня',
    'серпня',
    'вересня',
    'жовтня',
    'листопада',
    'грудня',
  ],
  seen: 'переглянуто',
  saved: 'збережено',
  known: 'знаю',
  streak: 'серія',
};

/** The numbers of the week of Monday 20 to Sunday 26 October 2025. */
const RECAP: WeeklyRecapModel = {
  firstDay: { year: 2025, month: 10, day: 20 },
  lastDay: { year: 2025, month: 10, day: 26 },
  seen: 34,
  saved: 5,
  known: 12,
  streak: 9,
};

describe('the Share Card of a Weekly Recap', () => {
  it('shows the title, the week and the four numbers in order, with no words', () => {
    expect(buildWeeklyRecapShareCard(RECAP, WEEK_STRINGS)).toEqual({
      kind: 'weeklyRecap',
      title: 'Мій тиждень у SLOVO',
      week: '20–26 жовтня',
      numbers: [
        { label: 'переглянуто', count: 34 },
        { label: 'збережено', count: 5 },
        { label: 'знаю', count: 12 },
        { label: 'серія', count: 9 },
      ],
    });
  });

  it('names both months of a week across two months', () => {
    const card = buildWeeklyRecapShareCard(
      {
        ...RECAP,
        firstDay: { year: 2025, month: 10, day: 27 },
        lastDay: { year: 2025, month: 11, day: 2 },
      },
      WEEK_STRINGS,
    );

    expect(card.week).toBe('27 жовтня – 2 листопада');
  });

  it('leaves «знаю» out when the recap has no Known marks, as with the Knowledge Marks off', () => {
    const { known: _known, ...withoutKnown } = RECAP;

    expect(buildWeeklyRecapShareCard(withoutKnown, WEEK_STRINGS).numbers).toEqual([
      { label: 'переглянуто', count: 34 },
      { label: 'збережено', count: 5 },
      { label: 'серія', count: 9 },
    ]);
  });

  it('leaves «серія» out while the reader hides the Streak', () => {
    expect(buildWeeklyRecapShareCard(RECAP, WEEK_STRINGS, true).numbers).toEqual([
      { label: 'переглянуто', count: 34 },
      { label: 'збережено', count: 5 },
      { label: 'знаю', count: 12 },
    ]);
  });

  it('shows a 0 as a number', () => {
    const card = buildWeeklyRecapShareCard({ ...RECAP, saved: 0, known: 0 }, WEEK_STRINGS);

    expect(card.numbers.map(({ count }) => count)).toEqual([34, 0, 0, 9]);
  });
});
