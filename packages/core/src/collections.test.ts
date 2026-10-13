import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  SEEN_DWELL_MS,
  type Composition,
  type Random,
} from './index';

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

function correction(id: string): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm: `not ${id.slice(2)}`,
    correctionType: 'calque',
    standardEquivalents: [id.slice(2)],
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three'), word('w_four'), word('w_old', true)],
  corrections: [correction('c_one')],
});

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

/** Random numbers that differ from one call to the next, so Collection ids differ. */
function steppingRandom(): Random {
  let step = 0;
  return {
    next() {
      step += 1;
      return (step * 0.6180339887) % 1;
    },
  };
}

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock().clock,
  random = steppingRandom(),
}: { records?: Map<string, string>; clock?: Clock; random?: Random } = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: { isFeatureEnabled: (feature) => feature === 'corrections' },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random,
  });
}

/** The names of the Collections, newest first. */
const namesOf = ({ collections }: Composition) =>
  collections.list.map((collection) => collection.name);

/** Creates a Collection that must be accepted. */
async function create({ collections }: Composition, name: string, entryId?: string) {
  const result = await collections.create(name, entryId);
  if (!result.ok) throw new Error(`"${name}" was refused: ${result.reason}`);
  return result.collection;
}

describe('Collections', () => {
  it('creates a Collection with the trimmed name and the time it was created, empty at first', async () => {
    const app = await run();

    const result = await app.collections.create('  Old words  ');

    expect(result).toEqual({
      ok: true,
      collection: {
        id: expect.any(String) as string,
        name: 'Old words',
        createdAt: new Date('2026-10-11T09:00:00+03:00'),
        count: 0,
        newestLemmas: [],
      },
    });
    expect(app.collections.list).toEqual([result.ok ? result.collection : undefined]);
  });

  describe('the name rules', () => {
    it('refuses an empty name, or one of spaces only', async () => {
      const app = await run();

      for (const name of ['', '   ', '\n\t']) {
        expect(await app.collections.create(name)).toEqual({ ok: false, reason: 'empty' });
      }

      expect(app.collections.list).toEqual([]);
    });

    it('accepts 40 characters and refuses 41, counting what is left after trimming', async () => {
      const app = await run();

      expect(await app.collections.create(`  ${'я'.repeat(41)}  `)).toEqual({
        ok: false,
        reason: 'too-long',
      });
      expect((await app.collections.create(`  ${'я'.repeat(40)}  `)).ok).toBe(true);
      expect(namesOf(app)).toEqual(['я'.repeat(40)]);
    });

    it('counts a character that takes two code units as one', async () => {
      const app = await run();

      expect((await app.collections.create('😀'.repeat(40))).ok).toBe(true);
      expect(await app.collections.create('😀'.repeat(41))).toEqual({
        ok: false,
        reason: 'too-long',
      });
    });

    it('refuses a name that is taken, whatever the letter case', async () => {
      const app = await run();
      await create(app, 'Цікаве');

      expect(await app.collections.create('Цікаве')).toEqual({ ok: false, reason: 'duplicate' });
      expect(await app.collections.create(' цІкаве ')).toEqual({ ok: false, reason: 'duplicate' });

      expect(namesOf(app)).toEqual(['Цікаве']);
    });

    it('sees the same letters as the same name, however they are composed', async () => {
      const app = await run();
      await create(app, 'Кіт \u0439');

      expect(await app.collections.create('кіт \u0438\u0306')).toEqual({
        ok: false,
        reason: 'duplicate',
      });
    });

    it('checks the length before the duplicate, and makes no record for a refusal', async () => {
      const records = new Map<string, string>();
      const app = await run({ records });

      await app.collections.create('');
      await app.collections.create('x'.repeat(41));

      expect([...records.keys()].filter((key) => key.startsWith('collections.'))).toEqual([]);
    });
  });

  it('files an Entry in many Collections and takes it out of one of them', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    const first = await create(app, 'First');
    time.advance(MINUTE);
    const second = await create(app, 'Second');
    time.advance(MINUTE);
    await create(app, 'Third');

    await app.collections.add(first.id, 'w_one');
    await app.collections.add(second.id, 'w_one');
    await app.collections.add(second.id, 'c_one');

    expect(app.collections.of('w_one').map((collection) => collection.name)).toEqual([
      'Second',
      'First',
    ]);
    expect(app.collections.of('c_one').map((collection) => collection.name)).toEqual(['Second']);
    expect(app.collections.of('w_two')).toEqual([]);
    expect(app.collections.has(first.id, 'w_one')).toBe(true);
    expect(app.collections.has(first.id, 'c_one')).toBe(false);

    await app.collections.remove(second.id, 'w_one');

    expect(app.collections.of('w_one').map((collection) => collection.name)).toEqual(['First']);
    expect(app.collections.has(second.id, 'w_one')).toBe(false);
    expect(app.collections.has(second.id, 'c_one')).toBe(true);
  });

  it('creates a Collection with the Entry already in it, in one write', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    const { id } = await create(app, 'Fresh', 'w_two');

    expect(app.collections.list[0]).toMatchObject({ name: 'Fresh', count: 1 });
    expect(app.collections.has(id, 'w_two')).toBe(true);
    expect(records.has(`collectionEntries.${id}.w_two`)).toBe(true);
  });

  it('keeps the first time when an Entry already in the Collection is added again', async () => {
    const time = fakeClock();
    const records = new Map<string, string>();
    const app = await run({ records, clock: time.clock });
    const { id } = await create(app, 'List', 'w_one');
    time.advance(MINUTE);

    await app.collections.add(id, 'w_one');

    expect(JSON.parse(records.get(`collectionEntries.${id}.w_one`) ?? 'null')).toBe(
      '2026-10-11T06:00:00.000Z',
    );
    expect(app.collections.list[0]?.count).toBe(1);
  });

  it('skips an Entry the Language Pack does not have, and a Collection that does not exist', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const { id } = await create(app, 'List');

    await app.collections.add(id, 'w_gone');
    await app.collections.add('k_gone', 'w_one');
    await app.collections.remove(id, 'w_gone');

    expect(app.collections.list[0]?.count).toBe(0);
    expect(app.collections.of('w_one')).toEqual([]);
    expect([...records.keys()].filter((key) => key.startsWith('collectionEntries.'))).toEqual([]);
  });

  it('lists the Collections newest first, each with its count and its newest Lemmas', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    const old = await create(app, 'Old');
    time.advance(MINUTE);
    const recent = await create(app, 'Recent');
    for (const entryId of ['w_one', 'c_one', 'w_two', 'w_three', 'w_four']) {
      time.advance(MINUTE);
      await app.collections.add(old.id, entryId);
    }
    await app.collections.add(recent.id, 'w_old');

    expect(app.collections.list.map(({ name, count }) => ({ name, count }))).toEqual([
      { name: 'Recent', count: 1 },
      { name: 'Old', count: 5 },
    ]);
    expect(app.collections.list[0]?.newestLemmas).toEqual(['o\u0301ld']);
    expect(app.collections.list[1]?.newestLemmas).toEqual([
      'f\u0301our',
      't\u0301hree',
      't\u0301wo',
    ]);
  });

  it('keeps Retired Entries in a Collection', async () => {
    const app = await run();
    const { id } = await create(app, 'Kept', 'w_old');

    expect(app.collections.of('w_old').map((collection) => collection.id)).toEqual([id]);
    expect(app.collections.list[0]?.count).toBe(1);
  });

  it('survives reopening, with the names, the times, the counts and the order', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    const one = await create(first, 'One', 'w_one');
    time.advance(MINUTE);
    const two = await create(first, 'Two');
    time.advance(MINUTE);
    await first.collections.add(two.id, 'w_one');
    await first.collections.add(two.id, 'c_one');
    await first.collections.add(one.id, 'w_two');
    await first.collections.remove(one.id, 'w_one');

    const app = await run({ records, clock: time.clock, random: steppingRandom() });

    expect(app.collections.list).toEqual(first.collections.list);
    expect(namesOf(app)).toEqual(['Two', 'One']);
    expect(app.collections.of('w_one').map((collection) => collection.name)).toEqual(['Two']);
    expect(app.collections.of('w_two').map((collection) => collection.name)).toEqual(['One']);
  });

  it('keeps a `collections.` record per Collection and a `collectionEntries.` record per filed Entry', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const { id } = await create(app, 'Names', 'w_one');
    await app.collections.add(id, 'c_one');

    expect([...records.keys()].filter((key) => key.startsWith('collection')).sort()).toEqual([
      `collectionEntries.${id}.c_one`,
      `collectionEntries.${id}.w_one`,
      `collections.${id}`,
    ]);
    expect(JSON.parse(records.get(`collections.${id}`) ?? 'null')).toEqual({
      name: 'Names',
      createdAt: '2026-10-11T06:00:00.000Z',
    });
    expect(id).not.toContain('.');
  });

  it('takes the Collection id from the random port', async () => {
    const first = await create(await run(), 'Seeded');
    const same = await create(await run(), 'Seeded');
    const other = await create(await run({ random: { next: () => 0.9 } }), 'Seeded');

    expect(same.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
  });

  it('gives up when the random port keeps giving an id that is taken', async () => {
    const app = await run({ random: { next: () => 0.25 } });
    await create(app, 'First');

    await expect(app.collections.create('Second')).rejects.toThrow(/id/);
    expect(namesOf(app)).toEqual(['First']);
  });

  it('ignores records that do not belong to a Collection that exists', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    const { id } = await create(first, 'Real', 'w_one');
    records.set('collectionEntries.k_orphan.w_one', JSON.stringify('2026-10-11T07:00:00.000Z'));
    records.set('collections.k_broken', JSON.stringify({ name: 7 }));

    const app = await run({ records });

    expect(app.collections.list.map((collection) => collection.id)).toEqual([id]);
    expect(app.collections.of('w_one').map((collection) => collection.id)).toEqual([id]);
  });

  it('changes nothing in memory when keeping the change fails', async () => {
    const records = new Map<string, string>();
    const port = createMemoryUserStatePort(records);
    let failing = false;
    const app = await openComposition({
      content,
      edition: { isFeatureEnabled: () => false },
      userState: await openUserState({
        port: {
          ...port,
          write: (changes) =>
            failing ? Promise.reject(new Error('The disk is full')) : port.write(changes),
        },
      }),
      clock: fakeClock().clock,
      random: steppingRandom(),
    });
    const { id } = await create(app, 'Safe', 'w_one');
    failing = true;

    await expect(app.collections.create('Lost')).rejects.toThrow('The disk is full');
    await expect(app.collections.add(id, 'w_two')).rejects.toThrow('The disk is full');
    await expect(app.collections.remove(id, 'w_one')).rejects.toThrow('The disk is full');

    expect(namesOf(app)).toEqual(['Safe']);
    expect(app.collections.list[0]?.count).toBe(1);
    failing = false;
    expect((await app.collections.create('Lost')).ok).toBe(true);
  });

  it('refuses two names that arrive together, whatever the letter case', async () => {
    const app = await run();

    const results = await Promise.all([
      app.collections.create('Same'),
      app.collections.create('SAME'),
    ]);

    expect(results.map((result) => result.ok)).toEqual([true, false]);
    expect(namesOf(app)).toEqual(['Same']);
  });

  describe('renaming', () => {
    it('gives the Collection the trimmed name and keeps its time, Entries and place in the order', async () => {
      const time = fakeClock();
      const records = new Map<string, string>();
      const app = await run({ records, clock: time.clock });
      const old = await create(app, 'Old', 'w_one');
      time.advance(MINUTE);
      await create(app, 'Recent');

      const result = await app.collections.rename(old.id, '  Older  ');

      expect(result).toEqual({
        ok: true,
        collection: { ...old, name: 'Older', newestLemmas: old.newestLemmas },
      });
      expect(namesOf(app)).toEqual(['Recent', 'Older']);
      expect(app.collections.has(old.id, 'w_one')).toBe(true);
      expect(app.collections.of('w_one').map((collection) => collection.name)).toEqual(['Older']);
      expect(JSON.parse(records.get(`collections.${old.id}`) ?? 'null')).toEqual({
        name: 'Older',
        createdAt: '2026-10-11T06:00:00.000Z',
      });
    });

    it('follows the name rules: empty, too long and taken in another letter case', async () => {
      const app = await run();
      await create(app, 'Taken');
      const { id } = await create(app, 'Mine');

      expect(await app.collections.rename(id, '  ')).toEqual({ ok: false, reason: 'empty' });
      expect(await app.collections.rename(id, 'я'.repeat(41))).toEqual({
        ok: false,
        reason: 'too-long',
      });
      expect(await app.collections.rename(id, ' tAKEN ')).toEqual({
        ok: false,
        reason: 'duplicate',
      });

      expect(namesOf(app).sort()).toEqual(['Mine', 'Taken']);
    });

    it('lets a Collection keep its own name, in another letter case too', async () => {
      const app = await run();
      const { id } = await create(app, 'Work');

      expect((await app.collections.rename(id, 'Work'))?.ok).toBe(true);
      expect((await app.collections.rename(id, 'WORK'))?.ok).toBe(true);

      expect(namesOf(app)).toEqual(['WORK']);
    });

    it('frees the old name for another Collection', async () => {
      const app = await run();
      const { id } = await create(app, 'Old name');
      await app.collections.rename(id, 'New name');

      expect((await app.collections.create('Old name')).ok).toBe(true);
    });

    it('tells the subscribers, and leaves the snapshot alone when nothing changes', async () => {
      const app = await run();
      const { id } = await create(app, 'List');
      let told = 0;
      app.collections.subscribe(() => {
        told += 1;
      });
      const before = app.collections.list;

      await app.collections.rename(id, 'List');
      await app.collections.rename(id, '');
      await app.collections.rename('k_gone', 'Anything');
      expect(app.collections.list).toBe(before);
      expect(told).toBe(0);

      await app.collections.rename(id, 'Renamed');
      expect(app.collections.list).not.toBe(before);
      expect(told).toBe(1);
    });

    it('skips a Collection that does not exist', async () => {
      const records = new Map<string, string>();
      const app = await run({ records });

      expect(await app.collections.rename('k_gone', 'Name')).toBeUndefined();

      expect([...records.keys()].filter((key) => key.startsWith('collections.'))).toEqual([]);
    });

    it('survives reopening, and changes nothing when keeping it fails', async () => {
      const records = new Map<string, string>();
      const port = createMemoryUserStatePort(records);
      let failing = false;
      const open = async () =>
        openComposition({
          content,
          edition: { isFeatureEnabled: () => false },
          userState: await openUserState({
            port: {
              ...port,
              write: (changes) =>
                failing ? Promise.reject(new Error('The disk is full')) : port.write(changes),
            },
          }),
          clock: fakeClock().clock,
          random: steppingRandom(),
        });
      const app = await open();
      const { id } = await create(app, 'First');

      failing = true;
      await expect(app.collections.rename(id, 'Second')).rejects.toThrow('The disk is full');
      expect(namesOf(app)).toEqual(['First']);

      failing = false;
      await app.collections.rename(id, 'Second');
      expect(namesOf(await open())).toEqual(['Second']);
    });
  });

  describe('deleting', () => {
    it('deletes the Collection record and its Entry records in one write, and no other record', async () => {
      const records = new Map<string, string>();
      const writes: Map<string, string | undefined>[] = [];
      const port = createMemoryUserStatePort(records);
      const app = await openComposition({
        content,
        edition: { isFeatureEnabled: () => true },
        userState: await openUserState({
          port: {
            ...port,
            write(changes) {
              writes.push(new Map(changes));
              return port.write(changes);
            },
          },
        }),
        clock: fakeClock().clock,
        random: steppingRandom(),
      });
      const doomed = await create(app, 'Doomed', 'w_one');
      await app.collections.add(doomed.id, 'c_one');
      const kept = await create(app, 'Kept', 'w_one');
      // A record of an Entry the Language Pack no longer has goes with its Collection too.
      records.set(
        `collectionEntries.${doomed.id}.w_gone`,
        JSON.stringify('2026-10-11T07:00:00.000Z'),
      );
      writes.length = 0;

      await app.collections.delete(doomed.id);

      expect(writes).toHaveLength(1);
      expect([...(writes[0] ?? [])].sort()).toEqual(
        [
          [`collectionEntries.${doomed.id}.c_one`, undefined],
          [`collectionEntries.${doomed.id}.w_gone`, undefined],
          [`collectionEntries.${doomed.id}.w_one`, undefined],
          [`collections.${doomed.id}`, undefined],
        ].sort(),
      );
      expect([...records.keys()].filter((key) => key.startsWith('collection')).sort()).toEqual([
        `collectionEntries.${kept.id}.w_one`,
        `collections.${kept.id}`,
      ]);
      expect(namesOf(app)).toEqual(['Kept']);
      expect(app.collections.of('w_one').map((collection) => collection.name)).toEqual(['Kept']);
      expect(app.collections.of('c_one')).toEqual([]);
      expect(app.collections.has(doomed.id, 'w_one')).toBe(false);
    });

    it('leaves the Entry in Favorites, in History and in other Collections', async () => {
      const time = fakeClock();
      const records = new Map<string, string>();
      const app = await run({ records, clock: time.clock });
      await app.feed.show(0);
      time.advance(SEEN_DWELL_MS);
      await app.feed.show(undefined);
      const seen = app.history.list[0];
      if (seen === undefined) throw new Error('The card was not Seen');
      const doomed = await create(app, 'Doomed', seen.entryId);
      const other = await create(app, 'Other', seen.entryId);
      await app.favorites.add(seen.entryId);

      await app.collections.delete(doomed.id);

      expect(app.favorites.has(seen.entryId)).toBe(true);
      expect(app.history.list.map((entry) => entry.entryId)).toEqual([seen.entryId]);
      expect(app.collections.of(seen.entryId).map((collection) => collection.id)).toEqual([
        other.id,
      ]);
      expect(app.collections.has(other.id, seen.entryId)).toBe(true);
      const reopened = await run({ records, clock: time.clock });
      expect(namesOf(reopened)).toEqual(['Other']);
      expect(reopened.favorites.has(seen.entryId)).toBe(true);
      expect(reopened.history.list).toHaveLength(1);
    });

    it('frees the name, tells the subscribers once, and skips a Collection that does not exist', async () => {
      const app = await run();
      const { id } = await create(app, 'Gone', 'w_one');
      let told = 0;
      app.collections.subscribe(() => {
        told += 1;
      });

      await app.collections.delete('k_gone');
      expect(told).toBe(0);

      await app.collections.delete(id);
      await app.collections.delete(id);

      expect(told).toBe(1);
      expect(app.collections.list).toEqual([]);
      expect((await app.collections.create('Gone')).ok).toBe(true);
    });

    it('changes nothing in memory when keeping the change fails', async () => {
      const port = createMemoryUserStatePort();
      let failing = false;
      const app = await openComposition({
        content,
        edition: { isFeatureEnabled: () => false },
        userState: await openUserState({
          port: {
            ...port,
            write: (changes) =>
              failing ? Promise.reject(new Error('The disk is full')) : port.write(changes),
          },
        }),
        clock: fakeClock().clock,
        random: steppingRandom(),
      });
      const { id } = await create(app, 'Safe', 'w_one');
      failing = true;

      await expect(app.collections.delete(id)).rejects.toThrow('The disk is full');

      expect(namesOf(app)).toEqual(['Safe']);
      expect(app.collections.has(id, 'w_one')).toBe(true);
    });
  });

  describe("a Collection's Entries", () => {
    it('lists the Entries newest first, each with the time it was added and its row', async () => {
      const time = fakeClock();
      const app = await run({ clock: time.clock });
      const { id } = await create(app, 'List');
      const added: { entryId: string; addedAt: Date }[] = [];
      for (const entryId of ['w_one', 'c_one', 'w_two']) {
        time.advance(MINUTE);
        await app.collections.add(id, entryId);
        added.push({ entryId, addedAt: time.clock.now() });
      }

      expect(app.collections.entries(id)).toEqual(
        await Promise.all(
          added.reverse().map(async ({ entryId, addedAt }) => ({
            entryId,
            addedAt,
            row: await app.entryRow(entryId),
          })),
        ),
      );
    });

    it('lists Entries added at the same instant in a stable order, and an empty Collection as nothing', async () => {
      const app = await run();
      const { id } = await create(app, 'List');
      expect(app.collections.entries(id)).toEqual([]);

      await app.collections.add(id, 'w_two');
      await app.collections.add(id, 'w_one');

      expect(app.collections.entries(id).map((entry) => entry.entryId)).toEqual(['w_one', 'w_two']);
    });

    it('has nothing for a Collection that does not exist', async () => {
      const app = await run();

      expect(app.collections.entries('k_gone')).toEqual([]);
    });

    it('keeps Retired Words', async () => {
      const app = await run();
      const { id } = await create(app, 'Kept', 'w_old');

      expect(app.collections.entries(id).map((entry) => entry.entryId)).toEqual(['w_old']);
    });

    it('takes an Entry out of this Collection only, leaving it in Favorites, History and the other Collections', async () => {
      const time = fakeClock();
      const records = new Map<string, string>();
      const app = await run({ records, clock: time.clock });
      await app.feed.show(0);
      time.advance(SEEN_DWELL_MS);
      await app.feed.show(undefined);
      const seen = app.history.list[0];
      if (seen === undefined) throw new Error('The card was not Seen');
      const first = await create(app, 'First', seen.entryId);
      const second = await create(app, 'Second', seen.entryId);
      await app.favorites.add(seen.entryId);

      await app.collections.remove(first.id, seen.entryId);

      expect(app.collections.entries(first.id)).toEqual([]);
      expect(app.collections.entries(second.id).map((entry) => entry.entryId)).toEqual([
        seen.entryId,
      ]);
      expect(app.favorites.has(seen.entryId)).toBe(true);
      expect(app.history.list.map((entry) => entry.entryId)).toEqual([seen.entryId]);
      const reopened = await run({ records, clock: time.clock });
      expect(reopened.collections.entries(first.id)).toEqual([]);
      expect(reopened.collections.entries(second.id)).toHaveLength(1);
    });

    it('is the same array until that Collection changes, and a new one after', async () => {
      const app = await run();
      const { id } = await create(app, 'List', 'w_one');
      const other = await create(app, 'Other');

      const before = app.collections.entries(id);
      expect(app.collections.entries(id)).toBe(before);

      await app.collections.add(other.id, 'w_two');
      await app.collections.remove(id, 'w_two');
      await app.collections.add(id, 'w_one');
      expect(app.collections.entries(id)).toBe(before);

      await app.collections.add(id, 'w_two');
      const after = app.collections.entries(id);
      expect(after).not.toBe(before);
      expect(after).toHaveLength(2);

      await app.collections.delete(id);
      expect(app.collections.entries(id)).toEqual([]);
    });
  });

  describe('the snapshot', () => {
    it('is a new object after each change, telling the subscribers, and the same one otherwise', async () => {
      const app = await run();
      let told = 0;
      app.collections.subscribe(() => {
        told += 1;
      });
      const empty = app.collections.list;

      await app.collections.create('');
      await app.collections.add('k_gone', 'w_one');
      expect(app.collections.list).toBe(empty);
      expect(told).toBe(0);

      const { id } = await create(app, 'List');
      const created = app.collections.list;
      expect(created).not.toBe(empty);
      expect(told).toBe(1);

      await app.collections.remove(id, 'w_one');
      expect(app.collections.list).toBe(created);

      await app.collections.add(id, 'w_one');
      const filed = app.collections.list;
      expect(filed).not.toBe(created);
      expect(told).toBe(2);

      await app.collections.add(id, 'w_one');
      expect(app.collections.list).toBe(filed);
      expect(told).toBe(2);

      await app.collections.remove(id, 'w_one');
      expect(app.collections.list).not.toBe(filed);
      expect(told).toBe(3);
    });

    it('gives the Collections of an Entry as the same array until a change', async () => {
      const app = await run();
      const { id } = await create(app, 'List', 'w_one');

      const before = app.collections.of('w_one');
      expect(app.collections.of('w_one')).toBe(before);
      expect(app.collections.of('w_two')).toBe(app.collections.of('c_one'));

      await app.collections.remove(id, 'w_one');

      expect(app.collections.of('w_one')).not.toBe(before);
      expect(app.collections.of('w_one')).toEqual([]);
    });

    it('stops telling a subscriber that unsubscribed', async () => {
      const app = await run();
      let told = 0;
      const stop = app.collections.subscribe(() => {
        told += 1;
      });

      stop();
      await create(app, 'Quiet');

      expect(told).toBe(0);
    });
  });
});
