import { type Word } from '@slovo/contracts';
import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type Random,
} from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { collectionRows } from './collections-screen';
import { count, fakeClock, strings, ukrainian } from '../test-support';

const [category] = ukrainian.categories;
if (category === undefined) throw new Error('The Edition needs a Category');
const categoryId = category.id;

function word(id: string, lemma: string): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress: [],
    partOfSpeech: 'noun',
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
  };
}

const content = createMemoryContentPort({
  words: [word('w_one', 'веремія'), word('w_two', 'гармидер')],
  corrections: [],
});

/** A random port that gives a new number each call, so each Collection gets its own id. */
function steppingRandom(): Random {
  let step = 0;
  return {
    next() {
      step += 1;
      return (step * 0.6180339887) % 1;
    },
  };
}

async function open(): Promise<{ app: Composition; advance: () => void }> {
  const time = fakeClock();
  const app = await openComposition({
    content,
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: time.clock,
    random: steppingRandom(),
  });
  return {
    app,
    advance: () => {
      time.advance(60_000);
    },
  };
}

/** Makes a Collection; fails the test when its name is refused. */
async function create(app: Composition, name: string, entryId?: string): Promise<string> {
  const result = await app.collections.create(name, entryId);
  if (!result.ok) throw new Error(`The name ${name} was refused: ${result.reason}`);
  return result.collection.id;
}

const rowsOf = (app: Composition) =>
  collectionRows({ collections: app.collections.list, strings: strings.collections, count });

describe('the «Колекції» screen', () => {
  it('has no rows while there are no Collections', async () => {
    const { app } = await open();

    expect(rowsOf(app)).toEqual([]);
  });

  it('lists the Collections newest first, each with its Entry count and newest Lemmas', async () => {
    const { app, advance } = await open();
    const reading = await create(app, 'Читання', 'w_one');
    advance();
    await app.collections.add(reading, 'w_two');
    advance();
    const empty = await create(app, 'Порожня');

    expect(rowsOf(app)).toEqual([
      {
        id: empty,
        name: 'Порожня',
        count: '0 записів',
        lemmas: [],
        accessibilityLabel: 'Порожня, 0 записів',
        renameLabel: 'Перейменувати «Порожня»',
        deleteLabel: 'Видалити «Порожня»',
      },
      {
        id: reading,
        name: 'Читання',
        count: '2 записи',
        lemmas: ['гармидер', 'веремія'],
        accessibilityLabel: 'Читання, 2 записи: гармидер, веремія',
        renameLabel: 'Перейменувати «Читання»',
        deleteLabel: 'Видалити «Читання»',
      },
    ]);
  });

  it('follows a rename', async () => {
    const { app } = await open();
    const id = await create(app, 'Читання', 'w_one');

    await app.collections.rename(id, 'Улюблене');

    expect(
      rowsOf(app).map(({ name, accessibilityLabel }) => ({ name, accessibilityLabel })),
    ).toEqual([{ name: 'Улюблене', accessibilityLabel: 'Улюблене, 1 запис: веремія' }]);
  });
});
