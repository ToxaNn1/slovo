import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openUserState,
  type Clock,
  type Random,
  type UserStatePort,
} from '../index';
import { openCycle, type Cycle } from './cycle';
import { openWordOfTheDay, type WordOfTheDay } from './word-of-the-day';
import { fakeClock, randomOf, randomSequence } from '../test-support';

const wordIds = Array.from({ length: 10 }, (_, index) => `w_${String(index)}`);
const correctionIds = ['c_0', 'c_1', 'c_2'];

/** One app run over the given records: the user state survives between runs. */
async function open({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  clock = fakeClock('2026-10-11T09:00:00+03:00').clock,
  random = randomOf(0.25),
  words = wordIds,
  corrections = [],
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  clock?: Clock;
  random?: Random;
  words?: readonly string[];
  corrections?: readonly string[];
} = {}): Promise<{
  cycle: Cycle;
  wordOfTheDay: WordOfTheDay;
  keepSeen(id: string): Promise<void>;
}> {
  const userState = await openUserState({ port });
  const cycle = await openCycle({
    entries: { eligible: () => Promise.resolve({ words, corrections, idioms: [] }) },
    userState,
    random,
  });
  const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });
  return {
    cycle,
    wordOfTheDay,
    async keepSeen(id) {
      const change = cycle.markSeen(id);
      await userState.write(change.changes);
      change.commit();
    },
  };
}

/** Today's Word of the Day on the given morning, Seen once chosen. */
async function readOn(records: Map<string, string>, day: number, words = wordIds) {
  const clock = fakeClock(`2026-10-${String(day)}T09:00:00+03:00`).clock;
  const run = await open({ records, clock, words });
  const today = await run.wordOfTheDay.today();
  await run.keepSeen(today?.wordId ?? '');
  return { ...run, today };
}

describe('the Word of the Day', () => {
  it('is an unseen Word of the Cycle, chosen for the local day in the clock time zone', async () => {
    const { cycle, wordOfTheDay } = await open();
    expect(wordOfTheDay.chosen()).toBeUndefined();

    const today = await wordOfTheDay.today();

    expect(today).toEqual({
      wordId: cycle.unseen().words[0],
      date: { year: 2026, month: 10, day: 11 },
      startedCycle: false,
    });
    expect(wordOfTheDay.chosen()).toEqual({ wordId: today?.wordId, date: today?.date });
  });

  it('stays the same all local day, also after a restart', async () => {
    const records = new Map<string, string>();
    const morning = await open({ records, clock: fakeClock('2026-10-11T00:05:00+03:00').clock });
    const chosen = await morning.wordOfTheDay.today();

    const evening = await open({
      records,
      clock: fakeClock('2026-10-11T23:55:00+03:00').clock,
      random: randomOf(0.75),
    });

    expect(evening.wordOfTheDay.chosen()).toEqual({ wordId: chosen?.wordId, date: chosen?.date });
    expect(await evening.wordOfTheDay.today()).toEqual(chosen);
  });

  it('changes at local midnight, even when the one before was not Seen', async () => {
    const records = new Map<string, string>();
    const yesterday = await (
      await open({ records, clock: fakeClock('2026-10-11T23:59:59+03:00').clock })
    ).wordOfTheDay.today();

    const afterMidnight = await open({
      records,
      clock: fakeClock('2026-10-12T00:00:00+03:00').clock,
    });

    expect(afterMidnight.wordOfTheDay.chosen()).toBeUndefined();
    const today = await afterMidnight.wordOfTheDay.today();
    expect(today?.wordId).not.toBe(yesterday?.wordId);
    expect(today?.date).toEqual({ year: 2026, month: 10, day: 12 });
  });

  it('follows the clock to a new time zone: a new Word on a new local day, the same one on the same day', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-11T20:00:00+03:00', 'Europe/Kyiv');
    const inKyiv = await (await open({ records, clock: time.clock })).wordOfTheDay.today();

    // The same moment is still 11 October in London, but 12 October in Tokyo.
    time.moveTo('Europe/London');
    const inLondon = await (await open({ records, clock: time.clock })).wordOfTheDay.today();
    time.moveTo('Asia/Tokyo');
    const inTokyo = await (await open({ records, clock: time.clock })).wordOfTheDay.today();

    expect(inLondon).toEqual(inKyiv);
    expect(inTokyo?.wordId).not.toBe(inKyiv?.wordId);
    expect(inTokyo?.date).toEqual({ year: 2026, month: 10, day: 12 });
  });

  it('is never a Word already Seen in the Cycle', async () => {
    const records = new Map<string, string>();
    const read = [];
    for (let day = 11; day < 11 + wordIds.length; day++)
      read.push((await readOn(records, day)).today?.wordId);

    expect(new Set(read)).toEqual(new Set(wordIds));
  });

  it('passes over the Words to avoid while the Cycle has other unseen Words', async () => {
    const { cycle, wordOfTheDay } = await open({ words: wordIds.slice(0, 3) });
    const [first = '', second = '', third = ''] = cycle.unseen().words;

    expect((await wordOfTheDay.today({ avoid: new Set([first, second]) }))?.wordId).toBe(third);
  });

  it('takes a Word to avoid when the Cycle has no other unseen Word', async () => {
    const { cycle, wordOfTheDay } = await open({ words: wordIds.slice(0, 2) });

    expect((await wordOfTheDay.today({ avoid: new Set(wordIds) }))?.wordId).toBe(
      cycle.unseen().words[0],
    );
  });

  describe('when every Word is Seen', () => {
    it('starts a new Cycle, in which nothing is Seen, with a Word other than the day before', async () => {
      const records = new Map<string, string>();
      for (let day = 11; day < 11 + wordIds.length; day++) await readOn(records, day);
      const dayBefore = (
        await open({ records, clock: fakeClock('2026-10-20T21:00:00+03:00').clock })
      ).wordOfTheDay.chosen();

      const { cycle, wordOfTheDay } = await open({
        records,
        clock: fakeClock('2026-10-21T09:00:00+03:00').clock,
        random: randomOf(0.75),
      });
      expect(cycle.unseen().words).toEqual([]);
      const today = await wordOfTheDay.today({ avoid: new Set(wordIds) });

      expect(today?.startedCycle).toBe(true);
      expect(today?.date).toEqual({ year: 2026, month: 10, day: 21 });
      expect(today?.wordId).not.toBe(dayBefore?.wordId);
      expect(new Set(cycle.unseen().words)).toEqual(new Set(wordIds));
      // The Words to avoid were shown in the Cycle before, so they don't count in the new one.
      expect(today?.wordId).toBe(cycle.unseen().words.find((id) => id !== dayBefore?.wordId));
    });

    it('keeps the new Cycle and the Word of the Day in one write, never one without the other', async () => {
      const records = new Map<string, string>();
      for (let day = 11; day < 11 + wordIds.length; day++) await readOn(records, day);
      // The disk fills up after one more write.
      const memory = createMemoryUserStatePort(records);
      let writesLeft = 1;
      const fillingUp: UserStatePort = {
        get: (key) => memory.get(key),
        list: (prefix) => memory.list(prefix),
        write: (changes) =>
          writesLeft-- > 0 ? memory.write(changes) : Promise.reject(new Error('The disk is full')),
      };
      const nextDay = fakeClock('2026-10-21T09:00:00+03:00').clock;
      const today = await (
        await open({ records, port: fillingUp, clock: nextDay })
      ).wordOfTheDay.today();

      const reopened = await open({ records, clock: nextDay });

      expect(reopened.wordOfTheDay.chosen()?.wordId).toBe(today?.wordId);
      expect(new Set(reopened.cycle.unseen().words)).toEqual(new Set(wordIds));
    });

    it('changes neither the Cycle nor the choice in memory when the write fails, so a retry starts one new Cycle', async () => {
      const records = new Map<string, string>();
      for (let day = 11; day < 11 + wordIds.length; day++) await readOn(records, day);
      const memory = createMemoryUserStatePort(records);
      let full = true;
      const port: UserStatePort = {
        ...memory,
        write: (changes) =>
          full ? Promise.reject(new Error('The disk is full')) : memory.write(changes),
      };
      const nextDay = fakeClock('2026-10-21T09:00:00+03:00').clock;
      const run = await open({ records, port, clock: nextDay, random: randomSequence(0.75, 0.5) });
      const before = run.cycle.order();

      await expect(run.wordOfTheDay.today()).rejects.toThrow('The disk is full');

      expect(run.cycle.order()).toEqual(before);
      expect(run.cycle.unseen().words).toEqual([]);
      expect(run.wordOfTheDay.chosen()).toBeUndefined();
      full = false;
      const today = await run.wordOfTheDay.today();
      const reopened = await open({ records, clock: nextDay });
      expect(run.cycle.order()).toEqual(reopened.cycle.order());
      expect(run.cycle.unseen()).toEqual(reopened.cycle.unseen());
      expect(reopened.wordOfTheDay.chosen()?.wordId).toBe(today?.wordId);
    });
  });

  it('is chosen again when the Word of the Day was retired since, never shown retired', async () => {
    const records = new Map<string, string>();
    const morning = await (await open({ records })).wordOfTheDay.today();

    const evening = await open({
      records,
      clock: fakeClock('2026-10-11T21:00:00+03:00').clock,
      words: wordIds.filter((id) => id !== morning?.wordId),
    });
    const today = await evening.wordOfTheDay.today();

    expect(today?.wordId).not.toBe(morning?.wordId);
    expect(today?.date).toEqual({ year: 2026, month: 10, day: 11 });
    expect(evening.wordOfTheDay.chosen()?.wordId).toBe(today?.wordId);
  });

  it('takes no Word without a morning notification, and starts no Cycle though every Word is Seen', async () => {
    const records = new Map(wordIds.map((id) => [`feed.seen.${id}`, '1']));
    const allSeen = await open({ records });
    await allSeen.wordOfTheDay.takeMorningWord();
    expect(allSeen.wordOfTheDay.chosen()).toBeUndefined();
    expect(records.get('feed.cycle')).toContain('"id":1');
  });

  it('is never a Correction, and nothing when the Cycle covers no Word', async () => {
    const records = new Map<string, string>();
    const withCorrections = await open({ records, corrections: correctionIds });
    expect((await withCorrections.wordOfTheDay.today())?.wordId).toMatch(/^w_/);

    const correctionsOnly = await open({ words: [], corrections: correctionIds });
    for (const id of correctionIds) correctionsOnly.cycle.markSeen(id).commit();

    expect(await correctionsOnly.wordOfTheDay.today()).toBeUndefined();
    // No Word to choose is no reason to start a new Cycle.
    expect(correctionsOnly.cycle.unseen().corrections).toEqual([]);
  });
});
