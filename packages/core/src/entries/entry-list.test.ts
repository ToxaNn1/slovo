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
const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three'), word('w_old', { retired: true })],
  corrections: [correction('c_one'), correction('c_old', { retired: true })],
});

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

/** A list of Entries the user keeps with a time, as each of them names its parts. */
interface KeptList {
  readonly name: string;
  /** The prefix of its user-state records. */
  readonly prefix: string;
  /** The name of an Entry's time in the list. */
  readonly timeKey: string;
  /** The list as the composition offers it. */
  readonly listOf: (app: Composition) => {
    readonly list: readonly object[];
    has(entryId: string): boolean;
    subscribe(listener: () => void): () => void;
  };
  /** Its Entries with their times, newest first. */
  readonly timesOf: (app: Composition) => [string, Date][];
  /** Adds the Entry, as of now. */
  readonly put: (app: Composition, entryId: string) => Promise<unknown>;
  /** Takes the Entry out. */
  readonly takeOut: (app: Composition, entryId: string) => Promise<unknown>;
}

const keptLists: readonly KeptList[] = [
  {
    name: 'Favorites',
    prefix: 'favorites.',
    timeKey: 'addedAt',
    listOf: ({ favorites }) => favorites,
    timesOf: ({ favorites }) => favorites.list.map(({ entryId, addedAt }) => [entryId, addedAt]),
    put: ({ favorites }, entryId) => favorites.add(entryId),
    takeOut: ({ favorites }, entryId) => favorites.remove(entryId),
  },
  {
    name: 'Hidden Entries',
    prefix: 'hidden.',
    timeKey: 'hiddenAt',
    listOf: ({ hiddenEntries }) => hiddenEntries,
    timesOf: ({ hiddenEntries }) =>
      hiddenEntries.list.map(({ entryId, hiddenAt }) => [entryId, hiddenAt]),
    put: ({ hiddenEntries }, entryId) => hiddenEntries.hide(entryId),
    takeOut: ({ hiddenEntries }, entryId) => hiddenEntries.restore(entryId),
  },
];

describe.each(keptLists)('$name', ({ prefix, timeKey, listOf, timesOf, put, takeOut }) => {
  const idsOf = (app: Composition) => timesOf(app).map(([entryId]) => entryId);

  it('keeps an Entry with the time it went in and its row, and takes it out', async () => {
    const app = await run();

    await put(app, 'w_two');

    expect(listOf(app).has('w_two')).toBe(true);
    expect(listOf(app).list).toEqual([
      {
        entryId: 'w_two',
        [timeKey]: new Date('2026-10-11T09:00:00+03:00'),
        row: {
          kind: 'word',
          entryId: 'w_two',
          title: 't́wo',
          secondLine: 'The meaning of two.',
          kindKey: 'word',
          spoken: 'two, The meaning of two.',
          partOfSpeech: 'noun',
          registers: [],
        },
      },
    ]);

    await takeOut(app, 'w_two');

    expect(listOf(app).has('w_two')).toBe(false);
    expect(listOf(app).list).toEqual([]);
  });

  it('keeps the first time when an Entry already in goes in again', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    await put(app, 'w_one');
    time.advance(MINUTE);

    await put(app, 'w_one');

    expect(timesOf(app)).toEqual([['w_one', new Date('2026-10-11T09:00:00+03:00')]]);
  });

  it('lists the newest first, Corrections like Words', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });

    for (const id of ['w_two', 'c_one', 'w_one']) {
      await put(app, id);
      time.advance(MINUTE);
    }

    expect(idsOf(app)).toEqual(['w_one', 'c_one', 'w_two']);
    expect(listOf(app).list[1]).toMatchObject({
      row: {
        kind: 'correction',
        entryId: 'c_one',
        title: 'one',
        secondLine: 'not one',
        kindKey: 'correction',
        spoken: 'one, not one',
        correctionType: 'calque',
      },
    });
  });

  it('lists the Entries that went in at the same time in a stable order, also after reopening', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });

    for (const id of ['w_two', 'w_one', 'c_one']) await put(first, id);
    const reopened = await run({ records, clock: time.clock });

    expect(idsOf(first)).toEqual(['c_one', 'w_one', 'w_two']);
    expect(idsOf(reopened)).toEqual(idsOf(first));
  });

  it('keeps Retired Entries', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    await put(first, 'w_old');
    time.advance(MINUTE);
    await put(first, 'c_old');

    const app = await run({ records, clock: time.clock });

    expect(idsOf(app)).toEqual(['c_old', 'w_old']);
  });

  it('survives reopening, with the times the Entries went in, one record per Entry', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    await put(first, 'w_one');
    time.advance(MINUTE);
    await put(first, 'c_one');
    await takeOut(first, 'w_one');
    time.advance(MINUTE);
    await put(first, 'w_three');

    const app = await run({ records, clock: time.clock });

    expect(listOf(app).list).toEqual(listOf(first).list);
    expect(timesOf(app)).toEqual([
      ['w_three', new Date('2026-10-11T09:02:00+03:00')],
      ['c_one', new Date('2026-10-11T09:01:00+03:00')],
    ]);
    expect([...records.keys()].filter((key) => key.startsWith(prefix)).sort()).toEqual([
      `${prefix}c_one`,
      `${prefix}w_three`,
    ]);
  });

  it('skips an id the Language Pack does not have, and leaves out a kept Entry gone from it', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    await put(first, 'w_one');
    records.set(`${prefix}w_gone`, JSON.stringify('2026-10-11T07:00:00.000Z'));

    const app = await run({ records });
    await put(app, 'c_gone');

    expect(idsOf(app)).toEqual(['w_one']);
    expect(listOf(app).has('w_gone')).toBe(false);
    expect(listOf(app).has('c_gone')).toBe(false);
    expect(records.has(`${prefix}c_gone`)).toBe(false);
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
    await put(app, 'w_one');
    const before = listOf(app).list;
    failing = true;

    await expect(put(app, 'w_two')).rejects.toThrow('The disk is full');
    await expect(takeOut(app, 'w_one')).rejects.toThrow('The disk is full');

    expect(listOf(app).list).toBe(before);
    expect(idsOf(app)).toEqual(['w_one']);
    failing = false;
    await takeOut(app, 'w_one');
    expect(idsOf(app)).toEqual([]);
  });

  describe('the snapshot', () => {
    it('is a new object after each change, telling the subscribers, and the same one otherwise', async () => {
      const app = await run();
      let told = 0;
      listOf(app).subscribe(() => {
        told += 1;
      });
      const empty = listOf(app).list;

      await takeOut(app, 'w_one');
      expect(listOf(app).list).toBe(empty);

      await put(app, 'w_one');
      const added = listOf(app).list;
      expect(added).not.toBe(empty);

      await put(app, 'w_one');
      expect(listOf(app).list).toBe(added);
      expect(told).toBe(1);

      await takeOut(app, 'w_one');
      expect(listOf(app).list).not.toBe(added);
      expect(told).toBe(2);
    });

    it('stops telling a subscriber that unsubscribed', async () => {
      const app = await run();
      let told = 0;
      const stop = listOf(app).subscribe(() => {
        told += 1;
      });

      stop();
      await put(app, 'w_one');

      expect(told).toBe(0);
    });
  });
});
