import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openFeed,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type ContentReadPort,
  type Feed,
  type Random,
} from './index';

function word(id: string, retired = false): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [0],
    partOfSpeech: 'noun',
    primaryDefinition: 'A meaning.',
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

/** A small pack: ten live Words and two Retired ones. */
const liveIds = Array.from({ length: 10 }, (_, index) => `w_live${String(index)}`);
const retiredIds = ['w_retired0', 'w_retired1'];
const pack = [...liveIds.map((id) => word(id)), ...retiredIds.map((id) => word(id, true))];

function contentOf(words: readonly Word[]): ContentReadPort {
  return {
    listWordIds: () => Promise.resolve(words.filter((w) => !w.retired).map((w) => w.id)),
    getWord: (id) => Promise.resolve(words.find((w) => w.id === id)),
    getCorrection: () => Promise.resolve(undefined),
    listLinkedWordIds: () => Promise.resolve([]),
  };
}

/** A clock the test moves by hand, in a time zone it can change. */
function fakeClock(start: string, timeZone = 'Europe/Kyiv') {
  let now = new Date(start).getTime();
  let zone = timeZone;
  const clock: Clock = { now: () => new Date(now), timeZone: () => zone };
  return {
    clock,
    advance(ms: number) {
      now += ms;
    },
    moveTo(timeZoneName: string) {
      zone = timeZoneName;
    },
  };
}

/** A random port that always draws the same number, so the Cycle seed is fixed. */
const randomOf = (value: number): Random => ({ next: () => value });

/** One app run over the given records: the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock('2026-10-11T09:00:00+03:00').clock,
  random = randomOf(0.25),
  words = pack,
}: {
  records?: Map<string, string>;
  clock?: Clock;
  random?: Random;
  words?: readonly Word[];
} = {}): Promise<Feed> {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return openFeed({ content: contentOf(words), userState, clock, random });
}

/** The ids of every card the Feed offers from where it stands, until it repeats or runs out. */
async function walk(feed: Feed): Promise<string[]> {
  const ids = feed.cards.map((card) => card.entry.id);
  for (;;) {
    const card = await feed.next();
    if (card === undefined || ids.includes(card.entry.id)) return ids;
    ids.push(card.entry.id);
  }
}

describe('the Feed', () => {
  it('offers every live Word once and never a Retired Word', async () => {
    const ids = await walk(await run());

    expect(ids).toHaveLength(liveIds.length);
    expect(new Set(ids)).toEqual(new Set(liveIds));
  });

  it('shuffles the Words with the Cycle seed: the same seed gives the same order, another seed another', async () => {
    const first = await walk(await run({ random: randomOf(0.25) }));
    const again = await walk(await run({ random: randomOf(0.25) }));
    const other = await walk(await run({ random: randomOf(0.75) }));

    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
    expect(first).not.toEqual(liveIds);
  });

  it('gives two cards in turn when asked for the next card twice at once', async () => {
    const expected = await walk(await run());
    const feed = await run();

    const [second, third] = await Promise.all([feed.next(), feed.next()]);

    expect([second?.entry.id, third?.entry.id]).toEqual(expected.slice(1, 3));
    expect(feed.cards).toHaveLength(3);
  });

  it('keeps the order of the Cycle across a restart, whatever the random port draws then', async () => {
    const records = new Map<string, string>();
    const before = await walk(await run({ records, random: randomOf(0.25) }));

    const after = await walk(await run({ records, random: randomOf(0.75) }));

    expect(after).toEqual(before);
  });

  describe('Seen', () => {
    /** Shows the card at `position` for `ms`, as the UI reports it. */
    async function look(
      feed: Feed,
      time: ReturnType<typeof fakeClock>,
      position: number,
      ms: number,
    ) {
      await feed.cardVisible(position);
      time.advance(ms);
      await feed.cardHidden(position);
    }

    /** The Words still unseen in the Cycle, as the next app run offers them a day later. */
    async function unseenNextDay(records: Map<string, string>) {
      const nextDay = fakeClock('2026-10-12T09:00:00+03:00').clock;
      return walk(await run({ records, clock: nextDay }));
    }

    it(`marks an Entry Seen once its card stayed on screen ${String(SEEN_DWELL_MS)} ms, and never offers it again in the Cycle`, async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      const first = feed.cards[0]?.entry.id;

      await look(feed, time, 0, SEEN_DWELL_MS);

      const unseen = await unseenNextDay(records);
      expect(unseen).toHaveLength(liveIds.length - 1);
      expect(unseen).not.toContain(first);
    });

    it('leaves an Entry unseen when its card is swiped past quickly', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      await feed.next();

      await look(feed, time, 0, SEEN_DWELL_MS - 1);
      await look(feed, time, 1, 300);

      expect(await unseenNextDay(records)).toHaveLength(liveIds.length);
    });

    it('leaves Seen untouched when the reader swipes back over cards already shown', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      await feed.next();
      await feed.next();
      const [read, skipped, alsoRead] = feed.cards.map((card) => card.entry.id);
      await look(feed, time, 0, 4000);
      await look(feed, time, 1, 200);
      await look(feed, time, 2, 4000);

      // Back over the skipped card to the first one, and stay there.
      await look(feed, time, 1, 200);
      await look(feed, time, 0, 60_000);

      const unseen = await unseenNextDay(records);
      expect(unseen).toHaveLength(liveIds.length - 2);
      expect(unseen).toContain(skipped);
      expect(unseen).not.toContain(read);
      expect(unseen).not.toContain(alsoRead);
    });

    it('goes on after the last card shown when the reader comes back from going back', async () => {
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ clock: time.clock });
      const expected = await walk(await run());
      await feed.next();
      await look(feed, time, 1, 200);
      await look(feed, time, 0, 200);

      const card = await feed.next();

      expect(card?.entry.id).toBe(expected[2]);
      expect(feed.cards.map((shown) => shown.entry.id)).toEqual(expected.slice(0, 3));
    });

    it('marks a card Seen when the reader goes back to it and stays, as for any card on screen', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      await feed.next();
      await look(feed, time, 0, 200);
      await look(feed, time, 1, 200);

      await look(feed, time, 0, SEEN_DWELL_MS);

      expect(await unseenNextDay(records)).not.toContain(feed.cards[0]?.entry.id);
    });

    it('offers no Seen Word again after a restart in the same Cycle', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      await feed.next();
      await feed.next();
      for (const position of [0, 1, 2]) await look(feed, time, position, SEEN_DWELL_MS);
      const read = feed.cards.map((card) => card.entry.id);

      time.advance(60_000);
      const restarted = await run({ records, clock: time.clock });
      const offered = (await walk(restarted)).slice(1);

      expect(offered).toHaveLength(liveIds.length - read.length);
      for (const id of read) expect(offered).not.toContain(id);
    });
  });

  describe('the end of the unseen Words', () => {
    const small = [word('w_one'), word('w_two'), word('w_three'), word('w_old', true)];

    it('offers the Words swiped past quickly again, in the Cycle order, once every unseen Word was shown', async () => {
      const feed = await run({ words: small });
      const order = await walk(await run({ words: small }));
      await feed.next();
      await feed.next();

      const again = [await feed.next(), await feed.next()];

      expect(again.map((card) => card?.entry.id)).toEqual(order.slice(0, 2));
    });

    it('offers nothing more once every live Word is Seen', async () => {
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ words: small, clock: time.clock });
      for (let position = 0; position < 3; position++) {
        if (position > 0) await feed.next();
        await feed.cardVisible(position);
        time.advance(SEEN_DWELL_MS);
        await feed.cardHidden(position);
      }

      expect(await feed.next()).toBeUndefined();
    });
  });

  describe('last position', () => {
    async function readUntil(records: Map<string, string>, start: string, position: number) {
      const time = fakeClock(start);
      const feed = await run({ records, clock: time.clock });
      while (feed.cards.length <= position) await feed.next();
      await feed.cardVisible(position);
      time.advance(500);
      return feed.cards[position]?.entry.id;
    }

    it('opens on the card the reader was on when the app reopens the same day', async () => {
      const records = new Map<string, string>();
      const last = await readUntil(records, '2026-10-11T09:00:00+03:00', 3);

      const reopened = await run({
        records,
        clock: fakeClock('2026-10-11T21:00:00+03:00').clock,
      });

      expect(reopened.cards.map((card) => card.entry.id)).toEqual([last]);
    });

    it("opens on the day's Word of the Day on another local day, in the clock time zone", async () => {
      const records = new Map<string, string>();
      const last = await readUntil(records, '2026-10-11T23:30:00+03:00', 3);

      // Still 11 October in UTC, but already 12 October in Kyiv.
      const reopened = await run({
        records,
        clock: fakeClock('2026-10-12T00:10:00+03:00').clock,
      });

      expect(reopened.cards).toHaveLength(1);
      expect(reopened.cards[0]?.entry.id).not.toBe(last);
      expect(reopened.cards[0]?.wordOfTheDay).toEqual({ year: 2026, month: 10, day: 12 });
    });

    it('does not open on a Word that was retired since', async () => {
      const records = new Map<string, string>();
      const last = await readUntil(records, '2026-10-11T09:00:00+03:00', 3);

      const reopened = await run({
        records,
        clock: fakeClock('2026-10-11T10:00:00+03:00').clock,
        words: pack.map((w) => (w.id === last ? { ...w, retired: true } : w)),
      });

      expect(reopened.cards.map((card) => card.entry.id)).not.toContain(last);
      expect(reopened.cards).toHaveLength(1);
    });
  });
});

describe('the Word of the Day', () => {
  it('opens the first Feed of the local day, marked with that day', async () => {
    const feed = await run({ clock: fakeClock('2026-10-11T09:00:00+03:00').clock });

    expect(feed.cards).toHaveLength(1);
    expect(feed.cards[0]?.wordOfTheDay).toEqual({ year: 2026, month: 10, day: 11 });
    expect(liveIds).toContain(feed.cards[0]?.entry.id);
  });

  it('stays the same, with its mark, when the app reopens later the same local day', async () => {
    const records = new Map<string, string>();
    const morning = fakeClock('2026-10-11T00:05:00+03:00');
    const first = await run({ records, clock: morning.clock });
    await first.cardVisible(0);
    morning.advance(300);
    await first.cardHidden(0);

    const evening = await run({
      records,
      clock: fakeClock('2026-10-11T23:55:00+03:00').clock,
      random: randomOf(0.75),
    });

    expect(
      evening.cards.map(({ entry, wordOfTheDay }) => ({ id: entry.id, wordOfTheDay })),
    ).toEqual([{ id: first.cards[0]?.entry.id, wordOfTheDay: { year: 2026, month: 10, day: 11 } }]);
  });

  it('changes at local midnight, even when the reader only glanced at the one before', async () => {
    const records = new Map<string, string>();
    const lateEvening = fakeClock('2026-10-11T23:50:00+03:00');
    const yesterday = await run({ records, clock: lateEvening.clock });
    await yesterday.cardVisible(0);
    lateEvening.advance(300);
    await yesterday.cardHidden(0);

    const beforeMidnight = await run({
      records,
      clock: fakeClock('2026-10-11T23:59:59+03:00').clock,
    });
    const afterMidnight = await run({
      records,
      clock: fakeClock('2026-10-12T00:00:00+03:00').clock,
    });

    expect(beforeMidnight.cards[0]?.entry.id).toBe(yesterday.cards[0]?.entry.id);
    expect(afterMidnight.cards).toHaveLength(1);
    expect(afterMidnight.cards[0]?.entry.id).not.toBe(yesterday.cards[0]?.entry.id);
    expect(afterMidnight.cards[0]?.wordOfTheDay).toEqual({ year: 2026, month: 10, day: 12 });
  });

  it('follows the clock to a new time zone: a new Word on a new local day, the same one on the same day', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-11T20:00:00+03:00', 'Europe/Kyiv');
    const inKyiv = await run({ records, clock: time.clock });

    // The same moment is still 11 October in London, but 12 October in Tokyo.
    time.moveTo('Europe/London');
    const inLondon = await run({ records, clock: time.clock });
    time.moveTo('Asia/Tokyo');
    const inTokyo = await run({ records, clock: time.clock });

    expect(inLondon.cards[0]?.entry.id).toBe(inKyiv.cards[0]?.entry.id);
    expect(inLondon.cards[0]?.wordOfTheDay).toEqual({ year: 2026, month: 10, day: 11 });
    expect(inTokyo.cards[0]?.entry.id).not.toBe(inKyiv.cards[0]?.entry.id);
    expect(inTokyo.cards[0]?.wordOfTheDay).toEqual({ year: 2026, month: 10, day: 12 });
  });

  /** Opens the Feed on each of `days` mornings in turn and reads the Word of the Day only. */
  async function readWordsOfTheDay(records: Map<string, string>, days: number, words = pack) {
    const read: string[] = [];
    for (let day = 0; day < days; day++) {
      const time = fakeClock(`2026-10-${String(11 + day)}T09:00:00+03:00`);
      const feed = await run({ records, clock: time.clock, words });
      await feed.cardVisible(0);
      time.advance(SEEN_DWELL_MS);
      await feed.cardHidden(0);
      read.push(feed.cards[0]?.entry.id ?? '');
    }
    return read;
  }

  it('is never a Word already Seen in the Cycle', async () => {
    const read = await readWordsOfTheDay(new Map(), liveIds.length);

    expect(new Set(read)).toEqual(new Set(liveIds));
  });

  it('starts a new Cycle when every Word is Seen, with a Word other than the day before', async () => {
    const records = new Map<string, string>();
    const read = await readWordsOfTheDay(records, liveIds.length);

    const time = fakeClock('2026-10-21T09:00:00+03:00');
    const feed = await run({ records, clock: time.clock, random: randomOf(0.75) });

    expect(feed.cards[0]?.wordOfTheDay).toEqual({ year: 2026, month: 10, day: 21 });
    expect(feed.cards[0]?.entry.id).not.toBe(read.at(-1));
    // Nothing is Seen in the new Cycle: the Feed offers every live Word again.
    expect(new Set(await walk(feed))).toEqual(new Set(liveIds));
  });

  it('starts the new local day in a Feed left open over midnight', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const feed = await run({ clock: time.clock });
    await feed.next();

    time.advance(5 * 60_000);
    const card = await feed.next();

    expect(card?.wordOfTheDay).toEqual({ year: 2026, month: 10, day: 12 });
    expect(feed.cards.slice(0, 2).map((shown) => shown.entry.id)).not.toContain(card?.entry.id);
    expect((await feed.next())?.wordOfTheDay).toBeUndefined();
  });

  it('is chosen again when the Word of the Day was retired since, never shown retired', async () => {
    const records = new Map<string, string>();
    const morning = await run({ records, clock: fakeClock('2026-10-11T09:00:00+03:00').clock });
    const retired = morning.cards[0]?.entry.id;

    const evening = await run({
      records,
      clock: fakeClock('2026-10-11T21:00:00+03:00').clock,
      words: pack.map((w) => (w.id === retired ? { ...w, retired: true } : w)),
    });

    expect(evening.cards).toHaveLength(1);
    expect(evening.cards[0]?.entry.id).not.toBe(retired);
    expect(evening.cards[0]?.wordOfTheDay).toEqual({ year: 2026, month: 10, day: 11 });
  });
});
