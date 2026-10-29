import { describe, expect, it } from 'vitest';

import type { SynonymRow, SynonymRowMember, Tip } from '@slovo/contracts';

import { notificationText } from './notification-text';

/** The Edition's words for notifications, as the shell passes them. */
const strings = { ellipsis: '…', tipStandardForm: 'Так: {form}' };

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
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

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

describe('the notification text of a Synonym Row', () => {
  it.each([5, 12])(
    'reads the dominant over its first 3 members and the ellipsis, in a row of %i',
    (count) => {
      expect(notificationText(row(count), strings)).toEqual({
        entryId: 'r_ity',
        title: 'іти́',
        body: 'простува́ти, чимчи́кувати, шкандиба́ти…',
      });
    },
  );

  it("ends the members with the Edition's ellipsis", () => {
    expect(notificationText(row(5), { ...strings, ellipsis: '...' }).body).toBe(
      'простува́ти, чимчи́кувати, шкандиба́ти...',
    );
  });
});

describe('the notification text of a Tip', () => {
  it('reads the title over the standard form in the Edition’s words', () => {
    expect(notificationText(tip(), strings)).toEqual({
      entryId: 't_kotrahodyna',
      title: 'Котра година?',
      body: 'Так: Котра година?',
    });
  });

  it('reads the same for a Tip without a non-standard form', () => {
    const text = notificationText(
      tip({ title: 'Звертання', nonStandardForm: undefined, standardForm: 'пане Андрію' }),
      strings,
    );

    expect(text).toEqual({
      entryId: 't_kotrahodyna',
      title: 'Звертання',
      body: 'Так: пане Андрію',
    });
  });

  it('cuts a long standard form at a word boundary to 80 characters, with the ellipsis', () => {
    const long = `${'дуже '.repeat(20)}довга форма`;

    const { body } = notificationText(tip({ standardForm: long }), strings);

    expect(Array.from(body)).toHaveLength(80);
    expect(body).toBe(`Так: ${'дуже '.repeat(14)}дуже…`);
  });
});
