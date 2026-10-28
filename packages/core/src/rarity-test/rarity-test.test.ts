import type { FeatureSwitch, Word } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type Random,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, word } from '../test-support';

/** Three Words of each rarity 1–5 in the Category `test`, ids like `w_r3_1`. */
const threeOfEachRarity: Word[] = [1, 2, 3, 4, 5].flatMap((rarity) =>
  [0, 1, 2].map((index) => word(`w_r${String(rarity)}_${String(index)}`, { rarity })),
);

/** The Core composition over the Words, with the Edition's Feature Switches on but those in `off`. */
async function open({
  words = threeOfEachRarity,
  random = seededRandom(7),
  off = [],
}: {
  words?: readonly Word[];
  random?: Random;
  off?: readonly FeatureSwitch[];
} = {}): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'test', displayName: 'Test' },
        { id: 'other', displayName: 'Other' },
      ],
      words: [...words],
      corrections: [],
    }),
    edition: {
      id: 'test',
      userSettingDefaults: {
        mix: {
          categoryIds: 'all',
          correctionCategoryIds: 'all',
          corrections: false,
          idioms: false,
          synonymRows: false,
          tips: false,
        },
        notificationTimes: ['09:00'],
      },
      isFeatureEnabled: (feature) => !off.includes(feature),
      languageTraits: { distractorRule: 'same-part-of-speech' },
    },
    userState: await openUserState({ port: createMemoryUserStatePort() }),
    clock: fakeClock().clock,
    random,
  });
}

/** The ids of a draw's Words. */
const idsOf = async (app: Composition) => (await app.rarityTest.draw()).map((each) => each.wordId);

describe('the Rarity Test draw', () => {
  it('draws 2 Words of each rarity, the commonest first, each as its Lemma with Stress', async () => {
    const app = await open();

    const drawn = await app.rarityTest.draw();

    expect(drawn.map((each) => each.rarity)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(new Set(drawn.map((each) => each.wordId)).size).toBe(10);
    for (const { wordId, rarity } of drawn) expect(wordId).toMatch(`w_r${String(rarity)}_`);
    const first = drawn[0];
    expect(first?.lemmaWithStress).toBe(
      `${first?.wordId.slice(2, 3) ?? ''}́${first?.wordId.slice(3) ?? ''}`,
    );
  });

  it('draws the same Words for the same seed', async () => {
    const once = await idsOf(await open({ random: seededRandom(42) }));
    const again = await idsOf(await open({ random: seededRandom(42) }));

    expect(again).toEqual(once);
  });

  it('draws other Words for another seed', async () => {
    const seeds = [1, 2, 3, 4, 5];
    const draws = await Promise.all(
      seeds.map(async (seed) => (await idsOf(await open({ random: seededRandom(seed) }))).join()),
    );

    expect(new Set(draws).size).toBeGreaterThan(1);
  });

  it('takes the one Word of a rarity that has only one', async () => {
    const words = threeOfEachRarity.filter(({ id }) => !['w_r4_0', 'w_r4_1'].includes(id));

    const drawn = await (await open({ words })).rarityTest.draw();

    expect(drawn.map((each) => each.rarity)).toEqual([1, 1, 2, 2, 3, 3, 4, 5, 5]);
    expect(drawn.filter((each) => each.rarity === 4).map((each) => each.wordId)).toEqual([
      'w_r4_2',
    ]);
  });

  it('ignores the Rarity Floor', async () => {
    const app = await open();
    await app.mix.setRarityFloor(4);

    const drawn = await app.rarityTest.draw();

    expect(drawn.map((each) => each.rarity)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('draws no Retired Word, no Hidden Word and no Word of a Category out of the Mix', async () => {
    const words = [
      word('w_live', { rarity: 1 }),
      word('w_retired', { rarity: 1, retired: true }),
      word('w_hidden', { rarity: 1 }),
      word('w_elsewhere', { rarity: 1, categoryId: 'other' }),
    ];
    const app = await open({ words });
    await app.hide({ kind: 'entry', entryId: 'w_hidden' });
    await app.mix.takeOut('other');

    expect(await idsOf(app)).toEqual(['w_live']);
  });

  it('draws nothing while the Edition turns the Rarity Test or the Rarity Floor off', async () => {
    const withoutTest = await open({ off: ['rarityTest'] });
    const withoutFloor = await open({ off: ['rarityFloor'] });

    expect(await withoutTest.rarityTest.draw()).toEqual([]);
    expect(await withoutFloor.rarityTest.draw()).toEqual([]);
  });
});

describe('the Rarity Test floor', () => {
  /** Answers each drawn Word: «Не знаю» for the rarities in `unknown`, «Знаю» for the rest. */
  const answer = async (app: Composition, unknown: readonly number[] = []) =>
    (await app.rarityTest.draw()).map((drawn) => ({
      ...drawn,
      known: !unknown.includes(drawn.rarity),
    }));

  it('sets the Rarity Floor to the lowest rarity with «Не знаю», at once', async () => {
    const app = await open();
    const answers = (await answer(app, [3, 5])).map((each, index) =>
      each.rarity === 3 && index % 2 === 0 ? { ...each, known: true } : each,
    );

    expect(await app.rarityTest.apply(answers)).toBe(3);
    expect(app.mix.state.rarityFloor).toBe(3);
  });

  it('sets «від 5» when every Word is known', async () => {
    const app = await open();

    expect(await app.rarityTest.apply(await answer(app))).toBe(5);
    expect(app.mix.state.rarityFloor).toBe(5);
  });

  it('sets «від 1» when no Word is known', async () => {
    const app = await open();
    await app.mix.setRarityFloor(4);

    expect(await app.rarityTest.apply(await answer(app, [1, 2, 3, 4, 5]))).toBe(1);
    expect(app.mix.state.rarityFloor).toBe(1);
  });

  it('overwrites the floor on a retake', async () => {
    const app = await open();
    await app.rarityTest.apply(await answer(app, [2]));

    await app.rarityTest.apply(await answer(app, [4]));

    expect(app.mix.state.rarityFloor).toBe(4);
  });

  it('sets no Knowledge Mark, starts no Review and makes nothing Seen', async () => {
    const app = await open();
    const before = app.knowledge.state;

    await app.rarityTest.apply(await answer(app, [3]));

    expect(app.knowledge.state).toEqual(before);
    expect(app.knowledge.weak()).toEqual([]);
    expect(app.history.list).toEqual([]);
    const drawn = await app.rarityTest.draw();
    expect(drawn).not.toEqual([]);
    for (const { wordId } of drawn) {
      const card = await app.entryCard(wordId);
      expect(card?.entryId).toBe(wordId);
      expect(card).not.toHaveProperty('review');
    }
  });

  it('sets nothing while the Edition turns the Rarity Test or the Rarity Floor off', async () => {
    const answers = await answer(await open(), [2]);
    for (const off of [['rarityTest'], ['rarityFloor']] as const) {
      const app = await open({ off });

      expect(await app.rarityTest.apply(answers)).toBeUndefined();
      expect(app.mix.state.rarityFloor).toBe(1);
    }
  });
});
