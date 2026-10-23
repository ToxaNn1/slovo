import { describe, expect, it } from 'vitest';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type UserStatePort,
} from '../index';
import { correction, fakeClock, word } from '../test-support';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  id: 'test',
  languageTraits: { distractorRule: 'same-part-of-speech' as const },
  userSettingDefaults: {
    mix: { categoryIds: ['test'], corrections: true, idioms: true },
    notificationTimes: [],
  },
};

/** A small pack: live Words, a Retired Word, a live and a Retired Correction. */
const words = [word('w_one'), word('w_two'), word('w_three'), word('w_old', { retired: true })];
const corrections = [correction('c_one'), correction('c_old', { retired: true })];
const content = createMemoryContentPort({ words, corrections });

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  clock = fakeClock().clock,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  clock?: Clock;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: { ...testCategories, isFeatureEnabled: (feature) => feature === 'corrections' },
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
}

/** The ids in Favorites, newest first. */
const idsOf = ({ favorites }: Composition) => favorites.list.map((favorite) => favorite.entryId);

// What Favorites share with the Hidden Entries is tested once for both in `entry-list.test.ts`.
describe('Favorites', () => {
  it('toggles an Entry in and out, telling whether it is in Favorites now', async () => {
    const app = await run();
    let told = 0;
    app.favorites.subscribe(() => {
      told += 1;
    });

    expect(await app.favorites.toggle('w_one')).toBe(true);
    expect(idsOf(app)).toEqual(['w_one']);
    expect(await app.favorites.toggle('w_one')).toBe(false);
    expect(idsOf(app)).toEqual([]);
    expect(told).toBe(2);
  });

  it('toggles one tap after the other, each from what the one before it left', async () => {
    const app = await run();

    const taps = await Promise.all([
      app.favorites.toggle('w_one'),
      app.favorites.toggle('w_one'),
      app.favorites.add('w_one'),
      app.favorites.toggle('w_one'),
    ]);

    expect(taps).toEqual([true, false, undefined, false]);
    expect(idsOf(app)).toEqual([]);
  });

  it('changes nothing in memory when keeping a toggle fails', async () => {
    const records = new Map<string, string>();
    let failing = false;
    const port = createMemoryUserStatePort(records);
    const app = await run({
      port: {
        ...port,
        write: (changes) =>
          failing ? Promise.reject(new Error('The disk is full')) : port.write(changes),
      },
    });
    await app.favorites.add('w_one');
    failing = true;

    await expect(app.favorites.toggle('w_one')).rejects.toThrow('The disk is full');
    await expect(app.favorites.toggle('w_two')).rejects.toThrow('The disk is full');

    expect(idsOf(app)).toEqual(['w_one']);
    failing = false;
    expect(await app.favorites.toggle('w_one')).toBe(false);
  });

  it('changes when the heart under the Feed card on screen is tapped', async () => {
    const app = await run();
    let told = 0;
    app.favorites.subscribe(() => {
      told += 1;
    });
    const onScreen = app.feed.cards[0]?.entryId;
    if (onScreen === undefined) throw new Error('The Feed opens on no Entry');

    await app.favorites.toggle(onScreen);

    expect(told).toBe(1);
    expect(app.favorites.list).toHaveLength(1);
    expect(app.favorites.has(onScreen)).toBe(true);
  });
});

describe('an Entry opened from a list', () => {
  it('opens its Entry card without marking it Seen or changing the user state', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.favorites.add('w_three');
    const before = new Map(records);

    const card = await app.entryCard('w_three');
    await app.entryRow('w_three');

    expect(card?.entryId).toBe('w_three');
    expect(records).toEqual(before);
  });

  it('opens a Retired Entry like any other', async () => {
    const app = await run();
    await app.favorites.add('w_old');
    await app.favorites.add('c_old');

    expect(await app.entryCard('w_old')).toMatchObject({
      kind: 'word',
      entryId: 'w_old',
      model: { lemma: 'óld' },
    });
    expect(await app.entryCard('c_old')).toMatchObject({
      kind: 'correction',
      entryId: 'c_old',
      model: { mainEquivalent: 'old' },
    });
    expect(await app.entryRow('w_old')).toEqual({
      kind: 'word',
      entryId: 'w_old',
      title: 'óld',
      secondLine: 'The meaning of old.',
      kindKey: 'word',
      spoken: 'old, The meaning of old.',
      partOfSpeech: 'noun',
      registers: [],
    });
  });

  it("opens today's Word of the Day with its day, as the Feed shows it", async () => {
    const app = await run();
    const today = app.feed.cards[app.feed.startPosition]?.entryId;

    expect(await app.entryCard(today ?? '')).toMatchObject({
      kind: 'word',
      wordOfTheDay: { year: 2026, month: 10, day: 11 },
    });
  });

  it('opens any other Word without a day', async () => {
    const app = await run();
    const today = app.feed.cards[app.feed.startPosition]?.entryId;
    const other = ['w_one', 'w_two'].find((id) => id !== today) ?? '';

    expect(await app.entryCard(other)).not.toHaveProperty('wordOfTheDay');
  });

  it('opens nothing for an id the Language Pack does not have', async () => {
    const records = new Map<string, string>();
    records.set('favorites.w_gone', JSON.stringify('2026-10-11T07:00:00.000Z'));
    const app = await run({ records });

    expect(await app.entryCard('w_gone')).toBeUndefined();
    expect(await app.entryRow('w_gone')).toBeUndefined();
  });
});
