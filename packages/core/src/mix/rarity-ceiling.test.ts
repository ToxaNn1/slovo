import { RARITIES, type FeatureSwitch, type Rarity, type Word } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type UserStatePort,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word } from '../test-support';

/** Two Words of each rarity 1–5 in the Category `test`, ids like `w_r3_1`. */
const twoOfEachRarity: Word[] = RARITIES.flatMap((rarity) =>
  [0, 1].map((index) => word(`w_r${String(rarity)}_${String(index)}`, { rarity })),
);

/** The Core composition over the Words, with every Feature Switch on but those in `off`. */
async function open({
  off = [],
  port = createMemoryUserStatePort(),
  ceiling = 5,
}: {
  off?: readonly FeatureSwitch[];
  port?: UserStatePort;
  ceiling?: Rarity;
} = {}): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'test', displayName: 'Test' }],
      words: twoOfEachRarity,
      corrections: [],
    }),
    edition: testEdition({
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds: 'all',
          corrections: false,
          idioms: false,
          synonymRows: false,
          tips: false,
          rarityCeiling: ceiling,
        },
        notificationTimes: ['09:00'],
      },
    }),
    userState: await openUserState({ port }),
    clock: fakeClock().clock,
    random: seededRandom(11),
  });
}

/** The rarities of every Word the Feed offers until it repeats or runs out. */
async function raritiesInFeed(app: Composition): Promise<Set<number>> {
  const seen = new Set(app.feed.cards.flatMap((card) => card.entryId ?? []));
  for (;;) {
    const id = (await app.feed.next())?.entryId;
    if (id === undefined || seen.has(id)) break;
    seen.add(id);
  }
  return new Set([...seen].map((id) => Number(id.slice(3, 4))));
}

/** The Rarity Test's answers: «Не знаю» on the rarities in `unknown`, «Знаю» on the rest. */
const answer = async (app: Composition, unknown: readonly number[]) =>
  (await app.rarityTest.draw()).map(({ rarity }) => ({ rarity, known: !unknown.includes(rarity) }));

describe('the Rarity Ceiling', () => {
  it('starts at the Edition default, «до 5», with every rarity in the Feed', async () => {
    const app = await open();

    expect(app.mix.state.rarityCeiling).toBe(5);
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('lets no Word above it into the Feed', async () => {
    const app = await open();

    await app.mix.setRarityFloor(2);
    await app.mix.setRarityCeiling(3);

    expect(app.mix.state.rarityCeiling).toBe(3);
    expect(await raritiesInFeed(app)).toEqual(new Set([2, 3]));
  });

  it('refuses a ceiling below the floor and a floor above the ceiling, and stores neither', async () => {
    const records = createMemoryUserStatePort();
    const app = await open({ port: records });
    await app.mix.setRarityFloor(3);
    await app.mix.setRarityCeiling(4);

    await app.mix.setRarityCeiling(2);
    await app.mix.setRarityFloor(5);

    expect(app.mix.state).toMatchObject({ rarityFloor: 3, rarityCeiling: 4 });
    const reopened = await open({ port: records });
    expect(reopened.mix.state).toMatchObject({ rarityFloor: 3, rarityCeiling: 4 });
  });

  it('skips a ceiling that is not a rarity', async () => {
    const app = await open();

    await app.mix.setRarityCeiling(0);
    await app.mix.setRarityCeiling(2.5);

    expect(app.mix.state.rarityCeiling).toBe(5);
  });

  it('reads a stored floor above the ceiling, as a merge could leave, with the ceiling raised to it', async () => {
    const port = createMemoryUserStatePort();
    const phone = await open({ port });
    await phone.mix.setRarityCeiling(2);
    // Another device set the floor while its ceiling was higher.
    const userState = await openUserState({ port });
    await userState.write(new Map([['mix.rarityFloor', '4']]));

    const app = await open({ port });

    expect(app.mix.state).toMatchObject({ rarityFloor: 4, rarityCeiling: 4 });
    expect(await raritiesInFeed(app)).toEqual(new Set([4]));
  });

  it('is raised by a Rarity Test that sets the floor above it, so the result always applies', async () => {
    const app = await open();
    await app.mix.setRarityCeiling(2);

    expect(await app.rarityTest.apply(await answer(app, [4, 5]))).toBe(4);

    expect(app.mix.state).toMatchObject({ rarityFloor: 4, rarityCeiling: 4 });
    expect(await raritiesInFeed(app)).toEqual(new Set([4]));
  });

  it('stays as it is after a Rarity Test that sets the floor at it or below', async () => {
    const app = await open();
    await app.mix.setRarityCeiling(3);

    expect(await app.rarityTest.apply(await answer(app, [2]))).toBe(2);

    expect(app.mix.state).toMatchObject({ rarityFloor: 2, rarityCeiling: 3 });
  });

  it('draws the Rarity Test from every rarity, the ceiling aside', async () => {
    const app = await open({ ceiling: 2 });

    const drawn = await app.rarityTest.draw();

    expect(drawn.map(({ rarity }) => rarity)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  describe('while the Edition turns the rarityCeiling switch off', () => {
    it('lets every Word from the floor up into the Feed, as before 1.0', async () => {
      const app = await open({ off: ['rarityCeiling'], ceiling: 2 });

      expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3, 4, 5]));
    });

    it('skips a ceiling and takes any floor', async () => {
      const app = await open({ off: ['rarityCeiling'] });

      await app.mix.setRarityCeiling(3);
      expect(app.mix.state.rarityCeiling).toBe(5);

      await app.mix.setRarityFloor(2);
      await app.mix.setRarityFloor(5);
      expect(app.mix.state.rarityFloor).toBe(5);
      expect(await raritiesInFeed(app)).toEqual(new Set([5]));
    });
  });
});
