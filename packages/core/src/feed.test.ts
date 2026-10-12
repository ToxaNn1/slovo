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
  type FeedCard,
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

/** A random port that draws the given numbers in turn, so each new Cycle gets the next seed. */
function randomSequence(...values: number[]): Random {
  let drawn = 0;
  return { next: () => values[drawn++ % values.length] ?? 0 };
}

/** The id of the Entry a card shows, if it shows one. */
const entryIdOf = (card: FeedCard | undefined) =>
  card?.kind === 'entry' ? card.entry.id : undefined;

/** The local day a card is the Word of the Day of, if it is. */
const wordOfTheDayOf = (card: FeedCard | undefined) =>
  card?.kind === 'entry' ? card.wordOfTheDay : undefined;

/** The ids of the Entries the cards show, in order. */
const entryIdsOf = (cards: readonly FeedCard[]) =>
  cards.flatMap((card) => (card.kind === 'entry' ? [card.entry.id] : []));

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

/**
 * The ids of every Entry the Feed offers from where it stands, until it
 * repeats, reaches the end of the Cycle or runs out.
 */
async function walk(feed: Feed): Promise<string[]> {
  const ids = entryIdsOf(feed.cards);
  for (;;) {
    const id = entryIdOf(await feed.next());
    if (id === undefined || ids.includes(id)) return ids;
    ids.push(id);
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

    expect([entryIdOf(second), entryIdOf(third)]).toEqual(expected.slice(1, 3));
    expect(feed.cards).toHaveLength(3);
  });

  it('keeps the order of the Cycle across a restart, whatever the random port draws then', async () => {
    const records = new Map<string, string>();
    const before = await walk(await run({ records, random: randomOf(0.25) }));

    const after = await walk(await run({ records, random: randomOf(0.75) }));

    expect(after).toEqual(before);
  });

  it('gives every card the Word card of its Entry', async () => {
    const feed = await run();
    const next = await feed.next();

    for (const card of [feed.cards[0], next]) {
      expect(card?.kind === 'entry' ? card.wordCard : undefined).toMatchObject({
        kind: 'word',
        wordId: entryIdOf(card),
        primaryDefinition: 'A meaning.',
      });
    }
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
      const first = entryIdOf(feed.cards[0]);

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
      const [read, skipped, alsoRead] = entryIdsOf(feed.cards);
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

      expect(entryIdOf(card)).toBe(expected[2]);
      expect(entryIdsOf(feed.cards)).toEqual(expected.slice(0, 3));
    });

    it('marks a card Seen when the reader goes back to it and stays, as for any card on screen', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      await feed.next();
      await look(feed, time, 0, 200);
      await look(feed, time, 1, 200);

      await look(feed, time, 0, SEEN_DWELL_MS);

      expect(await unseenNextDay(records)).not.toContain(entryIdOf(feed.cards[0]));
    });

    it('offers no Seen Word again after a restart in the same Cycle', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      await feed.next();
      await feed.next();
      for (const position of [0, 1, 2]) await look(feed, time, position, SEEN_DWELL_MS);
      const read = entryIdsOf(feed.cards);

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

      expect(again.map(entryIdOf)).toEqual(order.slice(0, 2));
    });
  });

  describe('the end of the Cycle', () => {
    const small = [word('w_one'), word('w_two'), word('w_three'), word('w_old', true)];

    /**
     * Reads the last card as the app does: the card comes on screen, the app
     * asks for the next card at once to have it ready, and the reader stays
     * `ms` before swiping on. Returns the card the app got ready.
     */
    async function readLastCard(feed: Feed, time: ReturnType<typeof fakeClock>, ms: number) {
      const position = feed.cards.length - 1;
      await feed.cardVisible(position);
      const next = await feed.next();
      time.advance(ms);
      await feed.cardHidden(position);
      return next;
    }

    /** Reads every Word of the Cycle as the app does, up to the end-of-Cycle card. */
    async function readToTheEnd(feed: Feed, time: ReturnType<typeof fakeClock>) {
      while ((await readLastCard(feed, time, SEEN_DWELL_MS))?.kind !== 'end-of-cycle');
    }

    it('follows the last unseen Word with the end-of-Cycle card, and no Word before it', async () => {
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ words: small, clock: time.clock });

      const kinds = [];
      for (let card = 0; card < 3; card++)
        kinds.push((await readLastCard(feed, time, SEEN_DWELL_MS))?.kind);

      expect(kinds).toEqual(['entry', 'entry', 'end-of-cycle']);
      expect(new Set(entryIdsOf(feed.cards))).toEqual(new Set(['w_one', 'w_two', 'w_three']));
    });

    it('holds the end-of-Cycle card back while a Word swiped past quickly is still unseen', async () => {
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ words: small, clock: time.clock });
      await readLastCard(feed, time, SEEN_DWELL_MS);
      await readLastCard(feed, time, 200);
      const skipped = entryIdOf(feed.cards[1]);

      const again = await readLastCard(feed, time, SEEN_DWELL_MS);
      const end = await readLastCard(feed, time, SEEN_DWELL_MS);

      expect(entryIdOf(again)).toBe(skipped);
      expect(end?.kind).toBe('end-of-cycle');
    });

    it('starts a new Cycle on the card after it: nothing Seen, in a new order from a new seed', async () => {
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ clock: time.clock, random: randomSequence(0.25, 0.75) });
      await readToTheEnd(feed, time);
      const lastCycle = entryIdsOf(feed.cards);

      const newCycle: string[] = [];
      while (newCycle.length < liveIds.length)
        newCycle.push(entryIdOf(await readLastCard(feed, time, SEEN_DWELL_MS)) ?? 'none');

      expect(lastCycle).toEqual(await walk(await run({ random: randomOf(0.25) })));
      // The order a first Cycle shuffled with the second seed has.
      expect(newCycle).toEqual(await walk(await run({ random: randomOf(0.75) })));
      expect(newCycle).not.toEqual(lastCycle);
      expect((await readLastCard(feed, time, SEEN_DWELL_MS))?.kind).toBe('end-of-cycle');
    });

    it('keeps the new Cycle across a restart: nothing from the last Cycle Seen, the order of the new seed', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock, random: randomSequence(0.25, 0.75) });
      await readToTheEnd(feed, time);
      await readLastCard(feed, time, SEEN_DWELL_MS);
      await readLastCard(feed, time, SEEN_DWELL_MS);

      time.advance(60_000);
      const restarted = await run({ records, clock: time.clock, random: randomOf(0.5) });

      // It reopens on the new Cycle's first card and goes on in that Cycle's order.
      expect(await walk(restarted)).toEqual(await walk(await run({ random: randomOf(0.75) })));
    });

    it('leaves the last position on the last Word, so the app reopens there and the end-of-Cycle card follows again', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, words: small, clock: time.clock });
      await readToTheEnd(feed, time);
      await feed.cardVisible(feed.cards.length - 1);

      time.advance(60_000);
      const restarted = await run({ records, words: small, clock: time.clock });

      expect(entryIdsOf(restarted.cards)).toEqual(entryIdsOf(feed.cards).slice(-1));
      expect((await restarted.next())?.kind).toBe('end-of-cycle');
    });

    it('lets a new local day start the new Cycle with its Word of the Day, without a second end-of-Cycle card', async () => {
      const time = fakeClock('2026-10-11T23:00:00+03:00');
      const feed = await run({ words: small, clock: time.clock });
      await readToTheEnd(feed, time);

      time.advance(2 * 60 * 60_000);
      const newCycle = [await feed.next(), await feed.next(), await feed.next()];

      expect(wordOfTheDayOf(newCycle[0])).toEqual({ year: 2026, month: 10, day: 12 });
      // Nothing is Seen in the new Cycle: every Word comes again.
      expect(new Set(newCycle.map(entryIdOf))).toEqual(new Set(['w_one', 'w_two', 'w_three']));
    });

    it('counts nothing Seen in the new Cycle when the reader goes back to a card of the last one', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, words: small, clock: time.clock });
      await readToTheEnd(feed, time);
      await readLastCard(feed, time, SEEN_DWELL_MS);

      await feed.cardVisible(0);
      time.advance(10_000);
      await feed.cardHidden(0);

      const nextDay = await run({
        records,
        words: small,
        clock: fakeClock('2026-10-12T09:00:00+03:00').clock,
      });
      expect(await walk(nextDay)).toHaveLength(3);
    });

    it('never comes when the Language Pack has no live Word', async () => {
      const feed = await run({ words: [word('w_old', true)] });

      expect(feed.cards).toEqual([]);
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
      return entryIdOf(feed.cards[position]);
    }

    it('opens on the card the reader was on when the app reopens the same day', async () => {
      const records = new Map<string, string>();
      const last = await readUntil(records, '2026-10-11T09:00:00+03:00', 3);

      const reopened = await run({
        records,
        clock: fakeClock('2026-10-11T21:00:00+03:00').clock,
      });

      expect(entryIdsOf(reopened.cards)).toEqual([last]);
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
      expect(entryIdOf(reopened.cards[0])).not.toBe(last);
      expect(wordOfTheDayOf(reopened.cards[0])).toEqual({ year: 2026, month: 10, day: 12 });
    });

    it('does not open on a Word that was retired since', async () => {
      const records = new Map<string, string>();
      const last = await readUntil(records, '2026-10-11T09:00:00+03:00', 3);

      const reopened = await run({
        records,
        clock: fakeClock('2026-10-11T10:00:00+03:00').clock,
        words: pack.map((w) => (w.id === last ? { ...w, retired: true } : w)),
      });

      expect(entryIdsOf(reopened.cards)).not.toContain(last);
      expect(reopened.cards).toHaveLength(1);
    });
  });
});

describe('the Word of the Day', () => {
  it('opens the first Feed of the local day, marked with that day', async () => {
    const feed = await run({ clock: fakeClock('2026-10-11T09:00:00+03:00').clock });

    expect(feed.cards).toHaveLength(1);
    expect(wordOfTheDayOf(feed.cards[0])).toEqual({ year: 2026, month: 10, day: 11 });
    expect(liveIds).toContain(entryIdOf(feed.cards[0]));
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
      evening.cards.map((card) => ({ id: entryIdOf(card), wordOfTheDay: wordOfTheDayOf(card) })),
    ).toEqual([
      { id: entryIdOf(first.cards[0]), wordOfTheDay: { year: 2026, month: 10, day: 11 } },
    ]);
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

    expect(entryIdOf(beforeMidnight.cards[0])).toBe(entryIdOf(yesterday.cards[0]));
    expect(afterMidnight.cards).toHaveLength(1);
    expect(entryIdOf(afterMidnight.cards[0])).not.toBe(entryIdOf(yesterday.cards[0]));
    expect(wordOfTheDayOf(afterMidnight.cards[0])).toEqual({ year: 2026, month: 10, day: 12 });
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

    expect(entryIdOf(inLondon.cards[0])).toBe(entryIdOf(inKyiv.cards[0]));
    expect(wordOfTheDayOf(inLondon.cards[0])).toEqual({ year: 2026, month: 10, day: 11 });
    expect(entryIdOf(inTokyo.cards[0])).not.toBe(entryIdOf(inKyiv.cards[0]));
    expect(wordOfTheDayOf(inTokyo.cards[0])).toEqual({ year: 2026, month: 10, day: 12 });
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
      read.push(entryIdOf(feed.cards[0]) ?? '');
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

    expect(wordOfTheDayOf(feed.cards[0])).toEqual({ year: 2026, month: 10, day: 21 });
    expect(entryIdOf(feed.cards[0])).not.toBe(read.at(-1));
    // Nothing is Seen in the new Cycle: the Feed offers every live Word again.
    expect(new Set(await walk(feed))).toEqual(new Set(liveIds));
  });

  it('starts the new local day in a Feed left open over midnight', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const feed = await run({ clock: time.clock });
    await feed.next();

    time.advance(5 * 60_000);
    const card = await feed.next();

    expect(wordOfTheDayOf(card)).toEqual({ year: 2026, month: 10, day: 12 });
    expect(entryIdsOf(feed.cards.slice(0, 2))).not.toContain(entryIdOf(card));
    expect(wordOfTheDayOf(await feed.next())).toBeUndefined();
  });

  it('is chosen again when the Word of the Day was retired since, never shown retired', async () => {
    const records = new Map<string, string>();
    const morning = await run({ records, clock: fakeClock('2026-10-11T09:00:00+03:00').clock });
    const retired = entryIdOf(morning.cards[0]);

    const evening = await run({
      records,
      clock: fakeClock('2026-10-11T21:00:00+03:00').clock,
      words: pack.map((w) => (w.id === retired ? { ...w, retired: true } : w)),
    });

    expect(evening.cards).toHaveLength(1);
    expect(entryIdOf(evening.cards[0])).not.toBe(retired);
    expect(wordOfTheDayOf(evening.cards[0])).toEqual({ year: 2026, month: 10, day: 11 });
  });
});
