import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createEntries,
  createMemoryContentPort,
  createMemoryUserStatePort,
  openFeed,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Edition,
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

/** A small pack: ten live Words and two Retired ones. */
const liveIds = Array.from({ length: 10 }, (_, index) => `w_live${String(index)}`);
const retiredIds = ['w_retired0', 'w_retired1'];
const pack = [...liveIds.map((id) => word(id)), ...retiredIds.map((id) => word(id, true))];

/** An Edition with the Corrections Feature Switch on or off. */
const editionWith = (corrections: boolean): Pick<Edition, 'isFeatureEnabled'> => ({
  isFeatureEnabled: (feature) => feature === 'corrections' && corrections,
});

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
  card === undefined || card.kind === 'end-of-cycle' ? undefined : card.entry.id;

/** The local day a card is the Word of the Day of, if it is. */
const wordOfTheDayOf = (card: FeedCard | undefined) =>
  card?.kind === 'word' ? card.wordOfTheDay : undefined;

/** The Word card a card shows, if it shows one. */
const wordCardOf = (card: FeedCard | undefined) =>
  card?.kind === 'word' ? card.wordCard : undefined;

/** The Correction card a card shows, if it shows one. */
const correctionCardOf = (card: FeedCard | undefined) =>
  card?.kind === 'correction' ? card.correctionCard : undefined;

/** The ids of the Entries the cards show, in order. */
const entryIdsOf = (cards: readonly FeedCard[]) => cards.flatMap((card) => entryIdOf(card) ?? []);

/** One app run over the given records: the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock('2026-10-11T09:00:00+03:00').clock,
  random = randomOf(0.25),
  words = pack,
  corrections = [],
  correctionsSwitch = true,
}: {
  records?: Map<string, string>;
  clock?: Clock;
  random?: Random;
  words?: readonly Word[];
  corrections?: readonly Correction[];
  correctionsSwitch?: boolean;
} = {}): Promise<Feed> {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return openFeed({
    entries: createEntries({
      content: createMemoryContentPort({ words, corrections }),
      edition: editionWith(correctionsSwitch),
    }),
    userState,
    clock,
    random,
  });
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

  it('gives two cards in turn when asked for the next card twice at once', async () => {
    const expected = await walk(await run());
    const feed = await run();

    const [second, third] = await Promise.all([feed.next(), feed.next()]);

    expect([entryIdOf(second), entryIdOf(third)]).toEqual(expected.slice(1, 3));
    expect(feed.cards).toHaveLength(3);
  });

  it('gives every card the Word card of its Entry', async () => {
    const feed = await run();
    const next = await feed.next();

    for (const card of [feed.cards[0], next]) {
      expect(card?.kind === 'word' ? card.wordCard : undefined).toMatchObject({
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
      await feed.show(position);
      time.advance(ms);
      await feed.show(undefined);
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
      // The Feed gets card 2 ready while card 1 is on screen.
      await look(feed, time, 1, 200);
      await look(feed, time, 0, 200);

      const card = await feed.next();

      expect(entryIdOf(card)).toBe(expected[3]);
      expect(entryIdsOf(feed.cards)).toEqual(expected.slice(0, 4));
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
      // The card after them is ready, but not read.
      const read = entryIdsOf(feed.cards).slice(0, 3);

      time.advance(60_000);
      const restarted = await run({ records, clock: time.clock });
      const offered = (await walk(restarted)).slice(1);

      expect(offered).toHaveLength(liveIds.length - read.length);
      for (const id of read) expect(offered).not.toContain(id);
    });
  });

  describe('the card on screen', () => {
    /** Whether the Entry of the first card is Seen, as the next app run a day later tells. */
    async function firstSeen(feed: Feed, records: Map<string, string>) {
      const nextDay = fakeClock('2026-10-12T09:00:00+03:00').clock;
      return !(await walk(await run({ records, clock: nextDay }))).includes(
        entryIdOf(feed.cards[0]) ?? '',
      );
    }

    it('keeps the card after the one on screen ready, and only that one', async () => {
      const feed = await run();

      await feed.show(0);
      expect(feed.cards).toHaveLength(2);

      await feed.show(1);
      expect(feed.cards).toHaveLength(3);

      await feed.show(0);
      await feed.show(undefined);
      expect(feed.cards).toHaveLength(3);
    });

    it('gets nothing ready while no card is on screen', async () => {
      const feed = await run();

      await feed.show(undefined);

      expect(feed.cards).toHaveLength(1);
    });

    it('gets the next card ready once when the card goes off screen and back before it is ready', async () => {
      const feed = await run();

      await Promise.all([feed.show(0), feed.show(undefined), feed.show(0)]);

      expect(feed.cards).toHaveLength(2);
    });

    it('gets the card after the ready one too when the reader turns onto it before that came', async () => {
      const feed = await run();
      await feed.show(0);

      await Promise.all([feed.show(1), feed.show(2)]);

      expect(feed.cards).toHaveLength(4);
    });

    it('gets the next card ready again when the card on screen is reported again after it failed', async () => {
      const content = createMemoryContentPort({ words: pack });
      let failing = false;
      const feed = await openFeed({
        entries: createEntries({
          content: {
            ...content,
            getWord: (id) => (failing ? Promise.reject(new Error('disk')) : content.getWord(id)),
          },
          edition: editionWith(false),
        }),
        userState: await openUserState({ port: createMemoryUserStatePort() }),
        clock: fakeClock('2026-10-11T09:00:00+03:00').clock,
        random: randomOf(0.25),
      });

      failing = true;
      await expect(feed.show(0)).rejects.toThrow('disk');
      expect(feed.cards).toHaveLength(1);

      failing = false;
      await feed.show(0);
      expect(feed.cards).toHaveLength(2);
    });

    it('keeps counting the dwell time when the card on screen is reported again', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });

      await feed.show(0);
      time.advance(SEEN_DWELL_MS - 500);
      await feed.show(0);
      time.advance(500);
      await feed.show(undefined);

      expect(await firstSeen(feed, records)).toBe(true);
    });

    it('stops counting the dwell time while no card is on screen, as when the app is in the background', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });

      await feed.show(0);
      time.advance(SEEN_DWELL_MS - 500);
      await feed.show(undefined);
      time.advance(60_000);
      await feed.show(0);
      time.advance(SEEN_DWELL_MS - 500);
      await feed.show(1);

      expect(await firstSeen(feed, records)).toBe(false);
    });

    it('tells its subscribers when the cards change, each time in a new array', async () => {
      const feed = await run();
      const before = feed.cards;
      const told: (readonly FeedCard[])[] = [];
      const stop = feed.subscribe(() => told.push(feed.cards));

      await feed.show(0);

      expect(told).toEqual([feed.cards]);
      expect(feed.cards).not.toBe(before);
      expect(before).toHaveLength(1);

      stop();
      await feed.next();
      expect(told).toHaveLength(1);
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
     * Reads the last card: it comes on screen, the Feed gets the next card
     * ready, and the reader stays `ms` before swiping on. Returns the card the
     * Feed got ready.
     */
    async function readLastCard(feed: Feed, time: ReturnType<typeof fakeClock>, ms: number) {
      const position = feed.cards.length - 1;
      await feed.show(position);
      time.advance(ms);
      await feed.show(undefined);
      return feed.cards[position + 1];
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

      expect(kinds).toEqual(['word', 'word', 'end-of-cycle']);
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

    it('shows the last unseen Word again in place of the end-of-Cycle card when the reader swipes past it quickly', async () => {
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ words: small, clock: time.clock });
      await readLastCard(feed, time, SEEN_DWELL_MS);
      await readLastCard(feed, time, SEEN_DWELL_MS);
      await feed.show(2);
      const last = entryIdOf(feed.cards[2]);

      // Off the last unseen Word after 200 ms, onto the card the Feed got ready.
      time.advance(200);
      await feed.show(3);

      expect(entryIdOf(feed.cards[3])).toBe(last);
      // The end-of-Cycle card comes once that Word is Seen.
      expect(feed.cards[4]?.kind).toBe('end-of-cycle');
      time.advance(SEEN_DWELL_MS);
      await feed.show(4);
      expect(entryIdsOf(feed.cards.slice(5))).toHaveLength(1);
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

      await feed.show(0);
      time.advance(10_000);
      await feed.show(undefined);

      const nextDay = await run({
        records,
        words: small,
        clock: fakeClock('2026-10-12T09:00:00+03:00').clock,
      });
      expect(await walk(nextDay)).toHaveLength(3);
    });

    it('counts nothing Seen in the new Cycle when a card of the last one leaves the screen while the new Cycle is being kept', async () => {
      const time = fakeClock('2026-10-11T23:00:00+03:00');
      const port = createMemoryUserStatePort();
      // Holds the next write until the test lets it through.
      let held: { came: () => void; through: Promise<void> } | undefined;
      const feed = await openFeed({
        entries: createEntries({
          content: createMemoryContentPort({ words: small }),
          edition: editionWith(false),
        }),
        userState: await openUserState({
          port: {
            ...port,
            async write(changes) {
              const hold = held;
              held = undefined;
              hold?.came();
              await hold?.through;
              return port.write(changes);
            },
          },
        }),
        clock: time.clock,
        random: randomSequence(0.25, 0.75),
      });
      await readToTheEnd(feed, time);
      const end = feed.cards.length - 1;
      let letThrough = () => undefined as void;
      const came = new Promise<void>((resolve) => {
        held = { came: resolve, through: new Promise((resolve) => (letThrough = resolve)) };
      });

      // On a new local day, the end-of-Cycle card comes on screen and the
      // Word of the Day starts a new Cycle, whose write is held.
      time.advance(2 * 60 * 60_000);
      const shown = [feed.show(end)];
      await came;
      // Meanwhile the reader goes back to a Word of the last Cycle and stays.
      shown.push(feed.show(end - 1));
      time.advance(10_000);
      shown.push(feed.show(undefined));
      letThrough();
      await Promise.all(shown);

      const newCycle = [feed.cards[end + 1], await feed.next(), await feed.next()];
      expect(new Set(newCycle.map(entryIdOf))).toEqual(new Set(['w_one', 'w_two', 'w_three']));
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
      await feed.show(position);
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

describe('the Word of the Day in the Feed', () => {
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
    await first.show(0);
    morning.advance(300);
    await first.show(undefined);

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

  it('comes next, in place of the card got ready the day before, when the app comes back from the background on a new local day', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const feed = await run({ clock: time.clock });
    await feed.show(0);
    await feed.show(undefined);

    time.advance(8 * 60 * 60_000);
    await feed.show(0);

    expect(feed.cards).toHaveLength(2);
    expect(wordOfTheDayOf(feed.cards[1])).toEqual({ year: 2026, month: 10, day: 12 });
    expect(entryIdOf(feed.cards[1])).not.toBe(entryIdOf(feed.cards[0]));
  });

  it('comes next on a new local day when the card on screen is reported again', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const feed = await run({ clock: time.clock });
    await feed.show(0);

    time.advance(5 * 60_000);
    await feed.show(0);

    expect(feed.cards).toHaveLength(2);
    expect(wordOfTheDayOf(feed.cards[1])).toEqual({ year: 2026, month: 10, day: 12 });
  });
});

describe('Corrections in the Feed', () => {
  const liveCorrections = ['c_live0', 'c_live1', 'c_live2', 'c_live3'].map((id) => correction(id));
  const corrections = [...liveCorrections, correction('c_retired', true)];
  const liveCorrectionIds = liveCorrections.map(({ id }) => id);

  /** 'W' for a Word card, 'C' for a Correction card. */
  const kindsOf = (ids: readonly string[]) =>
    ids.map((id) => (id.startsWith('c_') ? 'C' : 'W')).join('');

  /** Shows the card at `position` for `ms`, as the UI reports it. */
  async function look(
    feed: Feed,
    time: ReturnType<typeof fakeClock>,
    position: number,
    ms: number,
  ) {
    await feed.show(position);
    time.advance(ms);
    await feed.show(undefined);
  }

  it('mixes a Correction in as every fifth card while unseen Corrections remain', async () => {
    const ids = await walk(await run({ corrections }));

    expect(kindsOf(ids.slice(0, 10))).toBe('WWWWCWWWWC');
  });

  it('offers every live Correction once and never a Retired Correction, after the Words when the Words run out first', async () => {
    const ids = await walk(await run({ corrections }));

    expect(ids).toHaveLength(liveIds.length + liveCorrectionIds.length);
    expect(new Set(ids)).toEqual(new Set([...liveIds, ...liveCorrectionIds]));
    expect(kindsOf(ids)).toBe('WWWWCWWWWCWWCC');
  });

  it('offers Words only once every Correction was shown', async () => {
    const ids = await walk(await run({ corrections: [correction('c_only')] }));

    expect(kindsOf(ids)).toBe('WWWWCWWWWWW');
  });

  it('offers no Correction when the Corrections Feature Switch is off', async () => {
    const ids = await walk(await run({ corrections, correctionsSwitch: false }));

    expect(new Set(ids)).toEqual(new Set(liveIds));
  });

  it('gives a Correction card the Correction card model of its Correction', async () => {
    const feed = await run({ corrections });
    while (feed.cards.length < 5) await feed.next();

    const card = feed.cards[4];

    expect(card?.kind).toBe('correction');
    const name = entryIdOf(card)?.slice(2) ?? '';
    expect(correctionCardOf(card)).toMatchObject({
      kind: 'correction',
      correctionId: entryIdOf(card),
      nonStandardForm: `not ${name}`,
      mainEquivalent: name,
      otherEquivalents: [`also ${name}`],
      correctionType: 'calque',
    });
  });

  it('marks a Correction Seen after the dwell, never offering it again in the Cycle, and not after a quick swipe', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const feed = await run({ records, corrections, clock: time.clock });
    while (feed.cards.length < 10) await feed.next();
    const [read, skipped] = [entryIdOf(feed.cards[4]), entryIdOf(feed.cards[9])];

    await look(feed, time, 4, SEEN_DWELL_MS);
    await look(feed, time, 9, 300);

    const nextDay = fakeClock('2026-10-12T09:00:00+03:00').clock;
    const unseen = await walk(await run({ records, corrections, clock: nextDay }));
    expect(unseen).not.toContain(read);
    expect(unseen).toContain(skipped);
  });

  it('goes on offering the unseen Corrections once every Word is Seen, so the Cycle covers them too', async () => {
    const small = [word('w_one'), word('w_two')];
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const feed = await run({ words: small, corrections: [correction('c_one')], clock: time.clock });
    await feed.next();
    await look(feed, time, 0, SEEN_DWELL_MS);
    await look(feed, time, 1, SEEN_DWELL_MS);

    // The card the Feed got ready while the last Word was on screen.
    expect(entryIdOf(feed.cards[2])).toBe('c_one');
  });

  it('ends the Cycle only once every live Word and Correction is Seen, and starts the next one with the Corrections unseen again', async () => {
    const small = [word('w_one'), word('w_two')];
    const smallCorrections = [correction('c_one'), correction('c_old', true)];
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const feed = await run({ words: small, corrections: smallCorrections, clock: time.clock });

    // The Feed gets the next card ready while the reader looks at each card.
    const offered = [];
    for (let card = 0; card < 6; card++) {
      const position = feed.cards.length - 1;
      await feed.show(position);
      time.advance(SEEN_DWELL_MS);
      await feed.show(undefined);
      const next = feed.cards[position + 1];
      offered.push(next?.kind === 'end-of-cycle' ? 'end' : entryIdOf(next));
    }

    // After the Word of the Day: the other Word, the Correction, the end, then a new Cycle.
    expect(offered.slice(0, 2)).toEqual([expect.stringMatching(/^w_/), 'c_one']);
    expect(offered[2]).toBe('end');
    expect(new Set(offered.slice(3))).toEqual(new Set(['w_one', 'w_two', 'c_one']));
  });

  it('ends the Cycle after the Words alone when the Corrections Feature Switch is off', async () => {
    const small = [word('w_one'), word('w_two')];
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const feed = await run({
      words: small,
      corrections: [correction('c_one')],
      correctionsSwitch: false,
      clock: time.clock,
    });
    await feed.next();
    await look(feed, time, 0, SEEN_DWELL_MS);
    await look(feed, time, 1, SEEN_DWELL_MS);

    // The card the Feed got ready while the last Word was on screen.
    expect(feed.cards[2]?.kind).toBe('end-of-cycle');
  });

  it('opens on the Correction card the reader was on when the app reopens the same day', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const feed = await run({ records, corrections, clock: time.clock });
    while (feed.cards.length < 5) await feed.next();
    await feed.show(4);

    const reopened = await run({
      records,
      corrections,
      clock: fakeClock('2026-10-11T21:00:00+03:00').clock,
    });

    expect(reopened.cards).toHaveLength(1);
    expect(entryIdOf(reopened.cards[0])).toBe(entryIdOf(feed.cards[4]));
    expect(correctionCardOf(reopened.cards[0])?.correctionId).toBe(entryIdOf(feed.cards[4]));
  });

  describe('a Word linked to a Correction («Часто кажуть»)', () => {
    const linked = { ...word('w_protiahom'), correctionIds: ['c_protiazi', 'c_retired'] };
    const words = [linked, ...liveIds.map((id) => word(id))];
    const linkedCorrections = [
      correction('c_protiazi'),
      correction('c_retired', true),
      ...liveCorrections,
    ];

    /** A Feed whose card at `position` is the linked Word, with the next card ready. */
    async function feedOnLinkedWord(options: Parameters<typeof run>[0] = {}) {
      const feed = await run({ words, corrections: linkedCorrections, ...options });
      while (!feed.cards.some((card) => entryIdOf(card) === linked.id)) await feed.next();
      const position = feed.cards.findIndex((card) => entryIdOf(card) === linked.id);
      if (feed.cards.length === position + 1) await feed.next();
      return { feed, position };
    }

    it('shows the live Corrections the Word links on its card', async () => {
      const { feed, position } = await feedOnLinkedWord();

      expect(wordCardOf(feed.cards[position])?.linkedCorrections).toEqual([
        { correctionId: 'c_protiazi', nonStandardForm: 'not protiazi' },
      ]);
    });

    it('opens the linked Correction as the card right after the Word, and goes on after it', async () => {
      const { feed, position } = await feedOnLinkedWord();
      const before = feed.cards.map((card) => entryIdOf(card));
      expect(before).not.toContain('c_protiazi');

      const opened = await feed.openLinkedCorrection(position, 'c_protiazi');

      expect(opened).toBe(position + 1);
      const card: FeedCard | undefined = feed.cards[position + 1];
      expect(entryIdOf(card)).toBe('c_protiazi');
      expect(correctionCardOf(card)?.mainEquivalent).toBe('protiazi');
      expect(feed.cards.map((shown) => entryIdOf(shown))).toEqual([
        ...before.slice(0, position + 1),
        'c_protiazi',
        ...before.slice(position + 1),
      ]);
      const next = await feed.next();
      expect(entryIdOf(next)).not.toBe('c_protiazi');
      expect(before).not.toContain(entryIdOf(next));
    });

    it('opens the same card again when tapped twice', async () => {
      const { feed, position } = await feedOnLinkedWord();
      await feed.openLinkedCorrection(position, 'c_protiazi');
      const count = feed.cards.length;

      expect(await feed.openLinkedCorrection(position, 'c_protiazi')).toBe(position + 1);
      expect(feed.cards).toHaveLength(count);
    });

    it('marks the opened Correction Seen after the dwell, like any card', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const { feed, position } = await feedOnLinkedWord({ records, clock: time.clock });
      const opened = await feed.openLinkedCorrection(position, 'c_protiazi');

      await look(feed, time, opened ?? -1, SEEN_DWELL_MS);

      const nextDay = fakeClock('2026-10-12T09:00:00+03:00').clock;
      const unseen = await walk(
        await run({ records, words, corrections: linkedCorrections, clock: nextDay }),
      );
      expect(unseen).not.toContain('c_protiazi');
    });

    it('opens nothing for a Correction the Word does not link, or links but is retired', async () => {
      const { feed, position } = await feedOnLinkedWord();
      const count = feed.cards.length;

      expect(await feed.openLinkedCorrection(position, 'c_retired')).toBeUndefined();
      expect(await feed.openLinkedCorrection(position, 'c_live0')).toBeUndefined();
      expect(feed.cards).toHaveLength(count);
    });

    it('links no Correction, and opens none, when the Corrections Feature Switch is off', async () => {
      const { feed, position } = await feedOnLinkedWord({ correctionsSwitch: false });

      expect(wordCardOf(feed.cards[position])?.linkedCorrections).toEqual([]);
      expect(await feed.openLinkedCorrection(position, 'c_protiazi')).toBeUndefined();
    });
  });
});
