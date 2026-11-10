import { RARITIES, type FeatureSwitch, type Rarity, type Word } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { openComposition, type Composition, type UserStatePort } from '../index';
import { createMemoryContentPort } from '../testing';
import {
  correction,
  fakeClock,
  openLiveEntries,
  seededRandom,
  testEdition,
  word,
} from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** Two Words of each rarity 1–5 in the Category `test`, ids like `w_r3_1`. */
const twoOfEachRarity: Word[] = RARITIES.flatMap((rarity) =>
  [0, 1].map((index) => word(`w_r${String(rarity)}_${String(index)}`, { rarity })),
);

interface Options {
  /** The Feature Switches the Edition turns off; every other one is on. */
  off?: readonly FeatureSwitch[];
  port?: UserStatePort;
  /** The Edition's default Rarity Ceiling. */
  ceiling?: Rarity;
}

/** The Language Pack: the Words and one Correction, which has no rarity. */
const content = () =>
  createMemoryContentPort({
    categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
    words: twoOfEachRarity,
    corrections: [correction('c_1')],
  });

const edition = ({ off = [], ceiling = 5 }: Options) =>
  testEdition({
    isFeatureEnabled: (feature) => !off.includes(feature),
    userSettingDefaults: {
      rarityCeiling: ceiling,
      mix: {
        categoryIds: 'all',
        kinds: { correction: true, idiom: false, synonymRow: false, tip: false },
      },
      notificationTimes: ['09:00'],
    },
  });

/** The Core composition over the Words, with every Feature Switch on but those in `off`. */
async function open(options: Options = {}): Promise<Composition> {
  const { port = createMemoryUserStatePort() } = options;
  return openComposition({
    content: content(),
    edition: edition(options),
    userState: await openUserState({ port }),
    clock: fakeClock().clock,
    random: seededRandom(11),
  });
}

/** The ids of every Entry among the first 40 cards the Feed offers, past the cards of no Entry (a Quick Question): a Cycle over 11 Entries at most, so each eligible one. */
async function idsInFeed(app: Composition): Promise<Set<string>> {
  const seen = new Set(app.feed.cards.flatMap((card) => card.entryId ?? []));
  for (let count = 0; count < 40; count += 1) {
    const card = await app.feed.next();
    if (card === undefined) break;
    if (card.entryId !== undefined) seen.add(card.entryId);
  }
  return seen;
}

/** The rarities of every Word the Feed offers until it repeats or runs out. */
async function raritiesInFeed(app: Composition): Promise<Set<number>> {
  const ids = [...(await idsInFeed(app))].filter((id) => id.startsWith('w_'));
  return new Set(ids.map((id) => Number(id.slice(3, 4))));
}

/** The Rarity Test's answers: «Не знаю» on the rarities in `unknown`, «Знаю» on the rest. */
const answer = async (app: Composition, unknown: readonly number[]) =>
  (await app.rarityTest.draw()).map(({ rarity }) => ({ rarity, known: !unknown.includes(rarity) }));

describe('the Rarity Ceiling', () => {
  it('starts at the Edition default, «до 5», with every rarity in the Feed', async () => {
    const app = await open();

    expect(app.rarityCeiling.state).toBe(5);
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('lets no Word above it into the Feed, and a Correction, which has no rarity, stays', async () => {
    const app = await open();

    await app.rarityCeiling.set(3);

    expect(app.rarityCeiling.state).toBe(3);
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3]));
    expect((await idsInFeed(app)).has('c_1')).toBe(true);
  });

  it('tells its subscribers of a change and keeps it for the next session', async () => {
    const records = createMemoryUserStatePort();
    const app = await open({ port: records });
    const told: Rarity[] = [];
    app.rarityCeiling.subscribe(() => told.push(app.rarityCeiling.state));

    await app.rarityCeiling.set(2);

    expect(told).toEqual([2]);
    const reopened = await open({ port: records });
    expect(reopened.rarityCeiling.state).toBe(2);
    expect(await raritiesInFeed(reopened)).toEqual(new Set([1, 2]));
  });

  it('tells its subscribers once the Feed holds no Word above the new ceiling', async () => {
    const app = await open();
    await app.feed.show(0);
    await app.feed.show(1);
    const raritiesHeld = () =>
      app.feed.cards.flatMap((card) =>
        card.entryId?.startsWith('w_') === true ? [Number(card.entryId.slice(3, 4))] : [],
      );
    expect(raritiesHeld().some((rarity) => rarity > 2)).toBe(true);
    const told: number[][] = [];
    app.rarityCeiling.subscribe(() => told.push(raritiesHeld()));

    await app.rarityCeiling.set(2);

    expect(told).toHaveLength(1);
    expect(told[0]?.filter((rarity) => rarity > 2)).toEqual([]);
  });

  it('skips a ceiling that is not a rarity', async () => {
    const app = await open();

    await app.rarityCeiling.set(0);
    await app.rarityCeiling.set(2.5);
    await app.rarityCeiling.set(6);

    expect(app.rarityCeiling.state).toBe(5);
  });

  it('bounds the Words the Daily Crossword picks from: the live Words up to it, Hidden ones included, in pack order', async () => {
    const port = createMemoryUserStatePort();
    const app = await open({ port });
    await app.rarityCeiling.set(2);
    await app.hide({ kind: 'entry', entryId: 'w_r1_1' });
    const { entries } = await openLiveEntries({
      content: content(),
      edition: edition({}),
      userState: await openUserState({ port }),
    });

    const words = await entries.wordsUnderRarityCeiling();

    expect(words.map(({ id }) => id)).toEqual(['w_r1_0', 'w_r1_1', 'w_r2_0', 'w_r2_1']);
  });

  it('is set by the Rarity Test to the lowest rarity the reader does not know', async () => {
    const app = await open();

    expect(await app.rarityTest.apply(await answer(app, [4, 5]))).toBe(4);

    expect(app.rarityCeiling.state).toBe(4);
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3, 4]));
  });

  it('is set to «до 5» by a Rarity Test the reader knows every Word of', async () => {
    const app = await open({ ceiling: 2 });

    expect(await app.rarityTest.apply(await answer(app, []))).toBe(5);

    expect(app.rarityCeiling.state).toBe(5);
  });

  it('draws the Rarity Test from every rarity, the ceiling aside', async () => {
    const app = await open({ ceiling: 2 });

    const drawn = await app.rarityTest.draw();

    expect(drawn.map(({ rarity }) => rarity)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('keeps the Ceiling a 1.0 app stored in the Mix and drops its Rarity Floor', async () => {
    const records = new Map([
      ['schema.version', '6'],
      ['app.installed', 'true'],
      ['mix.rarityFloor', '2'],
      ['mix.rarityCeiling', '3'],
    ]);

    const app = await open({ port: createMemoryUserStatePort(records) });

    expect(app.rarityCeiling.state).toBe(3);
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3]));
    expect(records.get('settings.rarityCeiling')).toBe('3');
    expect(records.get('sync.pending.settings.rarityCeiling')).toBe(
      '{"changedAt":"1970-01-01T00:00:00.000Z","value":"3"}',
    );
    expect(records.has('mix.rarityFloor')).toBe(false);
    expect(records.has('mix.rarityCeiling')).toBe(false);
    expect(records.get('schema.version')).toBe('7');
  });

  it('starts at the Edition default when a 1.0 app stored no Ceiling, or one that does not read', async () => {
    for (const stored of [undefined, '"3"', '7']) {
      const records = new Map([['schema.version', '6']]);
      if (stored !== undefined) records.set('mix.rarityCeiling', stored);

      const app = await open({ port: createMemoryUserStatePort(records) });

      expect(app.rarityCeiling.state, stored).toBe(5);
      expect(records.has('settings.rarityCeiling'), stored).toBe(false);
      expect(records.has('mix.rarityCeiling'), stored).toBe(false);
    }
  });

  describe('while the Edition turns the rarityCeiling switch off', () => {
    it('lets every Word into the Feed, as before 1.0, and skips a ceiling', async () => {
      const app = await open({ off: ['rarityCeiling'], ceiling: 2 });

      await app.rarityCeiling.set(3);

      expect(app.rarityCeiling.state).toBe(5);
      expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3, 4, 5]));
    });

    it('draws no Rarity Test and sets nothing by one', async () => {
      const app = await open({ off: ['rarityCeiling'] });

      expect(await app.rarityTest.draw()).toEqual([]);
      expect(await app.rarityTest.apply([{ rarity: 2, known: false }])).toBeUndefined();
    });
  });
});
