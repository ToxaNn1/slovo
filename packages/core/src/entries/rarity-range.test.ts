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
  /** The Edition's default top of the Rarity Range. */
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

describe('the Rarity Range', () => {
  it('starts from 1 to the Edition default top, «від 1 до 5», with every rarity in the Feed', async () => {
    const app = await open();

    expect(app.rarityRange.state).toEqual({ from: 1, to: 5 });
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('lets no Word above it into the Feed, and a Correction, which has no rarity, stays', async () => {
    const app = await open();

    await app.rarityRange.set({ from: 1, to: 3 });

    expect(app.rarityRange.state).toEqual({ from: 1, to: 3 });
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3]));
    expect((await idsInFeed(app)).has('c_1')).toBe(true);
  });

  it('lets no Word below its bottom into the Feed either: «від 2 до 4»', async () => {
    const app = await open();

    await app.rarityRange.set({ from: 2, to: 4 });

    expect(app.rarityRange.state).toEqual({ from: 2, to: 4 });
    expect(await raritiesInFeed(app)).toEqual(new Set([2, 3, 4]));
    expect((await idsInFeed(app)).has('c_1')).toBe(true);
  });

  it('holds a single rarity, «лише 3»', async () => {
    const app = await open();

    await app.rarityRange.set({ from: 3, to: 3 });

    expect(await raritiesInFeed(app)).toEqual(new Set([3]));
  });

  it('skips a range whose bottom is above its top', async () => {
    const app = await open();

    await app.rarityRange.set({ from: 4, to: 2 });

    expect(app.rarityRange.state).toEqual({ from: 1, to: 5 });
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
    app.rarityRange.subscribe(() => told.push(raritiesHeld()));

    await app.rarityRange.set({ from: 1, to: 2 });

    expect(told).toHaveLength(1);
    expect(told[0]?.filter((rarity) => rarity > 2)).toEqual([]);
  });

  it('skips a range whose ends are not rarities', async () => {
    const app = await open();

    await app.rarityRange.set({ from: 1, to: 0 });
    await app.rarityRange.set({ from: 1, to: 2.5 });
    await app.rarityRange.set({ from: 1, to: 6 });
    await app.rarityRange.set({ from: 0, to: 3 });

    expect(app.rarityRange.state).toEqual({ from: 1, to: 5 });
  });

  it('bounds the Words the Daily Crossword picks from: the live Words in it, Hidden ones included, in pack order', async () => {
    const port = createMemoryUserStatePort();
    const app = await open({ port });
    await app.rarityRange.set({ from: 2, to: 3 });
    await app.hide({ kind: 'entry', entryId: 'w_r2_1' });
    const { entries } = await openLiveEntries({
      content: content(),
      edition: edition({}),
      userState: await openUserState({ port }),
    });

    const words = await entries.wordsInRarityRange();

    expect(words.map(({ id }) => id)).toEqual(['w_r2_0', 'w_r2_1', 'w_r3_0', 'w_r3_1']);
  });

  it('is set by the Rarity Test from 1 to the highest rarity the reader knows', async () => {
    const app = await open();
    await app.rarityRange.set({ from: 3, to: 5 });

    expect((await app.rarityTest.apply(await answer(app, [4, 5])))?.top).toBe(3);

    expect(app.rarityRange.state).toEqual({ from: 1, to: 3 });
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3]));
  });

  it('is set to «від 1 до 5» by a Rarity Test the reader knows every Word of', async () => {
    const app = await open({ ceiling: 2 });

    expect((await app.rarityTest.apply(await answer(app, [])))?.top).toBe(5);

    expect(app.rarityRange.state).toEqual({ from: 1, to: 5 });
  });

  it('draws the Rarity Test from every rarity, the ceiling aside', async () => {
    const app = await open({ ceiling: 2 });

    const drawn = await app.rarityTest.draw();

    expect(drawn.map(({ rarity }) => rarity)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('keeps the Ceiling an early 1.0 app stored in the Mix as the top, and drops its Rarity Floor', async () => {
    const records = new Map([
      ['schema.version', '6'],
      ['app.installed', 'true'],
      ['mix.rarityFloor', '2'],
      ['mix.rarityCeiling', '3'],
    ]);

    const app = await open({ port: createMemoryUserStatePort(records) });

    expect(app.rarityRange.state).toEqual({ from: 1, to: 3 });
    expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3]));
    expect(records.get('settings.rarityRange')).toBe('{"from":1,"to":3}');
    expect(records.get('sync.pending.settings.rarityRange')).toBe(
      '{"changedAt":"1970-01-01T00:00:00.000Z","value":"{\\"from\\":1,\\"to\\":3}"}',
    );
    expect(records.has('settings.rarityCeiling')).toBe(false);
    expect(records.has('mix.rarityFloor')).toBe(false);
    expect(records.has('mix.rarityCeiling')).toBe(false);
    expect(records.get('schema.version')).toBe('10');
  });

  it('starts at the Edition default when an early 1.0 app stored no Ceiling, or one that does not read', async () => {
    for (const stored of [undefined, '"3"', '7']) {
      const records = new Map([['schema.version', '6']]);
      if (stored !== undefined) records.set('mix.rarityCeiling', stored);

      const app = await open({ port: createMemoryUserStatePort(records) });

      expect(app.rarityRange.state, stored).toEqual({ from: 1, to: 5 });
      expect(records.has('settings.rarityRange'), stored).toBe(false);
      expect(records.has('mix.rarityCeiling'), stored).toBe(false);
    }
  });

  it('opens the Rarity Range «до N» an older 1.0 app kept as «від 1 до N», and drops it', async () => {
    const records = new Map([
      ['schema.version', '8'],
      ['app.installed', 'true'],
      ['settings.rarityCeiling', '3'],
      [
        'sync.pending.settings.rarityCeiling',
        '{"changedAt":"2026-11-01T00:00:00.000Z","value":"3"}',
      ],
    ]);

    const app = await open({ port: createMemoryUserStatePort(records) });

    expect(app.rarityRange.state).toEqual({ from: 1, to: 3 });
    expect(records.get('settings.rarityRange')).toBe('{"from":1,"to":3}');
    expect(records.has('sync.pending.settings.rarityRange')).toBe(true);
    expect(records.has('settings.rarityCeiling')).toBe(false);
    expect(records.has('sync.pending.settings.rarityCeiling')).toBe(false);
  });

  it('drops a Rarity Range that does not read and starts at the Edition default', async () => {
    const records = new Map([
      ['schema.version', '8'],
      ['app.installed', 'true'],
      ['settings.rarityCeiling', '7'],
    ]);

    const app = await open({ port: createMemoryUserStatePort(records), ceiling: 4 });

    expect(app.rarityRange.state).toEqual({ from: 1, to: 4 });
    expect(records.has('settings.rarityCeiling')).toBe(false);
    expect(records.has('settings.rarityRange')).toBe(false);
  });

  describe('while the Edition turns the rarityCeiling switch off', () => {
    it('lets every Word into the Feed, as before 1.0, and skips a range', async () => {
      const app = await open({ off: ['rarityCeiling'], ceiling: 2 });

      await app.rarityRange.set({ from: 1, to: 3 });

      expect(app.rarityRange.state).toEqual({ from: 1, to: 5 });
      expect(await raritiesInFeed(app)).toEqual(new Set([1, 2, 3, 4, 5]));
    });

    it('draws no Rarity Test and sets nothing by one', async () => {
      const app = await open({ off: ['rarityCeiling'] });

      expect(await app.rarityTest.draw()).toEqual([]);
      expect(await app.rarityTest.apply([{ rarity: 2, known: false }])).toBeUndefined();
    });
  });
});
