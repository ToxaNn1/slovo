import { EditionStringsSchema, type Correction, type Word } from '@slovo/contracts';
import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type EntryFeedCard,
} from '@slovo/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { hideChoice } from './hide-choice';

const editionFile = (name: string): unknown =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../editions/uk/${name}`, import.meta.url)), 'utf8'),
  );

const strings = EditionStringsSchema.parse(editionFile('strings.json'));
const ukrainian = loadEdition(editionFile('edition.json'));

const [first] = ukrainian.categories;
if (first === undefined) throw new Error('The Edition needs Categories');

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
  sources: [{ title: 'Test source' }],
  retired: false,
};

async function open(): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort({ words: [word], corrections: [correction] }),
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

async function cardOf(app: Composition, entryId: string): Promise<EntryFeedCard> {
  const card = await app.entryCard(entryId);
  if (card === undefined) throw new Error(`No card for ${entryId}`);
  return card;
}

const choiceOn = (app: Composition, card: EntryFeedCard) =>
  hideChoice({ card, mix: app.mix.state, edition: ukrainian, strings: strings.hiding });

describe('the hide choice', () => {
  it('offers a Word card’s Entry and its Category, named, with the Category’s toast', async () => {
    const app = await open();

    const choice = choiceOn(app, await cardOf(app, word.id));

    expect(choice).toEqual([
      { kind: 'entry', label: 'Не показувати цей запис' },
      {
        kind: 'category',
        categoryId: first.id,
        label: `Не показувати категорію «${first.displayName}»`,
        toast: `Категорію «${first.displayName}» приховано`,
      },
    ]);
  });

  it('leaves the Category out when it is the last Category in the Mix', async () => {
    const app = await open();
    for (const { id } of ukrainian.categories) {
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

  it('offers a Correction card’s Entry and Corrections as a whole, with their toast', async () => {
    const app = await open();

    const choice = choiceOn(app, await cardOf(app, correction.id));

    expect(choice).toEqual([
      { kind: 'entry', label: 'Не показувати цей запис' },
      { kind: 'corrections', label: 'Не показувати Виправлення', toast: 'Виправлення приховано' },
    ]);
  });

  it('leaves Corrections out when they are out of the Mix already', async () => {
    const app = await open();
    await app.mix.setCorrections(false);

    const choice = choiceOn(app, await cardOf(app, correction.id));

    expect(choice.map(({ kind }) => kind)).toEqual(['entry']);
  });
});
