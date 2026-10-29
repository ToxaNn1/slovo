import { describe, expect, it } from 'vitest';

import type { FeatureSwitch } from '@slovo/contracts';

import { createMemoryUserStatePort, openUserState } from '../index';
import { createSearch } from './search';
import { createMemoryContentPort } from '../testing';
import { correction, idiom, synonymRow, tip, word } from '../test-support';

/** An Ukrainian-like Edition: Search on, ґ read as г and ё as е. */
const edition = (off: readonly FeatureSwitch[] = []) => ({
  isFeatureEnabled: (feature: FeatureSwitch) => !off.includes(feature),
  languageTraits: { sortLocale: 'uk' },
  searchLetters: { ґ: 'г', ё: 'е' },
});

async function searchOver(
  pack: Parameters<typeof createMemoryContentPort>[0],
  { hidden = [], off = [] }: { hidden?: readonly string[]; off?: readonly FeatureSwitch[] } = {},
) {
  const records = new Map(
    hidden.map((id) => [`hidden.${id}`, JSON.stringify('2026-10-20T10:00:00.000Z')]),
  );
  return createSearch({
    content: createMemoryContentPort(pack),
    edition: edition(off),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
  });
}

const lemmasOf = async (search: Awaited<ReturnType<typeof searchOver>>, query: string) =>
  (await search.search(query)).words.map(({ lemma }) => lemma);

describe('Search over Word Lemmas', () => {
  const words = [
    word('w_quiet', { lemma: 'сумирний' }),
    word('w_phrase', { lemma: 'на сумирному' }),
    word('w_middle', { lemma: 'насумирний' }),
    word('w_other', { lemma: 'ґречний' }),
  ];

  it('finds a Lemma whose first or a later word starts with the query', async () => {
    const search = await searchOver({ words });

    expect(await lemmasOf(search, 'сум')).toEqual(['на сумирному', 'сумирний']);
  });

  it('gives nothing for a query of one character, however it is padded', async () => {
    const search = await searchOver({ words });

    expect(await lemmasOf(search, 'су')).toEqual(['на сумирному', 'сумирний']);
    expect(await lemmasOf(search, 'с')).toEqual([]);
    expect(await lemmasOf(search, ' с ')).toEqual([]);
    expect(await lemmasOf(search, 'с́')).toEqual([]);
  });

  it('finds from 2 characters, ignoring case, Stress marks and г or ґ', async () => {
    const search = await searchOver({ words });

    expect(await lemmasOf(search, 'СУ')).toEqual(['на сумирному', 'сумирний']);
    expect(await lemmasOf(search, 'су́м')).toEqual(['на сумирному', 'сумирний']);
    expect(await lemmasOf(search, 'гре')).toEqual(['ґречний']);
  });

  it('puts an exact match first, then the rest in the Edition’s alphabet', async () => {
    const search = await searchOver({
      words: [
        word('w_long', { lemma: 'ґава' }),
        word('w_g', { lemma: 'гав' }),
        word('w_exact', { lemma: 'га' }),
        word('w_ye', { lemma: 'гає' }),
        word('w_e', { lemma: 'гад' }),
        word('w_phrase', { lemma: 'а гаття' }),
      ],
    });

    expect(await lemmasOf(search, 'га')).toEqual(['га', 'а гаття', 'гав', 'гад', 'гає', 'ґава']);
  });

  it('gives at most 50 Words', async () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      word(`w_${String(index).padStart(2, '0')}`, {
        lemma: `слово${String(59 - index).padStart(2, '0')}`,
      }),
    );
    const search = await searchOver({ words: many });

    const found = await lemmasOf(search, 'слово');
    expect(found).toHaveLength(50);
    expect(found[0]).toBe('слово00');
    expect(found.at(-1)).toBe('слово49');
  });

  it('leaves out Hidden and Retired Words', async () => {
    const search = await searchOver(
      {
        words: [
          word('w_live', { lemma: 'сумирний' }),
          word('w_hidden', { lemma: 'сумовитий' }),
          word('w_retired', { lemma: 'сумний', retired: true }),
        ],
      },
      { hidden: ['w_hidden'] },
    );

    expect(await lemmasOf(search, 'сум')).toEqual(['сумирний']);
  });

  it('finds a Word out of the Mix and below the Rarity Floor', async () => {
    const records = new Map([
      ['mix.categories.nature', JSON.stringify(false)],
      ['mix.rarityFloor', JSON.stringify(5)],
    ]);
    const search = createSearch({
      content: createMemoryContentPort({
        categories: [
          { id: 'speech', displayName: 'Мова' },
          { id: 'nature', displayName: 'Природа' },
        ],
        words: [word('w_nature', { lemma: 'сумирний', categoryId: 'nature', rarity: 1 })],
      }),
      edition: edition(),
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    });

    expect(await lemmasOf(search, 'сум')).toEqual(['сумирний']);
  });

  it('finds nothing while the Edition turns Search off', async () => {
    const on = await searchOver({ words });
    const off = await searchOver({ words }, { off: ['search'] });

    expect(await lemmasOf(on, 'сум')).toEqual(['на сумирному', 'сумирний']);
    expect(await lemmasOf(off, 'сум')).toEqual([]);
  });
});

/** The visible text of each Entry found, group by group. */
const groupsOf = async (search: Awaited<ReturnType<typeof searchOver>>, query: string) => {
  const found = await search.search(query);
  return {
    words: found.words.map(({ lemma }) => lemma),
    corrections: found.corrections.map(({ nonStandardForm }) => nonStandardForm),
    idioms: found.idioms.map(({ expression }) => expression),
    synonymRows: found.synonymRows.map(({ dominant }) => dominant.text),
    tips: found.tips.map(({ title }) => title),
  };
};

const NO_GROUPS = { words: [], corrections: [], idioms: [], synonymRows: [], tips: [] };

describe('Search over every kind of Entry', () => {
  const pack = {
    words: [word('w_cheer', { lemma: 'бадьорий' })],
    corrections: [
      correction('c_take', {
        nonStandardForm: 'бажаючий',
        standardEquivalents: ['охочий', 'той, хто бажає'],
      }),
    ],
    idioms: [idiom('i_crow', { expression: 'бити байдики' })],
    synonymRows: [
      synonymRow('s_brave', {
        dominant: { text: 'сміливий', stress: [2] },
        members: ['відважний', 'хоробрий', 'безстрашний', 'бравий', 'бадьористий'].map((text) => ({
          text,
          stress: [0],
        })),
      }),
    ],
    tips: [tip('t_ba', { title: 'Бажано чи бажаніше?' })],
  };

  it('puts a match of each kind in its own group', async () => {
    const search = await searchOver(pack);

    expect(await groupsOf(search, 'ба')).toEqual({
      words: ['бадьорий'],
      corrections: ['бажаючий'],
      idioms: ['бити байдики'],
      synonymRows: ['сміливий'],
      tips: ['Бажано чи бажаніше?'],
    });
  });

  it('finds a Correction by its non-standard form or by any standard one', async () => {
    const search = await searchOver(pack);

    expect((await groupsOf(search, 'бажаю')).corrections).toEqual(['бажаючий']);
    expect((await groupsOf(search, 'охоч')).corrections).toEqual(['бажаючий']);
    expect((await groupsOf(search, 'хто')).corrections).toEqual(['бажаючий']);
  });

  it('finds a Synonym Row by its dominant or by a member', async () => {
    const search = await searchOver(pack);

    expect((await groupsOf(search, 'сміл')).synonymRows).toEqual(['сміливий']);
    expect((await groupsOf(search, 'хороб')).synonymRows).toEqual(['сміливий']);
  });

  it('finds a word after a quote, a bracket or a hyphen by its own start', async () => {
    const search = await searchOver({
      idioms: [idiom('i_stump', { expression: 'через пень-колоду' })],
      tips: [tip('t_greet', { title: 'Вітаємося: «Добрий день!»' })],
    });

    expect((await groupsOf(search, 'колод')).idioms).toEqual(['через пень-колоду']);
    expect((await groupsOf(search, 'пень-кол')).idioms).toEqual(['через пень-колоду']);
    expect((await groupsOf(search, 'добр')).tips).toEqual(['Вітаємося: «Добрий день!»']);
  });

  it('puts an Entry with an exact text first, then the rest in the Edition’s alphabet', async () => {
    const search = await searchOver({
      corrections: [
        correction('c_long', { nonStandardForm: 'ґава', standardEquivalents: ['ворона'] }),
        correction('c_b', { nonStandardForm: 'брати участь', standardEquivalents: ['гав'] }),
        correction('c_exact', { nonStandardForm: 'ясно', standardEquivalents: ['га'] }),
      ],
    });

    expect((await groupsOf(search, 'га')).corrections).toEqual(['ясно', 'брати участь', 'ґава']);
  });

  it('gives at most 50 Entries a group', async () => {
    const search = await searchOver({
      tips: Array.from({ length: 60 }, (_, index) =>
        tip(`t_${String(index)}`, { title: `порада ${String(index).padStart(2, '0')}` }),
      ),
    });

    expect((await groupsOf(search, 'пор')).tips).toHaveLength(50);
  });

  it('leaves out Hidden and Retired Entries of every kind', async () => {
    const search = await searchOver(
      {
        corrections: [
          correction('c_hidden', { nonStandardForm: 'бажаючий' }),
          correction('c_retired', { nonStandardForm: 'бажаний', retired: true }),
          correction('c_live', { nonStandardForm: 'бакалійний' }),
        ],
        idioms: [
          idiom('i_retired', { expression: 'бити байдики', retired: true }),
          idiom('i_live', { expression: 'бачити наскрізь' }),
        ],
        synonymRows: [
          synonymRow('s_hidden', { dominant: { text: 'бравий', stress: [2] } }),
          synonymRow('s_live', { dominant: { text: 'бравурний', stress: [2] } }),
        ],
        tips: [
          tip('t_retired', { title: 'Бажано', retired: true }),
          tip('t_live', { title: 'Багато чи багатьох?' }),
        ],
      },
      { hidden: ['c_hidden', 's_hidden'] },
    );

    expect(await groupsOf(search, 'ба')).toEqual({
      ...NO_GROUPS,
      corrections: ['бакалійний'],
      idioms: ['бачити наскрізь'],
      tips: ['Багато чи багатьох?'],
    });
    expect(await groupsOf(search, 'бр')).toEqual({ ...NO_GROUPS, synonymRows: ['бравурний'] });
  });

  it('gives no group for a kind the Edition turns off', async () => {
    const search = await searchOver(pack, {
      off: ['corrections', 'idioms', 'synonymRows', 'tips'],
    });

    expect(await groupsOf(search, 'ба')).toEqual({ ...NO_GROUPS, words: ['бадьорий'] });
  });

  it('finds nothing of any kind while the Edition turns Search off', async () => {
    const search = await searchOver(pack, { off: ['search'] });

    expect(await groupsOf(search, 'ба')).toEqual(NO_GROUPS);
  });
});

describe('Search by meaning («За значенням»)', () => {
  const byMeaningOf = async (search: Awaited<ReturnType<typeof searchOver>>, query: string) =>
    (await search.search(query)).byMeaning.map((entry) =>
      entry.kind === 'word' ? entry.lemma : entry.dominant.text,
    );

  const pack = {
    words: [
      word('w_quiet', { lemma: 'сумирний', primaryDefinition: 'Тихий, спокійний, лагідний.' }),
      word('w_still', {
        lemma: 'безгомінний',
        primaryDefinition: 'Без гомону.',
        extraDefinitions: ['Дуже тихий; мовчазний.'],
      }),
      word('w_loud', { lemma: 'гучний', primaryDefinition: 'Голосний.' }),
    ],
    synonymRows: [
      synonymRow('s_quiet', {
        dominant: { text: 'тихий', stress: [1] },
        meaning: 'Який не шумить.',
        members: ['безшумний', 'нечутний', 'сумирний', 'мовчазний', 'приглушений'].map((text) => ({
          text,
          stress: [0],
        })),
      }),
      synonymRow('s_go', {
        dominant: { text: 'іти', stress: [1] },
        meaning: 'Рухатися кроками.',
        members: ['простувати', 'чимчикувати', 'шкандибати', 'плентатися', 'дибати'].map(
          (text) => ({ text, stress: [0], shadeNote: 'тихо' }),
        ),
      }),
    ],
  };

  it('gives no group for a query of 2 characters', async () => {
    const search = await searchOver(pack);

    expect(await byMeaningOf(search, 'ти')).toEqual([]);
    expect(await byMeaningOf(search, ' ти́ ')).toEqual([]);
  });

  it('lists the Words whose primary or further Definition contains the query, anywhere in it', async () => {
    const search = await searchOver({ words: pack.words });

    expect(await byMeaningOf(search, 'ТИХ')).toEqual(['безгомінний', 'сумирний']);
    expect(await byMeaningOf(search, 'покій')).toEqual(['сумирний']);
  });

  it('lists the Synonym Rows whose meaning, dominant, members or notes contain the query', async () => {
    const search = await searchOver({ synonymRows: pack.synonymRows });

    expect(await byMeaningOf(search, 'шумит')).toEqual(['тихий']);
    expect(await byMeaningOf(search, 'чутн')).toEqual(['тихий']);
    expect(await byMeaningOf(search, 'тих')).toEqual(['іти', 'тихий']);
  });

  it('lists Words and Synonym Rows together in the Edition’s alphabet', async () => {
    const search = await searchOver(pack);

    expect(await byMeaningOf(search, 'тих')).toEqual(['безгомінний', 'іти', 'сумирний', 'тихий']);
  });

  it('gives at most 50', async () => {
    const search = await searchOver({
      words: Array.from({ length: 60 }, (_, index) =>
        word(`w_${String(index)}`, { primaryDefinition: 'Тихий.' }),
      ),
    });

    expect(await byMeaningOf(search, 'тих')).toHaveLength(50);
  });

  it('leaves out Hidden and Retired Words and Synonym Rows', async () => {
    const search = await searchOver(
      {
        words: [
          word('w_hidden', { primaryDefinition: 'Тихий.' }),
          word('w_retired', { primaryDefinition: 'Тихий.', retired: true }),
          word('w_live', { lemma: 'сумирний', primaryDefinition: 'Тихий.' }),
        ],
        synonymRows: [
          synonymRow('s_hidden', { meaning: 'Тихий.' }),
          synonymRow('s_retired', { meaning: 'Тихий.', retired: true }),
          synonymRow('s_live', { dominant: { text: 'тихий', stress: [1] }, meaning: 'Тихий.' }),
        ],
      },
      { hidden: ['w_hidden', 's_hidden'] },
    );

    expect(await byMeaningOf(search, 'тих')).toEqual(['сумирний', 'тихий']);
  });

  it('leaves out Synonym Rows while the Edition turns them off, and all while Search is off', async () => {
    expect(await byMeaningOf(await searchOver(pack, { off: ['synonymRows'] }), 'тих')).toEqual([
      'безгомінний',
      'сумирний',
    ]);
    expect(await byMeaningOf(await searchOver(pack, { off: ['search'] }), 'тих')).toEqual([]);
  });
});
