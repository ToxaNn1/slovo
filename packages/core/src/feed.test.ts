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

    it('opens on the first unseen card of the Cycle on another local day, in the clock time zone', async () => {
      const records = new Map<string, string>();
      const firstOfCycle = (await walk(await run()))[0];
      await readUntil(records, '2026-10-11T23:30:00+03:00', 3);

      // Still 11 October in UTC, but already 12 October in Kyiv.
      const reopened = await run({
        records,
        clock: fakeClock('2026-10-12T00:10:00+03:00').clock,
      });

      expect(reopened.cards.map((card) => card.entry.id)).toEqual([firstOfCycle]);
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
