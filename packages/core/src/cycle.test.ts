import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openCycle,
  openUserState,
  type Cycle,
  type CycleChange,
  type Random,
} from './index';

const wordIds = Array.from({ length: 10 }, (_, index) => `w_${String(index)}`);
const correctionIds = Array.from({ length: 4 }, (_, index) => `c_${String(index)}`);

/** A random port that always draws the same number, so the Cycle seed is fixed. */
const randomOf = (value: number): Random => ({ next: () => value });

/** A random port that draws the given numbers in turn, so each new Cycle gets the next seed. */
function randomSequence(...values: number[]): Random {
  let drawn = 0;
  return { next: () => values[drawn++ % values.length] ?? 0 };
}

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
    entries: { eligible: () => Promise.resolve({ words, corrections }) },
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

    expect(cycle.order()).toEqual({ words: [], corrections: [] });
  });

  describe('Seen', () => {
    it('leaves an Entry out of the unseen ones once it is Seen, keeping the Cycle order', async () => {
      const cycle = await open();
      const [word, ...otherWords] = cycle.order().words;
      const [correction, ...otherCorrections] = cycle.order().corrections;

      cycle.markSeen(word ?? '').commit();
      cycle.markSeen(correction ?? '').commit();

      expect(cycle.unseen()).toEqual({ words: otherWords, corrections: otherCorrections });
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

      await keep(records, await one.start());

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
        entries: { eligible: () => Promise.resolve({ words: [...words], corrections: [] }) },
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
