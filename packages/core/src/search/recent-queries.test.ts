import { describe, expect, it } from 'vitest';

import { createRecentQueries } from './recent-queries';
import { createSearch } from './search';
import { createMemoryContentPort } from '../testing';
import { word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** An Ukrainian-like Edition: Search on, ґ read as г and ё as е. */
const edition = {
  isFeatureEnabled: () => true,
  languageTraits: { sortLocale: 'uk' },
  searchLetters: { ґ: 'г', ё: 'е' },
};

async function open(port = createMemoryUserStatePort()) {
  const userState = await openUserState({ port });
  return {
    recent: createRecentQueries({ edition, userState }),
    search: createSearch({
      content: createMemoryContentPort({ words: [word('w_quiet', { lemma: 'сумирний' })] }),
      edition,
      userState,
    }),
  };
}

describe('Recent queries of Search', () => {
  it('saves a query only when a result is opened from it', async () => {
    const { recent, search } = await open();

    await search.search('сум');
    expect(await recent.list()).toEqual([]);

    await recent.resultOpened('сум');
    expect(await recent.list()).toEqual(['сум']);
  });

  it('keeps the last 10, newest first, the 11th dropping the oldest', async () => {
    const { recent } = await open();
    const queries = Array.from({ length: 11 }, (_, index) => `запит ${String(index + 1)}`);

    for (const query of queries) await recent.resultOpened(query);

    expect(await recent.list()).toEqual(queries.slice(1).reverse());
  });

  it('moves a repeated query to the top, kept once as last typed', async () => {
    const { recent } = await open();

    await recent.resultOpened('сумирний');
    await recent.resultOpened('ґречний');
    await recent.resultOpened('  Ґре́чний ');
    await recent.resultOpened('гречний');

    expect(await recent.list()).toEqual(['гречний', 'сумирний']);
  });

  it('keeps the query as typed, without the spaces at its ends', async () => {
    const { recent } = await open();

    await recent.resultOpened('  Сумирний ');

    expect(await recent.list()).toEqual(['Сумирний']);
  });

  it('empties the queries on «Очистити»', async () => {
    const { recent } = await open();
    await recent.resultOpened('сум');

    await recent.clear();

    expect(await recent.list()).toEqual([]);
  });

  it('keeps the queries on the device from one open to the next', async () => {
    const port = createMemoryUserStatePort();
    await (await open(port)).recent.resultOpened('сум');

    const { recent } = await open(port);

    expect(await recent.list()).toEqual(['сум']);
  });
});
