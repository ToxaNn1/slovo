import { type Word, type Category } from '@slovo/contracts';
import { openComposition, type Composition, type Edition } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { hiddenScreenModel, hiddenSummary } from './hidden-screen';
import { count, fakeClock, strings, ukrainian } from '../test-support';

/** The Language Pack's Categories, in its order. */
const first: Category = {
  id: 'nature-weather',
  displayName: 'Природа і погода',
  description: 'Природа і погода.',
  tone: 'loud',
};
const second: Category = {
  id: 'household-crafts',
  displayName: 'Побут і ремесла',
  description: 'Побут і ремесла.',
  tone: 'loud',
};
/** A Category that stays in the Mix while the other two are taken out. */
const third: Category = {
  id: 'language-speech',
  displayName: 'Мова і мовлення',
  description: 'Мова і мовлення.',
  tone: 'loud',
};

function word(id: string, categoryId: string, extra: Partial<Word> = {}): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [],
    partOfSpeech: 'adverb',
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId,
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
    ...extra,
  };
}

/** The Language Pack's Categories of Corrections, a list of their own (ADR 0033). */
const everyday: Category = {
  id: 'everyday',
  displayName: 'Щодня',
  description: 'Щодня.',
  tone: 'loud',
};
const work: Category = {
  id: 'work',
  displayName: 'На роботі',
  description: 'На роботі.',
  tone: 'loud',
};

const content = createMemoryContentPort({
  categories: [first, second, third],
  correctionCategories: [everyday, work],
  words: [
    word('w_one', first.id, { registers: ['archaic'] }),
    word('w_two', second.id, { partOfSpeech: 'noun', gender: 'feminine', stress: [2] }),
    word('w_three', second.id),
  ],
  corrections: [
    {
      kind: 'correction',
      id: 'c_one',
      nonStandardForm: 'слідуючий',
      correctionType: 'russianism',
      standardEquivalents: ['наступний'],
      explanation: 'An explanation.',
      examplePair: { nonStandard: 'Так кажуть.', standard: 'Краще так.' },
      categoryId: 'everyday',
      sources: [{ title: 'Test source' }],
      literaryUses: [],
      retired: false,
    },
  ],
  idioms: [
    {
      kind: 'idiom',
      id: 'i_one',
      expression: 'бити байдики',
      idiomType: 'idiom',
      primaryDefinition: 'Ледарювати.',
      extraDefinitions: [],
      examples: [],
      sources: [{ title: 'Test source' }],
      retired: false,
    },
  ],
});

async function open(
  edition: Edition = ukrainian,
): Promise<{ app: Composition; advance: () => void }> {
  const time = fakeClock();
  const app = await openComposition({
    content,
    edition,
    userState: await seedUserState(),
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return {
    app,
    advance: () => {
      time.advance(60_000);
    },
  };
}

const modelOf = (app: Composition) =>
  hiddenScreenModel({
    hiddenEntries: app.hiddenEntries.list,
    outOfMix: app.mix.outOfMix(),
    kindsOn: app.mix.kindsOn(),
    strings,
  });

/** The UA Edition with the feature turned off. */
const without = (feature: string): Edition => ({
  ...ukrainian,
  isFeatureEnabled: (each) => each !== feature && ukrainian.isFeatureEnabled(each),
});

/** Each row as the screen lists it: its name and its kind label. */
const rowsOf = (app: Composition) =>
  modelOf(app).rows.map(({ name, kindLabel }) => [name, kindLabel]);

describe('the «Приховане» screen', () => {
  it('is empty while nothing is hidden', async () => {
    const { app } = await open();

    expect(modelOf(app).rows).toEqual([]);
  });

  it('lists everything hidden in one list: the Categories, the kinds out of the Mix, then the Hidden Entries newest first, each with its kind', async () => {
    const { app, advance } = await open();
    for (const id of ['w_one', 'i_one', 'w_two']) {
      await app.hiddenEntries.hide(id);
      advance();
    }
    await app.mix.setKind('correction', false);
    await app.mix.takeOut(first.id);

    expect(rowsOf(app)).toEqual([
      [first.displayName, 'категорія'],
      ['Виправлення', 'тип карток'],
      ['two\u0301', 'запис'],
      ['бити байдики', 'запис'],
      ['one', 'запис'],
    ]);
    expect(modelOf(app).rows.map(({ target }) => target)).toEqual([
      { kind: 'category', categoryId: first.id },
      { kind: 'whole-kind', entryKind: 'correction' },
      { kind: 'entry', entryId: 'w_two' },
      { kind: 'entry', entryId: 'i_one' },
      { kind: 'entry', entryId: 'w_one' },
    ]);
  });

  it('names the row for VoiceOver on its «Показати» button, without the stress mark', async () => {
    const { app } = await open();
    await app.hiddenEntries.hide('w_two');

    const [row] = modelOf(app).rows;

    expect(row?.name).not.toBe('two');
    expect(row?.showLabel).toBe('Показати «two»');
  });

  it('lists the Hidden Categories in the Language Pack’s order, the Corrections’ after the Words’, named as Corrections', async () => {
    const { app } = await open();
    await app.hide({ kind: 'category', categoryId: work.id, of: 'correction' });
    await app.mix.takeOut(second.id);
    await app.mix.takeOut(first.id);

    expect(rowsOf(app)).toEqual([
      [first.displayName, 'категорія'],
      [second.displayName, 'категорія'],
      ['Виправлення: На роботі', 'категорія'],
    ]);
  });

  it('leaves the Hidden Categories of Corrections out while Corrections are out as a whole, which the screen lists instead', async () => {
    const { app } = await open();
    await app.hide({ kind: 'category', categoryId: work.id, of: 'correction' });
    await app.mix.setKind('correction', false);

    expect(rowsOf(app)).toEqual([['Виправлення', 'тип карток']]);
  });

  it('leaves the Hidden Categories of Corrections out while the Edition turns Corrections off', async () => {
    const { app } = await open(without('corrections'));
    await app.hide({ kind: 'category', categoryId: work.id, of: 'correction' });

    expect(modelOf(app).rows).toEqual([]);
  });

  it('lists the kinds out of the Mix in the Mix’s order: Corrections before Idioms', async () => {
    const { app } = await open();
    await app.mix.setKind('idiom', false);
    await app.mix.setKind('correction', false);

    expect(rowsOf(app)).toEqual([
      ['Виправлення', 'тип карток'],
      ['Фразеологізми', 'тип карток'],
    ]);
  });

  it.each([
    ['correction', 'corrections'],
    ['idiom', 'idioms'],
  ] as const)(
    'leaves the kind %s out of the screen when the Edition does not turn it on',
    async (entryKind, feature) => {
      const { app } = await open(without(feature));
      await app.mix.setKind(entryKind, false);

      expect(modelOf(app).rows).toEqual([]);
    },
  );

  it.each([
    ['a Hidden Entry', { kind: 'entry', entryId: 'w_one' }],
    ['a Hidden Category', { kind: 'category', categoryId: first.id }],
    ['a kind out of the Mix', { kind: 'whole-kind', entryKind: 'idiom' }],
  ] as const)('leaves the list once its row’s target is shown: %s', async (_, target) => {
    const { app } = await open();
    await app.hide(target);
    expect(modelOf(app).rows.map((row) => row.target)).toEqual([target]);

    await app.unhide(target);

    expect(modelOf(app).rows).toEqual([]);
  });
});

describe('the «Приховані записи» row of Settings', () => {
  it('counts the Hidden Entries in the Edition’s plural forms', async () => {
    const { app } = await open();
    const said = [
      hiddenSummary({ hiddenEntries: app.hiddenEntries.list, strings: strings.hidden, count }),
    ];

    for (const id of ['w_one', 'w_two', 'w_three']) {
      await app.hiddenEntries.hide(id);
      said.push(
        hiddenSummary({ hiddenEntries: app.hiddenEntries.list, strings: strings.hidden, count }),
      );
    }

    expect(said).toEqual(['0 записів', '1 запис', '2 записи', '3 записи']);
  });

  it('follows a restore', async () => {
    const { app } = await open();
    await app.hiddenEntries.hide('w_one');
    await app.hiddenEntries.hide('w_two');

    await app.hiddenEntries.restore('w_one');

    expect(
      hiddenSummary({ hiddenEntries: app.hiddenEntries.list, strings: strings.hidden, count }),
    ).toBe('1 запис');
  });
});
