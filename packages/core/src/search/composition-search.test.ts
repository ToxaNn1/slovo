import { describe, expect, it } from 'vitest';

import type { FeatureSwitch } from '@slovo/contracts';

import { openComposition } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** An Edition whose Mix holds only the Category `test`, with Search on unless `off` names it. */
const edition = (off: readonly FeatureSwitch[] = []) =>
  testEdition({
    isFeatureEnabled: (feature) => !off.includes(feature),
    languageTraits: { sortLocale: 'uk' },
    searchLetters: { ґ: 'г' },
    userSettingDefaults: { mix: { corrections: false } },
  });

const content = createMemoryContentPort({
  categories: [
    { id: 'test', displayName: 'Тест' },
    { id: 'other', displayName: 'Інше' },
  ],
  words: [
    word('w_quiet', { lemma: 'сумирний' }),
    word('w_polite', { lemma: 'ґречний' }),
    word('w_sad', { lemma: 'сумний', categoryId: 'other' }),
  ],
});

/** The Core composition of one app run, over fresh user state. */
async function run(off: readonly FeatureSwitch[] = []) {
  return openComposition({
    content,
    edition: edition(off),
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: fakeClock().clock,
    random: { next: () => 0.25 },
  });
}

const lemmasFound = async (app: Awaited<ReturnType<typeof run>>, query: string) =>
  (await app.search.search(query)).words.map(({ lemma }) => lemma);

describe("the composition's Search", () => {
  it("finds Words out of the Mix, reading letters as the Edition's `searchLetters` say", async () => {
    const app = await run();

    expect(await lemmasFound(app, 'сум')).toEqual(['сумирний', 'сумний']);
    expect(await lemmasFound(app, 'гре')).toEqual(['ґречний']);
  });

  it('leaves out an Entry hidden from its card, and finds it again once restored', async () => {
    const app = await run();

    await app.hide({ kind: 'entry', entryId: 'w_quiet' });
    expect(await lemmasFound(app, 'сум')).toEqual(['сумний']);

    await app.unhide({ kind: 'entry', entryId: 'w_quiet' });
    expect(await lemmasFound(app, 'сум')).toEqual(['сумирний', 'сумний']);
  });

  it('answers a query of 2 letters, Stress marks and spaces aside, while Search is on', async () => {
    const app = await run();

    expect(['су', ' гр ', 'жжж'].map((query) => app.search.answers(query))).toEqual([
      true,
      true,
      true,
    ]);
    expect(['', 'с', ' с ', 'с́'].map((query) => app.search.answers(query))).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect((await run(['search'])).search.answers('сум')).toBe(false);
  });

  it('finds nothing while the Edition turns Search off', async () => {
    const app = await run(['search']);

    expect(await lemmasFound(app, 'сум')).toEqual([]);
  });

  it('keeps the query a result was opened from, newest first, until cleared', async () => {
    const app = await run();

    await app.recentQueries.resultOpened('сум');
    await app.recentQueries.resultOpened('гре');
    expect(await app.recentQueries.list()).toEqual(['гре', 'сум']);

    await app.recentQueries.clear();
    expect(await app.recentQueries.list()).toEqual([]);
  });
});
