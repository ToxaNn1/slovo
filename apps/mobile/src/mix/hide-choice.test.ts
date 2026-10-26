import { type Correction, type Idiom, type Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  featureOfKind,
  openComposition,
  openUserState,
  type Composition,
  type Edition,
  type EntryFeedCard,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { hideChoice, hideToast } from './hide-choice';
import { strings, ukrainian } from '../test-support';

/** The Language Pack's Categories, in its order. */
const first = { id: 'nature-weather', displayName: 'Природа і погода' };
const categories = [first, { id: 'household-crafts', displayName: 'Побут і ремесла' }];
/** The Language Pack's Categories of Corrections, a list of their own (ADR 0050). */
const everyday = { id: 'everyday', displayName: 'Щодня' };
const correctionCategories = [everyday, { id: 'work', displayName: 'На роботі' }];

const word: Word = {
  kind: 'word',
  id: 'w_test',
  lemma: 'слово',
  stress: [2],
  partOfSpeech: 'noun',
  primaryDefinition: 'Одиниця мови.',
  extraDefinitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: first.id,
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
};

const correction: Correction = {
  kind: 'correction',
  id: 'c_test',
  nonStandardForm: 'приймати участь',
  correctionType: 'calque',
  standardEquivalents: ['брати участь'],
  explanation: 'Калька.',
  examplePair: { nonStandard: 'Приймати участь.', standard: 'Брати участь.' },
  categoryId: 'everyday',
  sources: [{ title: 'Test source' }],
  literaryUses: [],
  retired: false,
};

const idiom: Idiom = {
  kind: 'idiom',
  id: 'i_test',
  expression: 'бити байдики',
  idiomType: 'idiom',
  primaryDefinition: 'Ледарювати.',
  extraDefinitions: [],
  examples: [],
  sources: [{ title: 'Test source' }],
  retired: false,
};

async function open(): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort({
      categories,
      correctionCategories,
      words: [word],
      corrections: [correction],
      idioms: [idiom],
    }),
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0.25 },
  });
}

async function cardOf(app: Composition, entryId: string): Promise<EntryFeedCard> {
  const card = await app.entryCard(entryId);
  if (card === undefined || card.kind === 'synonymRow' || card.kind === 'tip')
    throw new Error(`No card of a Word, a Correction or an Idiom for ${entryId}`);
  return card;
}

const choiceOn = (
  app: Composition,
  card: EntryFeedCard,
  edition: Pick<Edition, 'isFeatureEnabled'> = ukrainian,
) => hideChoice({ card, mix: app.mix.state, edition, strings });

describe('the hide choice', () => {
  it('offers a Word card’s Entry and its Category, named, with the Category’s toast', async () => {
    const app = await open();

    const choice = choiceOn(app, await cardOf(app, word.id));

    expect(choice).toEqual([
      {
        kind: 'entry',
        target: { kind: 'entry', entryId: word.id },
        label: 'Не показувати цей запис',
      },
      {
        kind: 'category',
        target: { kind: 'category', categoryId: first.id },
        label: `Не показувати категорію «${first.displayName}»`,
        toast: `Категорію «${first.displayName}» приховано`,
      },
    ]);
  });

  it('leaves the Category out when it is the last Category in the Mix', async () => {
    const app = await open();
    for (const { id } of categories) {
      if (id !== first.id) await app.mix.takeOut(id);
    }

    const choice = choiceOn(app, await cardOf(app, word.id));

    expect(choice.map(({ kind }) => kind)).toEqual(['entry']);
  });

  it('leaves the Category out when it is out of the Mix already, as on a list’s Entry screen', async () => {
    const app = await open();
    await app.mix.takeOut(first.id);

    expect(choiceOn(app, await cardOf(app, word.id)).map(({ kind }) => kind)).toEqual(['entry']);
  });

  it('offers a Correction card’s Entry, its Category of Corrections and Corrections as a whole, with their toasts', async () => {
    const app = await open();

    const choice = choiceOn(app, await cardOf(app, correction.id));

    expect(choice).toEqual([
      {
        kind: 'entry',
        target: { kind: 'entry', entryId: correction.id },
        label: 'Не показувати цей запис',
      },
      {
        kind: 'category',
        target: { kind: 'category', categoryId: everyday.id, of: 'correction' },
        label: `Не показувати категорію «${everyday.displayName}»`,
        toast: `Категорію «${everyday.displayName}» приховано`,
      },
      {
        kind: 'whole-kind',
        target: { kind: 'whole-kind', entryKind: 'correction' },
        label: 'Не показувати Виправлення',
        toast: 'Виправлення приховано',
      },
    ]);
  });

  it('offers the last Category of Corrections in the Mix disabled, saying why', async () => {
    const app = await open();
    await app.mix.takeOut('work', 'correction');

    const choice = choiceOn(app, await cardOf(app, correction.id));

    expect(choice.map(({ kind }) => kind)).toEqual(['entry', 'category', 'whole-kind']);
    expect(choice[1]).toMatchObject({
      label: `Не показувати категорію «${everyday.displayName}»`,
      disabledHint: strings.mix.corrections.lastCategoryHint,
    });
  });

  it('leaves the Category of Corrections out when it is out of the Mix already', async () => {
    const app = await open();
    await app.mix.takeOut(everyday.id, 'correction');

    const choice = choiceOn(app, await cardOf(app, correction.id));

    expect(choice.map(({ kind }) => kind)).toEqual(['entry', 'whole-kind']);
  });

  it('leaves Corrections out when they are out of the Mix already', async () => {
    const app = await open();
    await app.mix.setKind('correction', false);

    const choice = choiceOn(app, await cardOf(app, correction.id));

    expect(choice.map(({ kind }) => kind)).toEqual(['entry']);
  });

  it('offers an Idiom card’s Entry and Idioms as a whole, with their toast', async () => {
    const app = await open();

    const choice = choiceOn(app, await cardOf(app, idiom.id));

    expect(choice).toEqual([
      {
        kind: 'entry',
        target: { kind: 'entry', entryId: idiom.id },
        label: 'Не показувати цей запис',
      },
      {
        kind: 'whole-kind',
        target: { kind: 'whole-kind', entryKind: 'idiom' },
        label: 'Не показувати Фразеологізми',
        toast: 'Фразеологізми приховано',
      },
    ]);
  });

  it('leaves Idioms out when they are out of the Mix already', async () => {
    const app = await open();
    await app.mix.setKind('idiom', false);

    const choice = choiceOn(app, await cardOf(app, idiom.id));

    expect(choice.map(({ kind }) => kind)).toEqual(['entry']);
  });

  describe.each([
    ['Corrections', 'correction', correction.id],
    ['Idioms', 'idiom', idiom.id],
  ] as const)('by the Feature Switch of %s', (_name, entryKind, entryId) => {
    const feature = featureOfKind(entryKind);

    it('offers the kind as a whole while the switch is on', async () => {
      const app = await open();

      const choice = choiceOn(app, await cardOf(app, entryId), {
        isFeatureEnabled: (each) => each === feature,
      });

      expect(choice.map(({ kind }) => kind)).toEqual(
        entryKind === 'correction' ? ['entry', 'category', 'whole-kind'] : ['entry', 'whole-kind'],
      );
    });

    it('offers only the Entry while the switch is off', async () => {
      const app = await open();

      const choice = choiceOn(app, await cardOf(app, entryId), {
        isFeatureEnabled: (each) => each !== feature,
      });

      expect(choice.map(({ kind }) => kind)).toEqual(['entry']);
    });
  });
});

describe('the toast of a hide', () => {
  const toastAfter = async (app: Composition, entryId: string, index: number) => {
    const option = choiceOn(app, await cardOf(app, entryId))[index];
    if (option === undefined) throw new Error(`No option ${String(index)}`);
    const result = await app.hide(option.target);
    if (result === undefined) throw new Error('Nothing was hidden');
    return hideToast({ option, changed: result.changed, strings: strings.hiding });
  };

  it('names the hidden Entry by its title', async () => {
    const app = await open();

    expect(await toastAfter(app, word.id, 0)).toBe('«сло\u0301во» приховано');
  });

  it('is the Category’s toast for a hidden Category', async () => {
    const app = await open();

    expect(await toastAfter(app, word.id, 1)).toBe(`Категорію «${first.displayName}» приховано`);
  });

  it('is the Category’s toast for a hidden Category of Corrections, which is out of the Mix then', async () => {
    const app = await open();

    expect(await toastAfter(app, correction.id, 1)).toBe(
      `Категорію «${everyday.displayName}» приховано`,
    );
    expect(app.mix.state.correctionCategories.categoryIds).toEqual(['work']);
    expect(app.mix.state.categoryIds).toHaveLength(categories.length);
  });

  it('is the Corrections toast for hidden Corrections', async () => {
    const app = await open();

    expect(await toastAfter(app, correction.id, 2)).toBe('Виправлення приховано');
  });

  it('is the Idioms toast for hidden Idioms, which are out of the Mix then', async () => {
    const app = await open();

    expect(await toastAfter(app, idiom.id, 1)).toBe('Фразеологізми приховано');
    expect(app.mix.state.kinds.idiom).toBe(false);
  });
});
