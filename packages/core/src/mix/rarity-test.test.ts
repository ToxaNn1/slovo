import { RARITIES, type FeatureSwitch, type Word } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { openComposition, type Composition, type Random } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** Three Words of each rarity 1–5 in the Category `test`, ids like `w_r3_1`. */
const threeOfEachRarity: Word[] = RARITIES.flatMap((rarity) =>
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
        { id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' },
        { id: 'other', displayName: 'Other', description: 'Other.', tone: 'loud' },
      ],
      words: [...words],
      corrections: [],
    }),
    edition: testEdition({
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds: 'all',
          kinds: { correction: false, idiom: false, synonymRow: false, tip: false },
        },
        notificationTimes: ['09:00'],
      },
    }),
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

  it('ignores the Rarity Range', async () => {
    const app = await open();
    await app.rarityRange.set({ from: 1, to: 2 });

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

  it('draws nothing while the Edition turns the Rarity Test or the Rarity Range off', async () => {
    const withoutTest = await open({ off: ['rarityTest'] });
    const withoutCeiling = await open({ off: ['rarityCeiling'] });

    expect(await withoutTest.rarityTest.draw()).toEqual([]);
    expect(await withoutCeiling.rarityTest.draw()).toEqual([]);
  });
});

describe('the Rarity Test result', () => {
  /**
   * Answers each drawn Word: «Не знаю» for both Words of the rarities in
   * `unknown` and for the first Word of those in `halfKnown`, «Знаю» for the rest.
   */
  const answer = async (
    app: Composition,
    unknown: readonly number[] = [],
    halfKnown: readonly number[] = [],
  ) => {
    const drawn = await app.rarityTest.draw();
    return drawn.map((each, index) => ({
      ...each,
      known:
        !unknown.includes(each.rarity) &&
        !(halfKnown.includes(each.rarity) && drawn[index - 1]?.rarity !== each.rarity),
    }));
  };

  it('sets the Rarity Range, at once, to the highest rarity with half of its Words known', async () => {
    const app = await open();

    // Both Words of rarity 4 and 5 are not known; one of rarity 3 is.
    expect(await app.rarityTest.apply(await answer(app, [4, 5], [3]))).toEqual({
      top: 3,
      changed: true,
      known: 5,
      total: 10,
    });
    expect(app.rarityRange.state).toEqual({ from: 1, to: 3 });
  });

  it('keeps a rarity for one «Не знаю» of its two Words', async () => {
    const app = await open();

    expect((await app.rarityTest.apply(await answer(app, [], [1, 5])))?.top).toBe(5);
    expect(app.rarityRange.state).toEqual({ from: 1, to: 5 });
  });

  it('takes the highest rarity known, whatever the reader missed below it', async () => {
    const app = await open();

    // Rare Words known, commoner ones not: 5 of 10, as in the owner's pass.
    expect(await app.rarityTest.apply(await answer(app, [1, 2], [3, 4, 5]))).toEqual({
      top: 5,
      changed: false,
      known: 3,
      total: 10,
    });
    expect((await app.rarityTest.apply(await answer(app, [1, 3, 5])))?.top).toBe(4);
  });

  it('sets «від 1 до 5» when every Word is known', async () => {
    const app = await open();
    await app.rarityRange.set({ from: 1, to: 2 });

    expect(await app.rarityTest.apply(await answer(app))).toEqual({
      top: 5,
      changed: true,
      known: 10,
      total: 10,
    });
    expect(app.rarityRange.state).toEqual({ from: 1, to: 5 });
  });

  it('sets «лише 1» when no Word is known', async () => {
    const app = await open();

    expect(await app.rarityTest.apply(await answer(app, [1, 2, 3, 4, 5]))).toEqual({
      top: 1,
      changed: true,
      known: 0,
      total: 10,
    });
    expect(app.rarityRange.state).toEqual({ from: 1, to: 1 });
  });

  it('counts a rarity by the Words asked of it', async () => {
    const app = await open({
      words: threeOfEachRarity.filter(({ id }) => id !== 'w_r5_0' && id !== 'w_r5_1'),
    });

    // The one Word of rarity 5 is not known, one of the two of rarity 4 is.
    expect((await app.rarityTest.apply(await answer(app, [5], [4])))?.top).toBe(4);
  });

  it('says whether the Rarity Range changed', async () => {
    const app = await open();
    await app.rarityRange.set({ from: 2, to: 4 });

    // The bottom goes back to 1, so the range changed though its top did not.
    expect((await app.rarityTest.apply(await answer(app, [5])))?.changed).toBe(true);
    expect((await app.rarityTest.apply(await answer(app, [5])))?.changed).toBe(false);
    expect(app.rarityRange.state).toEqual({ from: 1, to: 4 });
  });

  it('overwrites the range on a retake', async () => {
    const app = await open();
    await app.rarityTest.apply(await answer(app, [2, 3, 4, 5]));

    await app.rarityTest.apply(await answer(app, [5]));

    expect(app.rarityRange.state).toEqual({ from: 1, to: 4 });
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

  it('sets nothing while the Edition turns the Rarity Test or the Rarity Range off', async () => {
    const answers = await answer(await open(), [2]);
    for (const off of [['rarityTest'], ['rarityCeiling']] as const) {
      const app = await open({ off });

      expect(await app.rarityTest.apply(answers)).toBeUndefined();
      expect(app.rarityRange.state).toEqual({ from: 1, to: 5 });
    }
  });
});
