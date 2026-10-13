import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  entryIdOf,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type UserStatePort,
} from './index';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  categories: [{ id: 'test', displayName: 'Test' }],
  userSettingDefaults: { mix: { categoryIds: ['test'], corrections: true } },
};

function word(id: string, retired = false): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [0],
    partOfSpeech: 'noun',
    primaryDefinition: `The meaning of ${id.slice(2)}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'test',
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired,
  };
}

function correction(id: string, retired = false): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm: `not ${id.slice(2)}`,
    correctionType: 'calque',
    standardEquivalents: [id.slice(2), `also ${id.slice(2)}`],
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    sources: [{ title: 'Test source' }],
    retired,
  };
}

/** A small pack: live Words, a Retired Word, a live and a Retired Correction. */
const words = [word('w_one'), word('w_two'), word('w_three'), word('w_old', true)];
const corrections = [correction('c_one'), correction('c_old', true)];
const content = createMemoryContentPort({ words, corrections });

/** A clock the test moves by hand. */
function fakeClock(start = '2026-10-11T09:00:00+03:00') {
  let now = new Date(start).getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  return {
    clock,
    advance(ms: number) {
      now += ms;
    },
  };
}

const MINUTE = 60_000;

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

describe('Favorites', () => {
  it('adds an Entry with the time it was added, and removes it', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });

    await app.favorites.add('w_two');

    expect(app.favorites.has('w_two')).toBe(true);
    expect(app.favorites.list).toEqual([
      {
        entryId: 'w_two',
        addedAt: new Date('2026-10-11T09:00:00+03:00'),
        row: {
          kind: 'word',
          entryId: 'w_two',
          title: 't\u0301wo',
          definition: 'The meaning of two.',
          partOfSpeech: 'noun',
          registers: [],
        },
      },
    ]);

    await app.favorites.remove('w_two');

    expect(app.favorites.has('w_two')).toBe(false);
    expect(app.favorites.list).toEqual([]);
  });

  it('toggles an Entry in and out, telling whether it is in Favorites now', async () => {
    const app = await run();

    expect(await app.favorites.toggle('w_one')).toBe(true);
    expect(idsOf(app)).toEqual(['w_one']);
    expect(await app.favorites.toggle('w_one')).toBe(false);
    expect(idsOf(app)).toEqual([]);
  });

  it('keeps the first time when an Entry already in Favorites is added again', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    await app.favorites.add('w_one');
    time.advance(MINUTE);

    await app.favorites.add('w_one');

    expect(app.favorites.list.map((favorite) => favorite.addedAt)).toEqual([
      new Date('2026-10-11T09:00:00+03:00'),
    ]);
  });

  it('lists the newest first', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });

    for (const id of ['w_two', 'c_one', 'w_one']) {
      await app.favorites.add(id);
      time.advance(MINUTE);
    }

    expect(idsOf(app)).toEqual(['w_one', 'c_one', 'w_two']);
  });

  it('keeps Corrections like Words, each row with its main standard equivalent and the non-standard form', async () => {
    const app = await run();

    await app.favorites.add('c_one');

    expect(app.favorites.list[0]?.row).toEqual({
      kind: 'correction',
      entryId: 'c_one',
      title: 'one',
      nonStandardForm: 'not one',
      correctionType: 'calque',
    });
  });

  it('keeps Retired Entries, which open like any other', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    await first.favorites.add('w_old');
    time.advance(MINUTE);
    await first.favorites.add('c_old');

    const app = await run({ records, clock: time.clock });

    expect(idsOf(app)).toEqual(['c_old', 'w_old']);
    expect(await app.entryCard('w_old')).toMatchObject({
      kind: 'word',
      wordCard: { wordId: 'w_old', lemma: 'o\u0301ld' },
    });
    expect(await app.entryCard('c_old')).toMatchObject({
      kind: 'correction',
      correctionCard: { correctionId: 'c_old', mainEquivalent: 'old' },
    });
    expect(await app.entryRow('w_old')).toEqual({
      kind: 'word',
      entryId: 'w_old',
      title: 'o\u0301ld',
      definition: 'The meaning of old.',
      partOfSpeech: 'noun',
      registers: [],
    });
  });

  it('survives reopening, with the times it was added', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    await first.favorites.add('w_one');
    time.advance(MINUTE);
    await first.favorites.add('c_one');
    await first.favorites.remove('w_one');
    time.advance(MINUTE);
    await first.favorites.add('w_three');

    const app = await run({ records, clock: time.clock });

    expect(app.favorites.list).toEqual(first.favorites.list);
    expect(idsOf(app)).toEqual(['w_three', 'c_one']);
  });

  it('keeps one `favorites.` record per Entry', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    await app.favorites.add('w_one');
    await app.favorites.add('c_one');

    expect([...records.keys()].filter((key) => key.startsWith('favorites.')).sort()).toEqual([
      'favorites.c_one',
      'favorites.w_one',
    ]);
  });

  it('skips an id the Language Pack does not have, in the list and in every lookup', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    await first.favorites.add('w_one');
    records.set('favorites.w_gone', JSON.stringify('2026-10-11T07:00:00.000Z'));

    const app = await run({ records });
    await app.favorites.add('c_gone');

    expect(idsOf(app)).toEqual(['w_one']);
    expect(app.favorites.has('w_gone')).toBe(false);
    expect(records.has('favorites.c_gone')).toBe(false);
    expect(await app.entryCard('w_gone')).toBeUndefined();
    expect(await app.entryRow('w_gone')).toBeUndefined();
  });

  it('changes nothing in memory when keeping the change fails', async () => {
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

    await expect(app.favorites.add('w_two')).rejects.toThrow('The disk is full');
    await expect(app.favorites.toggle('w_one')).rejects.toThrow('The disk is full');

    expect(idsOf(app)).toEqual(['w_one']);
    failing = false;
    expect(await app.favorites.toggle('w_one')).toBe(false);
  });

  describe('the snapshot', () => {
    it('is a new object after each change, telling the subscribers, and the same one otherwise', async () => {
      const app = await run();
      let told = 0;
      app.favorites.subscribe(() => {
        told += 1;
      });
      const empty = app.favorites.list;

      await app.favorites.remove('w_one');
      expect(app.favorites.list).toBe(empty);

      await app.favorites.add('w_one');
      const added = app.favorites.list;
      expect(added).not.toBe(empty);

      await app.favorites.add('w_one');
      expect(app.favorites.list).toBe(added);
      expect(told).toBe(1);

      await app.favorites.toggle('w_one');
      expect(app.favorites.list).not.toBe(added);
      expect(told).toBe(2);
    });

    it('stops telling a subscriber that unsubscribed', async () => {
      const app = await run();
      let told = 0;
      const stop = app.favorites.subscribe(() => {
        told += 1;
      });

      stop();
      await app.favorites.add('w_one');

      expect(told).toBe(0);
    });

    it('changes when the heart under the Feed card on screen is tapped', async () => {
      const app = await run();
      let told = 0;
      app.favorites.subscribe(() => {
        told += 1;
      });
      const onScreen = entryIdOf(app.feed.cards[0]);
      if (onScreen === undefined) throw new Error('The Feed opens on no Entry');

      await app.favorites.toggle(onScreen);

      expect(told).toBe(1);
      expect(app.favorites.list).toHaveLength(1);
      expect(app.favorites.has(onScreen)).toBe(true);
    });
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

    expect(entryIdOf(card)).toBe('w_three');
    expect(records).toEqual(before);
  });
});
