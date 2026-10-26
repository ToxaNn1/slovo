import { describe, expect, it } from 'vitest';

import { createMemoryUserStatePort, openUserState, type Random } from '../index';
import { openCycle, type Cycle, type CycleChange } from './cycle';
import { randomOf, randomSequence } from '../test-support';

const wordIds = Array.from({ length: 10 }, (_, index) => `w_${String(index)}`);
const correctionIds = Array.from({ length: 4 }, (_, index) => `c_${String(index)}`);

/** One app run over the given records: the user state survives between runs. */
async function open({
  records = new Map<string, string>(),
  random = randomOf(0.25),
  words = wordIds,
  corrections = correctionIds,
}: {
  records?: Map<string, string>;
  random?: Random;
  words?: readonly string[];
  corrections?: readonly string[];
} = {}): Promise<Cycle> {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return openCycle({
    entries: {
      eligible: () =>
        Promise.resolve({ words, corrections, idioms: [], synonymRows: [], tips: [] }),
    },
    userState,
    random,
  });
}

/** Writes the changes of a Cycle change and then applies it, as its caller does. */
async function keep(records: Map<string, string>, change: CycleChange): Promise<void> {
  await createMemoryUserStatePort(records).write(change.changes);
  change.commit();
}

describe('the Cycle', () => {
  it('covers every Entry it is given, each kind shuffled', async () => {
    const cycle = await open();

    expect(new Set(cycle.order().words)).toEqual(new Set(wordIds));
    expect(new Set(cycle.order().corrections)).toEqual(new Set(correctionIds));
    expect(cycle.order().words).not.toEqual(wordIds);
    expect(cycle.unseen()).toEqual(cycle.order());
  });

  it('shuffles with its seed: the same seed gives the same order, another seed another', async () => {
    const first = (await open({ random: randomOf(0.25) })).order();
    const again = (await open({ random: randomOf(0.25) })).order();
    const other = (await open({ random: randomOf(0.75) })).order();

    expect(again).toEqual(first);
    expect(other.words).not.toEqual(first.words);
    expect(other.corrections).not.toEqual(first.corrections);
  });

  it('keeps its order across a restart, whatever the random port draws then', async () => {
    const records = new Map<string, string>();
    const before = (await open({ records, random: randomOf(0.25) })).order();

    const after = (await open({ records, random: randomOf(0.75) })).order();

    expect(after).toEqual(before);
  });

  it('covers nothing when it is given no Entry', async () => {
    const cycle = await open({ words: [], corrections: [] });

    expect(cycle.order()).toEqual({
      words: [],
      corrections: [],
      idioms: [],
      synonymRows: [],
      tips: [],
    });
    expect(cycle.isEmpty()).toBe(true);
  });

  it('covers the Entries it is given of either kind, and no others', async () => {
    const cycle = await open();

    expect(cycle.isEmpty()).toBe(false);
    expect(cycle.covers('w_3')).toBe(true);
    expect(cycle.covers('c_3')).toBe(true);
    expect(cycle.covers('w_10')).toBe(false);
    expect((await open({ words: [] })).isEmpty()).toBe(false);
  });

  describe('Seen', () => {
    it('leaves an Entry out of the unseen ones once it is Seen, keeping the Cycle order', async () => {
      const cycle = await open();
      const [word, ...otherWords] = cycle.order().words;
      const [correction, ...otherCorrections] = cycle.order().corrections;

      cycle.markSeen(word ?? '').commit();
      cycle.markSeen(correction ?? '').commit();

      expect(cycle.unseen()).toEqual({
        words: otherWords,
        corrections: otherCorrections,
        idioms: [],
        synonymRows: [],
        tips: [],
      });
      expect(cycle.order().words).toContain(word);
    });

    it('keeps Seen across a restart once the changes are written', async () => {
      const records = new Map<string, string>();
      const cycle = await open({ records });
      const [first, second] = cycle.order().words;
      await keep(records, cycle.markSeen(first ?? ''));
      cycle.markSeen(second ?? '');

      const restarted = await open({ records });

      expect(restarted.unseen().words).not.toContain(first);
      // Changes nobody wrote are not kept.
      expect(restarted.unseen().words).toContain(second);
    });

    it('makes nothing Seen until the change is committed, so a failed write changes nothing', async () => {
      const records = new Map<string, string>();
      const cycle = await open({ records });
      const [first = ''] = cycle.order().words;

      const change = cycle.markSeen(first);

      expect(cycle.unseen().words).toContain(first);
      change.commit();
      expect(cycle.unseen().words).not.toContain(first);
    });

    it('returns no changes for an Entry Seen already', async () => {
      const cycle = await open();
      const [first = ''] = cycle.order().words;
      cycle.markSeen(first).commit();

      expect(cycle.markSeen(first).changes.size).toBe(0);
    });

    it('reads only the Seen records that hold the id of the current Cycle, under the Seen prefix', async () => {
      const [first = '', second = '', third = ''] = wordIds;
      const records = new Map([
        ['feed.cycle', JSON.stringify({ id: 3, seed: 7 })],
        [`feed.seen.${first}`, '3'],
        [`feed.seen.${second}`, 'not JSON'],
        [`feed.seen${third}`, '3'],
      ]);

      const cycle = await open({ records });

      expect(cycle.unseen().words).not.toContain(first);
      expect(cycle.unseen().words).toContain(second);
      expect(cycle.unseen().words).toContain(third);
    });

    it('reads a Seen record of another Cycle as not Seen, and marks it Seen in this one', async () => {
      const [older = '', newer = ''] = wordIds;
      // A device offline since Cycle 2 brought its Seen mark into Cycle 3, and one from Cycle 4.
      const records = new Map([
        ['feed.cycle', JSON.stringify({ id: 3, seed: 7 })],
        [`feed.seen.${older}`, '2'],
        [`feed.seen.${newer}`, '4'],
      ]);
      const cycle = await open({ records });

      expect(cycle.unseen().words).toContain(older);
      expect(cycle.unseen().words).toContain(newer);

      await keep(records, cycle.markSeen(older));

      expect(records.get(`feed.seen.${older}`)).toBe('3');
      expect((await open({ records })).unseen().words).not.toContain(older);
    });

    it("keeps one record per Seen Entry, so two Cycles over one user state keep each other's marks", async () => {
      const records = new Map<string, string>();
      const one = await open({ records });
      const other = await open({ records });
      const [first, second] = one.order().words;

      await keep(records, one.markSeen(first ?? ''));
      await keep(records, other.markSeen(second ?? ''));

      const restarted = await open({ records });
      expect(restarted.unseen().words).not.toContain(first);
      expect(restarted.unseen().words).not.toContain(second);
    });
  });

  describe('eligibility read again', () => {
    /** A Cycle over Entries whose eligibility the test changes between reads. */
    async function openOver(records = new Map<string, string>()) {
      const eligible = {
        words: [...wordIds],
        corrections: [...correctionIds],
        idioms: [],
        synonymRows: [],
        tips: [],
      };
      const userState = await openUserState({ port: createMemoryUserStatePort(records) });
      const cycle = await openCycle({
        entries: { eligible: () => Promise.resolve({ ...eligible }) },
        userState,
        random: randomOf(0.25),
      });
      return { cycle, eligible };
    }

    it('leaves out the Entries no longer eligible, keeping the order of those that stay', async () => {
      const { cycle, eligible } = await openOver();
      const before = cycle.order();
      const [, word = ''] = before.words;
      const [correction = ''] = before.corrections;

      eligible.words = eligible.words.filter((id) => id !== word);
      eligible.corrections = eligible.corrections.filter((id) => id !== correction);
      await cycle.readEligibleAgain();

      expect(cycle.order()).toEqual({
        words: before.words.filter((id) => id !== word),
        corrections: before.corrections.filter((id) => id !== correction),
        idioms: [],
        synonymRows: [],
        tips: [],
      });
      expect(cycle.covers(word)).toBe(false);
      expect(cycle.covers(correction)).toBe(false);
    });

    it('puts an Entry eligible again back in its place in the order', async () => {
      const { cycle, eligible } = await openOver();
      const before = cycle.order();
      const [, , word = ''] = before.words;

      eligible.words = eligible.words.filter((id) => id !== word);
      await cycle.readEligibleAgain();
      eligible.words = [...wordIds];
      await cycle.readEligibleAgain();

      expect(cycle.order()).toEqual(before);
    });

    it('keeps the seed and what is Seen, and writes nothing', async () => {
      const records = new Map<string, string>();
      const { cycle, eligible } = await openOver(records);
      const [first = '', second = ''] = cycle.order().words;
      await keep(records, cycle.markSeen(first));
      const kept = new Map(records);

      eligible.words = eligible.words.filter((id) => id !== second);
      await cycle.readEligibleAgain();

      expect(records).toEqual(kept);
      expect(cycle.unseen().words).not.toContain(first);
      eligible.words = [...wordIds];
      await cycle.readEligibleAgain();
      expect(cycle.unseen().words).not.toContain(first);
      expect(cycle.unseen().words).toContain(second);
    });

    it('gives the order a restart gives, with the same eligible Entries', async () => {
      const records = new Map<string, string>();
      const { cycle, eligible } = await openOver(records);
      const [, word = ''] = cycle.order().words;

      eligible.words = eligible.words.filter((id) => id !== word);
      await cycle.readEligibleAgain();
      const restarted = await open({ records, words: eligible.words });

      expect(restarted.order()).toEqual(cycle.order());
    });

    it('wins over a new Cycle whose Entries were read before it', async () => {
      const { cycle, eligible } = await openOver();
      const [word = ''] = cycle.order().words;

      const started = cycle.start();
      eligible.words = eligible.words.filter((id) => id !== word);
      await cycle.readEligibleAgain();
      (await started).commit();

      expect(cycle.covers(word)).toBe(false);
    });
  });

  describe('a new Cycle', () => {
    it('has nothing Seen and a new order from a new seed', async () => {
      const cycle = await open({ random: randomSequence(0.25, 0.75) });
      for (const id of cycle.order().words) cycle.markSeen(id).commit();
      expect(cycle.unseen().words).toEqual([]);

      const started = await cycle.start();
      started.commit();

      // The order a first Cycle shuffled with the second seed has.
      expect(cycle.order()).toEqual((await open({ random: randomOf(0.75) })).order());
      expect(started.order).toEqual(cycle.order());
      expect(cycle.unseen()).toEqual(cycle.order());
    });

    it('leaves the Cycle as it is until the change is committed, so a failed write changes nothing', async () => {
      const records = new Map<string, string>();
      const cycle = await open({ records, random: randomSequence(0.25, 0.75) });
      const [first = ''] = cycle.order().words;
      await keep(records, cycle.markSeen(first));
      const before = { order: cycle.order(), unseen: cycle.unseen() };

      const started = await cycle.start();

      expect(started.order).not.toEqual(before.order);
      expect({ order: cycle.order(), unseen: cycle.unseen() }).toEqual(before);
      const restarted = await open({ records });
      expect({ order: restarted.order(), unseen: restarted.unseen() }).toEqual(before);
    });

    it('deletes every Seen record, also those another Cycle over the user state kept', async () => {
      const records = new Map<string, string>();
      const one = await open({ records });
      const other = await open({ records });
      const [first, second] = one.order().words;
      await keep(records, one.markSeen(first ?? ''));
      await keep(records, other.markSeen(second ?? ''));

      // And one a device kept in another Cycle.
      records.set('feed.seen.w_9', '7');

      await keep(records, await one.start());

      expect([...records.keys()].filter((key) => key.startsWith('feed.seen.'))).toEqual([]);
      const restarted = await open({ records });
      expect(restarted.unseen()).toEqual(restarted.order());
    });

    it('is kept across a restart once its changes are written: nothing Seen, the order of the new seed', async () => {
      const records = new Map<string, string>();
      const cycle = await open({ records, random: randomSequence(0.25, 0.75) });
      for (const id of cycle.order().words) await keep(records, cycle.markSeen(id));

      await keep(records, await cycle.start());
      const restarted = await open({ records, random: randomOf(0.5) });

      expect(restarted.order()).toEqual(cycle.order());
      expect(restarted.unseen()).toEqual(restarted.order());
    });

    it('covers the Entries eligible when it starts', async () => {
      const words = [...wordIds];
      const userState = await openUserState({ port: createMemoryUserStatePort() });
      const cycle = await openCycle({
        entries: {
          eligible: () =>
            Promise.resolve({
              words: [...words],
              corrections: [],
              idioms: [],
              synonymRows: [],
              tips: [],
            }),
        },
        userState,
        random: randomOf(0.25),
      });

      words.splice(0, 2, 'w_new');
      (await cycle.start()).commit();

      expect(new Set(cycle.order().words)).toEqual(new Set(words));
      expect(cycle.order().corrections).toEqual([]);
    });
  });
});
