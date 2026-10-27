import { describe, expect, it } from 'vitest';

import type { FeatureSwitch, Word } from '@slovo/contracts';

import { createMemoryUserStatePort, createSearch, openUserState } from '../index';
import { createMemoryContentPort } from '../testing';
import { word } from '../test-support';

/** An Ukrainian-like Edition: Search on, ґ read as г and ё as е. */
const edition = (off: readonly FeatureSwitch[] = []) => ({
  isFeatureEnabled: (feature: FeatureSwitch) => !off.includes(feature),
  languageTraits: { sortLocale: 'uk' },
  searchLetters: { ґ: 'г', ё: 'е' },
});

async function searchOver(
  words: readonly Word[],
  { hidden = [], off = [] }: { hidden?: readonly string[]; off?: readonly FeatureSwitch[] } = {},
) {
  const records = new Map(
    hidden.map((id) => [`hidden.${id}`, JSON.stringify('2026-10-20T10:00:00.000Z')]),
  );
  return createSearch({
    content: createMemoryContentPort({ words }),
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
    const search = await searchOver(words);

    expect(await lemmasOf(search, 'сум')).toEqual(['на сумирному', 'сумирний']);
  });

  it('gives nothing for a query of one character, however it is padded', async () => {
    const search = await searchOver(words);

    expect(await lemmasOf(search, 'су')).toEqual(['на сумирному', 'сумирний']);
    expect(await lemmasOf(search, 'с')).toEqual([]);
    expect(await lemmasOf(search, ' с ')).toEqual([]);
    expect(await lemmasOf(search, 'с́')).toEqual([]);
  });

  it('finds from 2 characters, ignoring case, Stress marks and г or ґ', async () => {
    const search = await searchOver(words);

    expect(await lemmasOf(search, 'СУ')).toEqual(['на сумирному', 'сумирний']);
    expect(await lemmasOf(search, 'су́м')).toEqual(['на сумирному', 'сумирний']);
    expect(await lemmasOf(search, 'гре')).toEqual(['ґречний']);
  });

  it('puts an exact match first, then the rest in the Edition’s alphabet', async () => {
    const search = await searchOver([
      word('w_long', { lemma: 'ґава' }),
      word('w_g', { lemma: 'гав' }),
      word('w_exact', { lemma: 'га' }),
      word('w_ye', { lemma: 'гає' }),
      word('w_e', { lemma: 'гад' }),
      word('w_phrase', { lemma: 'а гаття' }),
    ]);

    expect(await lemmasOf(search, 'га')).toEqual(['га', 'а гаття', 'гав', 'гад', 'гає', 'ґава']);
  });

  it('gives at most 50 Words', async () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      word(`w_${String(index).padStart(2, '0')}`, {
        lemma: `слово${String(59 - index).padStart(2, '0')}`,
      }),
    );
    const search = await searchOver(many);

    const found = await lemmasOf(search, 'слово');
    expect(found).toHaveLength(50);
    expect(found[0]).toBe('слово00');
    expect(found.at(-1)).toBe('слово49');
  });

  it('leaves out Hidden and Retired Words', async () => {
    const search = await searchOver(
      [
        word('w_live', { lemma: 'сумирний' }),
        word('w_hidden', { lemma: 'сумовитий' }),
        word('w_retired', { lemma: 'сумний', retired: true }),
      ],
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
    const on = await searchOver(words);
    const off = await searchOver(words, { off: ['search'] });

    expect(await lemmasOf(on, 'сум')).toEqual(['на сумирному', 'сумирний']);
    expect(await lemmasOf(off, 'сум')).toEqual([]);
  });
});
