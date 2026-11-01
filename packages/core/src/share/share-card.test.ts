import { describe, expect, it } from 'vitest';

import type { Correction, Idiom, SynonymRow, SynonymRowMember, Tip, Word } from '@slovo/contracts';

import {
  buildCorrectionCard,
  buildShareCardContent,
  buildWordCard,
  createEntries,
  type AnyEntryCard,
  type ShareCardStrings,
  type WeeklyRecapModel,
} from '../index';
import { buildIdiomCard } from '../entries/idiom-card';
import { buildSynonymRowCard } from '../entries/synonym-row-card';
import { buildTipCard } from '../entries/tip-card';
import { correction, fakeClock, idiom, synonymRow, tip, word } from '../test-support';
import { createMemoryContentPort } from '../testing';

/** The texts of the UA Edition a Share Card reads. */
const STRINGS = {
  share: {
    wordOfTheDay: 'Слово дня',
    nonStandard: 'Так часто кажуть',
    standard: 'Українською краще',
    weeklyRecap: {
      title: 'Мій тиждень у SLOVO',
      week: '{from}–{to} {month}',
      weekAcrossMonths: '{from} {fromMonth} – {to} {toMonth}',
    },
    day: '{day} {month}',
    level: { title: 'Новий рівень у SLOVO', headline: 'Рівень {level}' },
    badge: { title: 'Нова відзнака в SLOVO' },
    streak: {
      title: 'Моя серія в SLOVO',
      headline: {
        one: '{count} день поспіль',
        few: '{count} дні поспіль',
        many: '{count} днів поспіль',
        other: '{count} дня поспіль',
      },
    },
    dailyCrossword: { title: 'Кросворд дня розв’язано', grid: 'Сітка кросворду без літер' },
  },
  dates: {
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
  },
  wordCard: {
    stress: 'наголос на {vowels}',
    stressOr: 'або',
    partsOfSpeech: { noun: { short: 'ім.', full: 'іменник' } },
    genders: { feminine: { short: 'ж. р.', full: 'жіночий рід' } },
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    registers: { colloquial: { short: 'розм.', full: 'розмовне' } },
    registerWithRegion: '{register}, {region}',
  },
  correctionCard: { correctionTypes: { russianism: 'Русизм' } },
  idiomCard: {
    idiomTypes: { idiom: 'Фразеологізм', placeName: 'Назва місця' },
    etymology: 'Походження',
  },
  synonymRowCard: { chip: 'Синоніми', heading: '{dominant}, синонімічний ряд: {members}' },
  tipCard: { chip: 'Порада', heading: 'Порада: {title}' },
  feedNotices: {
    weeklyRecap: {
      seen: 'переглянуто',
      saved: 'збережено',
      known: 'знаю',
      streak: 'серія',
      xp: 'XP',
      goalDays: 'дні з ціллю',
      spoken: {
        seen: {
          one: 'переглянуто {count} запис',
          few: 'переглянуто {count} записи',
          many: 'переглянуто {count} записів',
          other: 'переглянуто {count} запису',
        },
        saved: {
          one: 'збережено {count} запис',
          few: 'збережено {count} записи',
          many: 'збережено {count} записів',
          other: 'збережено {count} запису',
        },
        known: {
          one: 'позначено «Знаю»: {count} запис',
          few: 'позначено «Знаю»: {count} записи',
          many: 'позначено «Знаю»: {count} записів',
          other: 'позначено «Знаю»: {count} запису',
        },
        streak: {
          one: 'серія: {count} день поспіль',
          few: 'серія: {count} дні поспіль',
          many: 'серія: {count} днів поспіль',
          other: 'серія: {count} дня поспіль',
        },
        xp: {
          one: '{count} XP за тиждень',
          few: '{count} XP за тиждень',
          many: '{count} XP за тиждень',
          other: '{count} XP за тиждень',
        },
        goalDays: {
          one: 'ціль виконано {count} день',
          few: 'ціль виконано {count} дні',
          many: 'ціль виконано {count} днів',
          other: 'ціль виконано {count} дня',
        },
      },
    },
  },
} as unknown as ShareCardStrings;

const entries = (content: Parameters<typeof createMemoryContentPort>[0] = {}) =>
  createEntries({
    content: createMemoryContentPort(content),
    edition: { isFeatureEnabled: () => true },
  });

async function wordCard(shown: Word): Promise<AnyEntryCard> {
  const model = await buildWordCard({
    word: shown,
    entries: entries({ categories: [{ id: 'household-crafts', displayName: 'Побут і ремесла' }] }),
  });
  return { kind: 'word', entryId: shown.id, model };
}

/** A Word's card as the Word of the Day of a day in October 2026. */
async function wordOfTheDayCard(shown: Word, day: number): Promise<AnyEntryCard> {
  const card = await wordCard(shown);
  if (card.kind !== 'word') throw new Error('a Word builds a Word card');
  return { ...card, wordOfTheDay: { year: 2026, month: 10, day } };
}

async function correctionCard(shown: Correction): Promise<AnyEntryCard> {
  const model = await buildCorrectionCard({ correction: shown, entries: entries() });
  return { kind: 'correction', entryId: shown.id, model };
}

const idiomCard = (shown: Idiom): AnyEntryCard => ({
  kind: 'idiom',
  entryId: shown.id,
  model: buildIdiomCard(shown),
});

async function synonymRowCard(shown: SynonymRow): Promise<AnyEntryCard> {
  const model = await buildSynonymRowCard({ synonymRow: shown, entries: entries() });
  return { kind: 'synonymRow', entryId: shown.id, model };
}

const tipCard = (shown: Tip): AnyEntryCard => ({
  kind: 'tip',
  entryId: shown.id,
  model: buildTipCard({ tip: shown }),
});

/** The reader's clock: 11 October 2026 in Kyiv. */
const { clock } = fakeClock();

const contentOf = (card: AnyEntryCard) => buildShareCardContent({ card }, STRINGS, 'uk', clock);

const VEREMIJA = word('w_veremija', {
  lemma: 'веремія',
  stress: [5],
  gender: 'feminine',
  primaryDefinition: 'Метушня, безлад.',
  registers: ['colloquial'],
  categoryId: 'household-crafts',
});

describe('the Share Card of a Word', () => {
  it('shows its Category over the Lemma with Stress, the short grammar line and the primary Definition', async () => {
    expect(contentOf(await wordCard(VEREMIJA))).toEqual({
      shows: 'w_veremija',
      overline: 'Побут і ремесла',
      label:
        'Побут і ремесла. веремія, наголос на і. іменник, жіночий рід, розмовне. Метушня, безлад.',
      body: {
        kind: 'word',
        lemma: 'веремі́я',
        grammar: 'ім., ж. р. · розм.',
        definition: 'Метушня, безлад.',
      },
    });
  });

  it('says «Слово дня» in place of the Category on today’s Word of the Day', async () => {
    const content = contentOf(await wordOfTheDayCard(VEREMIJA, 11));

    expect(content.overline).toBe('Слово дня');
    expect(content.label).toMatch(/^Слово дня\. /);
  });

  it('says the Category on the Word of the Day of the day before, still in a Feed left open over midnight', async () => {
    const content = contentOf(await wordOfTheDayCard(VEREMIJA, 10));

    expect(content.overline).toBe('Побут і ремесла');
  });
});

describe('the Share Card of a Correction', () => {
  it('shows the non-standard form and the main standard equivalent, under the Correction Type', async () => {
    const content = contentOf(
      await correctionCard(
        correction('c_protiahom', {
          nonStandardForm: 'на протязі',
          correctionType: 'russianism',
          standardEquivalents: ['протягом', 'упродовж'],
        }),
      ),
    );

    expect(content).toEqual({
      shows: 'c_protiahom',
      overline: 'Русизм',
      label: 'Русизм. Так часто кажуть: на протязі. Українською краще: протягом',
      body: { kind: 'correction', nonStandardForm: 'на протязі', standardForm: 'протягом' },
    });
  });
});

describe('the Share Card of an Idiom', () => {
  it('shows the expression and the primary Definition under the Idiom Type, with no etymology', () => {
    const content = contentOf(
      idiomCard(
        idiom('i_baidyky', {
          expression: 'бити байдики',
          primaryDefinition: 'Ледарювати.',
          etymology: 'Байдики — цурки для дитячих ігор.',
        }),
      ),
    );

    expect(content).toEqual({
      shows: 'i_baidyky',
      overline: 'Фразеологізм',
      label: 'Фразеологізм. бити байдики. Ледарювати.',
      body: {
        kind: 'idiom',
        expression: 'бити байдики',
        definition: 'Ледарювати.',
        etymology: undefined,
      },
    });
  });

  it('adds a place name’s etymology under «Походження»', () => {
    const content = contentOf(
      idiomCard(
        idiom('i_kyiv', {
          expression: 'Київ',
          idiomType: 'placeName',
          primaryDefinition: 'Столиця на Дніпрі.',
          etymology: 'Від імені Кия',
        }),
      ),
    );

    expect(content.overline).toBe('Назва місця');
    expect(content.body).toEqual({
      kind: 'idiom',
      expression: 'Київ',
      definition: 'Столиця на Дніпрі.',
      etymology: 'Від імені Кия',
    });
    expect(content.label).toBe('Назва місця. Київ. Столиця на Дніпрі. Походження: Від імені Кия');
  });
});

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

/** A row of «іти» with its first `count` members. */
const ity = (count: number) =>
  synonymRow('r_ity', {
    dominant: { text: 'іти', stress: [2] },
    meaning: 'Рухатися пішки.',
    members: TWELVE.slice(0, count),
  });

describe('the Share Card of a Synonym Row', () => {
  it('shows the dominant, the meaning and every member of a row of 5, with Stress, and reads them without', async () => {
    expect(contentOf(await synonymRowCard(ity(5)))).toEqual({
      shows: 'r_ity',
      overline: 'Синоніми',
      label:
        'іти, синонімічний ряд: простувати, чимчикувати, шкандибати, дибати, чалапати. Рухатися пішки.',
      body: {
        kind: 'synonymRow',
        dominant: 'іти́',
        meaning: 'Рухатися пішки.',
        members: 'простува́ти, чимчи́кувати, шкандиба́ти, ди́бати, чала́пати',
      },
    });
  });

  it('shows the first 6 members of a row of 12 and ends them in «…»', async () => {
    const { body } = contentOf(await synonymRowCard(ity(12)));

    expect(body).toMatchObject({
      members: 'простува́ти, чимчи́кувати, шкандиба́ти, ди́бати, чала́пати, чвала́ти…',
    });
  });

  it('ends a row of exactly 6 with no «…»', async () => {
    const { body } = contentOf(await synonymRowCard(ity(6)));

    expect(body).toMatchObject({
      members: 'простува́ти, чимчи́кувати, шкандиба́ти, ди́бати, чала́пати, чвала́ти',
    });
  });
});

describe('the Share Card of a Tip', () => {
  it('shows the title, the non-standard form and the standard form', () => {
    expect(
      contentOf(
        tipCard(
          tip('t_kotrahodyna', {
            title: 'Котра година?',
            nonStandardForm: 'Скільки час?',
            standardForm: 'Котра година?',
          }),
        ),
      ),
    ).toEqual({
      shows: 't_kotrahodyna',
      overline: 'Порада',
      label:
        'Порада: Котра година? Так часто кажуть: Скільки час? Українською краще: Котра година?',
      body: {
        kind: 'tip',
        title: 'Котра година?',
        nonStandardForm: 'Скільки час?',
        standardForm: 'Котра година?',
      },
    });
  });

  it('shows no non-standard form for a Tip without one', () => {
    const content = contentOf(
      tipCard(
        tip('t_zvertannia', {
          title: 'Звертання',
          nonStandardForm: undefined,
          standardForm: 'пане Андрію',
        }),
      ),
    );

    expect(content.body).toEqual({
      kind: 'tip',
      title: 'Звертання',
      nonStandardForm: undefined,
      standardForm: 'пане Андрію',
    });
    expect(content.label).toBe('Порада: Звертання. Українською краще: пане Андрію');
  });
});

/** The numbers of the week of Monday 20 to Sunday 26 October 2025. */
const RECAP: WeeklyRecapModel = {
  firstDay: { year: 2025, month: 10, day: 20 },
  lastDay: { year: 2025, month: 10, day: 26 },
  seen: 34,
  saved: 5,
  known: 12,
  streak: 9,
};

const recapContent = (recap: WeeklyRecapModel, hideStreak = false) =>
  buildShareCardContent({ recap, hideStreak }, STRINGS, 'uk', clock);

describe('the Share Card of a Weekly Recap', () => {
  it('shows the title, the week as its overline and the four numbers in order, with no words', () => {
    expect(recapContent(RECAP)).toEqual({
      shows: '20–26 жовтня',
      overline: '20–26 жовтня',
      label:
        '20–26 жовтня. Мій тиждень у SLOVO. переглянуто 34 записи. збережено 5 записів. позначено «Знаю»: 12 записів. серія: 9 днів поспіль',
      body: {
        kind: 'weeklyRecap',
        title: 'Мій тиждень у SLOVO',
        numbers: [
          { label: 'переглянуто', count: 34 },
          { label: 'збережено', count: 5 },
          { label: 'знаю', count: 12 },
          { label: 'серія', count: 9 },
        ],
      },
    });
  });

  it('names both months of a week across two months', () => {
    const content = recapContent({
      ...RECAP,
      firstDay: { year: 2025, month: 10, day: 27 },
      lastDay: { year: 2025, month: 11, day: 2 },
    });

    expect(content.overline).toBe('27 жовтня – 2 листопада');
  });

  it('leaves «знаю» out when the recap has no Known marks, as with the Knowledge Marks off', () => {
    const { known: _known, ...withoutKnown } = RECAP;

    expect(recapContent(withoutKnown).body).toMatchObject({
      numbers: [
        { label: 'переглянуто', count: 34 },
        { label: 'збережено', count: 5 },
        { label: 'серія', count: 9 },
      ],
    });
  });

  it('leaves «серія» out while the reader hides the Streak', () => {
    expect(recapContent(RECAP, true).body).toMatchObject({
      numbers: [
        { label: 'переглянуто', count: 34 },
        { label: 'збережено', count: 5 },
        { label: 'знаю', count: 12 },
      ],
    });
  });

  it('shows a 0 as a number', () => {
    expect(recapContent({ ...RECAP, saved: 0, known: 0 }).label).toBe(
      '20–26 жовтня. Мій тиждень у SLOVO. переглянуто 34 записи. збережено 0 записів. позначено «Знаю»: 0 записів. серія: 9 днів поспіль',
    );
  });

  it('ends with the week’s XP and goal days when the recap has them', () => {
    const content = recapContent({ ...RECAP, xp: 120, goalDays: 3 });

    expect(content.body).toMatchObject({
      numbers: [
        { label: 'переглянуто', count: 34 },
        { label: 'збережено', count: 5 },
        { label: 'знаю', count: 12 },
        { label: 'серія', count: 9 },
        { label: 'XP', count: 120 },
        { label: 'дні з ціллю', count: 3 },
      ],
    });
    expect(content.label).toContain('120 XP за тиждень. ціль виконано 3 дні');
  });
});

describe('the Share Card of progress', () => {
  it('shows a Level reached with its number and name, the day as its overline', () => {
    const content = buildShareCardContent(
      { level: { level: 5, name: 'Знавець', progress: 0, toNext: 300 }, date: '2026-11-01' },
      STRINGS,
      'uk',
      clock,
    );

    expect(content).toEqual({
      shows: 'level:5',
      overline: '1 листопада',
      label: '1 листопада. Новий рівень у SLOVO. Рівень 5. Знавець',
      body: {
        kind: 'milestone',
        title: 'Новий рівень у SLOVO',
        headline: 'Рівень 5',
        detail: 'Знавець',
      },
    });
  });

  it('shows a Badge earned with its name, on the day it was earned', () => {
    const content = buildShareCardContent(
      {
        badge: {
          id: 'week',
          name: 'Тиждень поспіль',
          condition: { kind: 'streak', days: 7 },
          earned: true,
          date: '2026-10-30',
        },
      },
      STRINGS,
      'uk',
      clock,
    );

    expect(content).toEqual({
      shows: 'badge:week',
      overline: '30 жовтня',
      label: '30 жовтня. Нова відзнака в SLOVO. Тиждень поспіль',
      body: {
        kind: 'milestone',
        title: 'Нова відзнака в SLOVO',
        headline: 'Тиждень поспіль',
        detail: undefined,
      },
    });
  });

  it('shows a Streak milestone in its plural form', () => {
    const content = buildShareCardContent({ streak: 14, date: '2026-11-01' }, STRINGS, 'uk', clock);

    expect(content).toEqual({
      shows: 'streak:14',
      overline: '1 листопада',
      label: '1 листопада. Моя серія в SLOVO. 14 днів поспіль',
      body: {
        kind: 'milestone',
        title: 'Моя серія в SLOVO',
        headline: '14 днів поспіль',
        detail: undefined,
      },
    });
    expect(
      buildShareCardContent({ streak: 3, date: '2026-11-01' }, STRINGS, 'uk', clock).label,
    ).toBe('1 листопада. Моя серія в SLOVO. 3 дні поспіль');
  });
});

describe('the Share Card of a solved Daily Crossword', () => {
  const crossword = {
    date: '2026-11-01',
    letters: [
      ['к', 'і', 'т', undefined, undefined],
      [undefined, undefined, 'и', undefined, undefined],
      [undefined, undefined, 'н', undefined, undefined],
      [undefined, undefined, undefined, undefined, undefined],
      [undefined, undefined, undefined, undefined, undefined],
    ],
    words: [
      {
        start: { row: 0, column: 0 },
        direction: 'across',
        length: 3,
        clue: 'Свійська тварина',
        right: true,
      },
      {
        start: { row: 0, column: 2 },
        direction: 'down',
        length: 3,
        clue: 'Огорожа з лози',
        right: true,
      },
    ],
    progress: 'solved',
  } as const;

  it('shows the grid’s open cells with no letter and no clue, the day as its overline', () => {
    const content = buildShareCardContent({ crossword }, STRINGS, 'uk', clock);

    expect(content).toEqual({
      shows: 'crossword:2026-11-01',
      overline: '1 листопада',
      label: '1 листопада. Кросворд дня розв’язано. Сітка кросворду без літер',
      body: {
        kind: 'dailyCrossword',
        title: 'Кросворд дня розв’язано',
        grid: [
          [true, true, true, false, false],
          [false, false, true, false, false],
          [false, false, true, false, false],
          [false, false, false, false, false],
          [false, false, false, false, false],
        ],
      },
    });
    const shared = JSON.stringify(content);
    for (const answerOrClue of ['кіт', 'тин', 'Свійська', 'лози']) {
      expect(shared).not.toContain(answerOrClue);
    }
  });
});
