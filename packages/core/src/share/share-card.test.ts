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
import { correction, idiom, synonymRow, tip, word } from '../test-support';
import { createMemoryContentPort } from '../testing';

/** The texts of the Ukrainian Edition a Share Card reads. */
const STRINGS = {
  share: {
    wordOfTheDay: 'Слово дня',
    nonStandard: 'Так часто кажуть',
    standard: 'Українською краще',
    weeklyRecap: {
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
    },
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

const contentOf = (card: AnyEntryCard, todaysWordOfTheDay = false) =>
  buildShareCardContent({ card, todaysWordOfTheDay }, STRINGS);

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
    const content = contentOf(await wordCard(VEREMIJA), true);

    expect(content.overline).toBe('Слово дня');
    expect(content.label).toMatch(/^Слово дня\. /);
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
  buildShareCardContent({ recap, hideStreak }, STRINGS);

describe('the Share Card of a Weekly Recap', () => {
  it('shows the title, the week as its overline and the four numbers in order, with no words', () => {
    expect(recapContent(RECAP)).toEqual({
      shows: '20–26 жовтня',
      overline: '20–26 жовтня',
      label: '20–26 жовтня. Мій тиждень у SLOVO. 34 переглянуто. 5 збережено. 12 знаю. 9 серія',
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
      '20–26 жовтня. Мій тиждень у SLOVO. 34 переглянуто. 0 збережено. 0 знаю. 9 серія',
    );
  });
});
