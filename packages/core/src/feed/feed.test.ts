import { describe, expect, it } from 'vitest';

import type { Correction, Idiom, Word } from '@slovo/contracts';

import {
  buildEntryCard,
  CORRECTION_EVERY,
  createEntries,
  createMemoryContentPort,
  createMemoryUserStatePort,
  isTodaysWordOfTheDay,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Composition,
  type ContentReadPort,
  type Edition,
  type MixEdition,
  type GameEdition,
  type NotificationsEdition,
  type Feed,
  type FeedCard,
  IDIOM_EVERY,
  type Random,
  type UserStatePort,
  type WordFeedCard,
} from '../index';
import {
  correction,
  fakeClock,
  idiom,
  randomOf,
  randomSequence,
  word as sharedWord,
} from '../test-support';

/** A Word whose Definition is the same for every id, so a card can be matched to it. */
const word = (id: string, overrides: Partial<Word> = {}) =>
  sharedWord(id, { primaryDefinition: 'A meaning.', ...overrides });

/** A small pack: ten live Words and two Retired ones. */
const liveIds = Array.from({ length: 10 }, (_, index) => `w_live${String(index)}`);
const retiredIds = ['w_retired0', 'w_retired1'];
const pack = [
  ...liveIds.map((id) => word(id)),
  ...retiredIds.map((id) => word(id, { retired: true })),
];

/**
 * An Edition with the Corrections and Idioms Feature Switches on or off, whose
 * one Category, the test Words' own, is in its default Mix.
 */
const editionWith = (
  corrections: boolean,
  idioms = true,
): Pick<Edition, 'id' | 'isFeatureEnabled'> & MixEdition & NotificationsEdition & GameEdition => ({
  id: 'test',
  isFeatureEnabled: (feature) =>
    (feature === 'corrections' && corrections) || (feature === 'idioms' && idioms),
  languageTraits: { distractorRule: 'same-part-of-speech' },
  userSettingDefaults: {
    mix: { categoryIds: ['test'], corrections: true, idioms: true },
    notificationTimes: [],
  },
});

/** The id of the Entry a card shows, if it shows one. */
const entryIdOf = (card: FeedCard | undefined) => {
  if (card?.kind === 'word') return card.wordCard.wordId;
  if (card?.kind === 'correction') return card.correctionCard.correctionId;
  return card?.kind === 'idiom' ? card.idiomCard.idiomId : undefined;
};

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

/**
 * The Core composition of one app run over the given records: the user state
 * survives between runs.
 */
async function runApp({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  clock = fakeClock('2026-10-11T09:00:00+03:00').clock,
  random = randomOf(0.25),
  words = pack,
  corrections = [],
  idioms = [],
  content = createMemoryContentPort({ words, corrections, idioms }),
  correctionsSwitch = true,
  idiomsSwitch = true,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  clock?: Clock;
  random?: Random;
  words?: readonly Word[];
  corrections?: readonly Correction[];
  idioms?: readonly Idiom[];
  content?: ContentReadPort;
  correctionsSwitch?: boolean;
  idiomsSwitch?: boolean;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: editionWith(correctionsSwitch, idiomsSwitch),
    userState: await openUserState({ port }),
    clock,
    random,
  });
}

/** The Feed of one app run over the given records, opened through the Core composition. */
async function run(options: Parameters<typeof runApp>[0] = {}): Promise<Feed> {
  return (await runApp(options)).feed;
}

/** A user-state port over the records whose writes fail while `failing` says so. */
function failingPort(records: Map<string, string>, failing: () => boolean): UserStatePort {
  const port = createMemoryUserStatePort(records);
  return {
    ...port,
    write: (changes) =>
      failing() ? Promise.reject(new Error('The disk is full')) : port.write(changes),
  };
}

/**
 * The ids of every Entry the Feed offers from where it stands, after the
 * `shown` ones (every card so far, unless given), until it repeats, reaches
 * the end of the Cycle or runs out.
 */
async function walk(feed: Feed, shown = entryIdsOf(feed.cards)): Promise<string[]> {
  const ids = [...shown];
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

    it('offers an Entry whose Seen mark is of another Cycle, as a device offline since then brings it', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      const [first = '', second = ''] = await walk(feed);
      // This device is in Cycle 2 now; the other one Seen `first` in Cycle 1, and `second` in this one.
      const { seed } = JSON.parse(records.get('feed.cycle') ?? '{}') as { seed: number };
      records.set('feed.cycle', JSON.stringify({ id: 2, seed }));
      records.set(`feed.seen.${first}`, '1');
      records.set(`feed.seen.${second}`, '2');

      const unseen = await unseenNextDay(records);

      expect(unseen).toContain(first);
      expect(unseen).not.toContain(second);
      expect(unseen).toHaveLength(liveIds.length - 1);
    });

    it('opens on the Word of the Day the composition keeps, and a Seen mark made through the Feed survives reopening the composition', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });
      const first = entryIdOf(feed.cards[0]);

      await look(feed, time, 0, SEEN_DWELL_MS);
      time.advance(60_000);
      const reopened = await run({ records, clock: time.clock });

      expect(wordOfTheDayOf(feed.cards[0])).toEqual({ year: 2026, month: 10, day: 11 });
      expect(entryIdOf(reopened.cards[0])).toBe(first);
      expect(wordOfTheDayOf(reopened.cards[0])).toEqual({ year: 2026, month: 10, day: 11 });
      expect(await unseenNextDay(records)).not.toContain(first);
    });

    it('leaves the Entry unseen in memory, as on disk, when keeping it Seen fails', async () => {
      const records = new Map<string, string>();
      const words = [word('w_one'), word('w_two')];
      let failing = false;
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({
        records,
        port: failingPort(records, () => failing),
        words,
        clock: time.clock,
      });
      const first = entryIdOf(feed.cards[0]);
      await feed.show(0);
      time.advance(SEEN_DWELL_MS);

      failing = true;
      await expect(feed.show(undefined)).rejects.toThrow('The disk is full');
      failing = false;
      await look(feed, time, 1, SEEN_DWELL_MS);

      // The other Word is Seen, so the Entry whose Seen mark failed is the
      // only one left: it comes again instead of the end-of-Cycle card.
      expect(entryIdOf(feed.cards.at(-1))).toBe(first);
      const nextDay = fakeClock('2026-10-12T09:00:00+03:00').clock;
      expect(await walk(await run({ records, words, clock: nextDay }))).toEqual([first]);
    });

    it('marks an Entry Seen at 500 ms on screen, not at 499 ms', async () => {
      for (const [stayed, seen] of [
        [499, false],
        [500, true],
      ] as const) {
        const records = new Map<string, string>();
        const time = fakeClock('2026-10-11T09:00:00+03:00');
        const feed = await run({ records, clock: time.clock });
        await feed.next();

        await look(feed, time, 0, stayed);

        expect((await unseenNextDay(records)).length < liveIds.length).toBe(seen);
      }
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
      const offered = (await walk(restarted)).slice(restarted.startPosition + 1);

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
      const feed = await run({
        content: {
          ...content,
          getWord: (id) => (failing ? Promise.reject(new Error('disk')) : content.getWord(id)),
        },
        correctionsSwitch: false,
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
      time.advance(SEEN_DWELL_MS / 2);
      await feed.show(0);
      time.advance(SEEN_DWELL_MS / 2);
      await feed.show(undefined);

      expect(await firstSeen(feed, records)).toBe(true);
    });

    it('stops counting the dwell time while no card is on screen, as when the app is in the background', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, clock: time.clock });

      await feed.show(0);
      time.advance(SEEN_DWELL_MS / 2);
      await feed.show(undefined);
      time.advance(60_000);
      await feed.show(0);
      time.advance(SEEN_DWELL_MS / 2);
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
    const small = [word('w_one'), word('w_two'), word('w_three'), word('w_old', { retired: true })];

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
    const small = [word('w_one'), word('w_two'), word('w_three'), word('w_old', { retired: true })];

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

    it('keeps the last Cycle in memory, as on disk, when keeping the new Cycle fails, and starts it on the next try', async () => {
      const records = new Map<string, string>();
      let failing = false;
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({
        records,
        port: failingPort(records, () => failing),
        words: small,
        clock: time.clock,
        random: randomSequence(0.25, 0.75, 0.5),
      });
      await readToTheEnd(feed, time);
      const wordOfTheDay = entryIdOf(feed.cards[0]);

      failing = true;
      await expect(feed.next()).rejects.toThrow('The disk is full');

      expect(feed.cards.at(-1)?.kind).toBe('end-of-cycle');
      // The next app run reads the last Cycle too: every Word Seen.
      const reopened = await run({ records, words: small, clock: time.clock });
      expect((await reopened.next())?.kind).toBe('end-of-cycle');

      failing = false;
      const card = await feed.next();
      expect(card?.kind).toBe('word');
      const newCycle = await walk(feed, entryIdsOf(card === undefined ? [] : [card]));
      // Nothing Seen, in the order of the seed drawn on the next try.
      expect(newCycle).toEqual(await walk(await run({ words: small, random: randomOf(0.5) })));
      // The next app run reads the same new Cycle; its Word of the Day is
      // the first Word of the order other than the day before's.
      const nextDay = fakeClock('2026-10-12T09:00:00+03:00').clock;
      const opening = newCycle.find((id) => id !== wordOfTheDay);
      expect(await walk(await run({ records, words: small, clock: nextDay }))).toEqual([
        opening,
        ...newCycle.filter((id) => id !== opening),
      ]);
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

      // It reopens on the new Cycle's first card, after today's Word of the Day
      // of the last Cycle, and goes on in the new Cycle's order.
      const offered = await walk(restarted);
      const newOrder = await walk(await run({ random: randomOf(0.75) }));
      expect(offered.slice(restarted.startPosition)).toEqual(
        newOrder.filter((id) => id !== offered[0]),
      );
    });

    it('leaves the last position on the last Word, so the app reopens there and the end-of-Cycle card follows again', async () => {
      const records = new Map<string, string>();
      const time = fakeClock('2026-10-11T09:00:00+03:00');
      const feed = await run({ records, words: small, clock: time.clock });
      await readToTheEnd(feed, time);

      time.advance(60_000);
      const restarted = await run({ records, words: small, clock: time.clock });

      expect(entryIdOf(restarted.cards[restarted.startPosition])).toBe(
        entryIdOf(feed.cards.at(-2)),
      );
      expect((await restarted.next())?.kind).toBe('end-of-cycle');
    });

    it('lets a new local day start the new Cycle with its Word of the Day, without a second end-of-Cycle card', async () => {
      const time = fakeClock('2026-10-11T23:00:00+03:00');
      const app = await runApp({ words: small, clock: time.clock });
      const { feed } = app;
      await readToTheEnd(feed, time);

      time.advance(2 * 60 * 60_000);
      await app.resume();
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
      const app = await runApp({
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
        words: small,
        correctionsSwitch: false,
        clock: time.clock,
        random: randomSequence(0.25, 0.75),
      });
      const { feed } = app;
      await readToTheEnd(feed, time);
      const end = feed.cards.length - 1;
      // A new local day starts, and the composition turns to it.
      time.advance(2 * 60 * 60_000);
      await app.resume();
      let letThrough: () => void = () => undefined;
      const came = new Promise<void>((resolve) => {
        held = { came: resolve, through: new Promise((resolve) => (letThrough = resolve)) };
      });

      // The end-of-Cycle card comes on screen and the new day's Word of the
      // Day starts a new Cycle, whose write is held.
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
      const feed = await run({ words: [word('w_old', { retired: true })] });

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

      expect(entryIdOf(reopened.cards[reopened.startPosition])).toBe(last);
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

  it('can be reached by going back when the app reopens the same local day on another card', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const first = await run({ records, clock: time.clock });
    await first.show(0);
    await first.show(1);
    await first.show(2);

    const reopened = await run({ records, clock: fakeClock('2026-10-11T21:00:00+03:00').clock });

    expect(entryIdsOf(reopened.cards)).toEqual([
      entryIdOf(first.cards[0]),
      entryIdOf(first.cards[2]),
    ]);
    expect(wordOfTheDayOf(reopened.cards[0])).toEqual({ year: 2026, month: 10, day: 11 });
    expect(reopened.startPosition).toBe(1);
  });

  it('is chosen again, next after the card the reader was on, when the app reopens the same local day after it was Hidden', async () => {
    const records = new Map<string, string>();
    const app = await runApp({ records, clock: fakeClock('2026-10-11T09:00:00+03:00').clock });
    const { feed } = app;
    await feed.show(0);
    await feed.show(1);
    const hidden = entryIdOf(feed.cards[0]) ?? '';
    await app.hide({ kind: 'entry', entryId: hidden });

    const reopened = await run({ records, clock: fakeClock('2026-10-11T21:00:00+03:00').clock });
    await reopened.show(reopened.startPosition);

    expect(entryIdsOf(reopened.cards)[0]).toBe(entryIdOf(feed.cards[0]));
    expect(wordOfTheDayOf(reopened.cards[1])).toEqual({ year: 2026, month: 10, day: 11 });
    expect(entryIdsOf(reopened.cards)).not.toContain(hidden);
  });

  it('starts the new local day in a Feed left open over midnight', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const app = await runApp({ clock: time.clock });
    const { feed } = app;
    await feed.next();

    // The shell's timer tells the composition when the next local day starts.
    time.advance(5 * 60_000);
    await app.resume();
    const card = await feed.next();

    expect(wordOfTheDayOf(card)).toEqual({ year: 2026, month: 10, day: 12 });
    expect(entryIdsOf(feed.cards.slice(0, 2))).not.toContain(entryIdOf(card));
    expect(wordOfTheDayOf(await feed.next())).toBeUndefined();
  });

  it('comes next, in place of the card got ready the day before, when the app comes back from the background on a new local day', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const app = await runApp({ clock: time.clock });
    const { feed } = app;
    await feed.show(0);
    await feed.show(undefined);

    time.advance(8 * 60 * 60_000);
    await app.resume();
    await feed.show(0);

    expect(feed.cards).toHaveLength(2);
    expect(wordOfTheDayOf(feed.cards[1])).toEqual({ year: 2026, month: 10, day: 12 });
    expect(entryIdOf(feed.cards[1])).not.toBe(entryIdOf(feed.cards[0]));
  });

  it('comes next, in place of the card got ready the day before, when the app comes back to a new local day before the composition turns to it', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const app = await runApp({ clock: time.clock });
    const { feed } = app;
    await feed.show(0);
    await feed.show(undefined);

    // The card comes back on screen before the composition hears of the foreground.
    time.advance(8 * 60 * 60_000);
    await feed.show(0);
    await app.resume();

    expect(feed.cards).toHaveLength(2);
    expect(wordOfTheDayOf(feed.cards[1])).toEqual({ year: 2026, month: 10, day: 12 });
  });

  it('keeps the card got ready the day before when a new local day starts with a card on screen, and comes after the next swipe', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const app = await runApp({ clock: time.clock });
    const { feed } = app;
    await feed.show(0);
    const ready = feed.cards[1];

    // The shell's timer tells the composition when the next local day starts.
    time.advance(5 * 60_000);
    await app.resume();

    expect(feed.cards).toHaveLength(2);
    expect(feed.cards[1]).toBe(ready);

    await feed.show(1);

    expect(feed.cards).toHaveLength(3);
    expect(feed.cards[1]).toBe(ready);
    expect(wordOfTheDayOf(feed.cards[2])).toEqual({ year: 2026, month: 10, day: 12 });
  });

  it('comes next, in place of the card got ready the day before, when the card on screen is reported again on a new local day', async () => {
    const time = fakeClock('2026-10-11T23:58:00+03:00');
    const app = await runApp({ clock: time.clock });
    const { feed } = app;
    await feed.show(0);
    time.advance(5 * 60_000);
    await app.resume();

    await feed.show(0);

    expect(feed.cards).toHaveLength(2);
    expect(wordOfTheDayOf(feed.cards[1])).toEqual({ year: 2026, month: 10, day: 12 });
  });
});

describe('Corrections in the Feed', () => {
  const liveCorrections = ['c_live0', 'c_live1', 'c_live2', 'c_live3'].map((id) => correction(id));
  const corrections = [...liveCorrections, correction('c_retired', { retired: true })];
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
    const smallCorrections = [correction('c_one'), correction('c_old', { retired: true })];
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

    const card = reopened.cards[reopened.startPosition];
    expect(entryIdOf(card)).toBe(entryIdOf(feed.cards[4]));
    expect(correctionCardOf(card)?.correctionId).toBe(entryIdOf(feed.cards[4]));
  });

  describe('a Word linked to a Correction («Часто кажуть»)', () => {
    const linked = { ...word('w_protiahom'), correctionIds: ['c_protiazi', 'c_retired'] };
    const words = [linked, ...liveIds.map((id) => word(id))];
    const linkedCorrections = [
      correction('c_protiazi'),
      correction('c_retired', { retired: true }),
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

describe('buildEntryCard', () => {
  const entries = createEntries({
    content: createMemoryContentPort({ words: pack, corrections: [correction('c_calque')] }),
    edition: editionWith(true),
  });

  it('builds the card of a Word, or of a Correction, from the Entries', async () => {
    const wordCard = await buildEntryCard(entries, word('w_live0'));
    const correctionCard = await buildEntryCard(entries, correction('c_calque'));

    expect(wordCardOf(wordCard)?.wordId).toBe('w_live0');
    expect(wordOfTheDayOf(wordCard)).toBeUndefined();
    expect(correctionCardOf(correctionCard)?.correctionId).toBe('c_calque');
  });

  it('marks the card of a Word as the Word of the Day of the day it is given', async () => {
    const day = { year: 2026, month: 10, day: 11 };

    expect(wordOfTheDayOf(await buildEntryCard(entries, word('w_live0'), day))).toEqual(day);
  });
});

describe("today's Word of the Day", () => {
  /** 16 October 2026, 00:30 in Kyiv: still the 15th in UTC. */
  const clock: Clock = {
    now: () => new Date('2026-10-15T21:30:00Z'),
    timeZone: () => 'Europe/Kyiv',
  };
  const card = (wordOfTheDay?: WordFeedCard['wordOfTheDay']) =>
    ({
      kind: 'word',
      wordCard: {} as WordFeedCard['wordCard'],
      ...(wordOfTheDay === undefined ? {} : { wordOfTheDay }),
    }) satisfies WordFeedCard;

  it("is the card of the Word of the Day of the reader's local day", () => {
    expect(isTodaysWordOfTheDay(card({ year: 2026, month: 10, day: 16 }), clock)).toBe(true);
  });

  it("is not the card of an earlier day's Word of the Day, still in the Feed after midnight", () => {
    expect(isTodaysWordOfTheDay(card({ year: 2026, month: 10, day: 15 }), clock)).toBe(false);
  });

  it('is not the card of any other Word', () => {
    expect(isTodaysWordOfTheDay(card(), clock)).toBe(false);
  });
});

describe('Idioms in the Feed', () => {
  const liveIdioms = ['i_live0', 'i_live1', 'i_live2'].map((id) => idiom(id));
  const idioms = [...liveIdioms, idiom('i_retired', { retired: true })];
  const liveIdiomIds = liveIdioms.map(({ id }) => id);
  const corrections = ['c_live0', 'c_live1', 'c_live2', 'c_live3'].map((id) => correction(id));

  /** 'W' for a Word card, 'C' for a Correction card, 'I' for an Idiom card. */
  const kindsOf = (ids: readonly string[]) =>
    ids.map((id) => (id.startsWith('c_') ? 'C' : id.startsWith('i_') ? 'I' : 'W')).join('');

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

  it(`mixes an Idiom in as every ${String(IDIOM_EVERY)}th card of the Cycle while unseen Idioms remain, among the Corrections' turns`, async () => {
    const ids = await walk(await run({ corrections, idioms }));

    expect(kindsOf(ids.slice(0, 14))).toBe('WWWWCWIWWCWWWI');
  });

  it('offers every live Idiom once and never a Retired Idiom, after the Words when the Words run out first', async () => {
    const ids = await walk(await run({ corrections, idioms }));

    expect(ids).toHaveLength(liveIds.length + corrections.length + liveIdiomIds.length);
    expect(new Set(ids)).toEqual(
      new Set([...liveIds, ...corrections.map(({ id }) => id), ...liveIdiomIds]),
    );
    expect(kindsOf(ids)).toBe('WWWWCWIWWCWWWICCI');
  });

  it(`gives the card both turns fall on to the Correction, and the next card to the Idiom`, async () => {
    const collision = CORRECTION_EVERY * IDIOM_EVERY;
    const many = Array.from({ length: 30 }, (_, index) => word(`w_many${String(index)}`));
    const manyCorrections = Array.from({ length: 8 }, (_, index) =>
      correction(`c_many${String(index)}`),
    );
    const manyIdioms = Array.from({ length: 6 }, (_, index) => idiom(`i_many${String(index)}`));

    const ids = await walk(
      await run({ words: many, corrections: manyCorrections, idioms: manyIdioms }),
    );

    const expected = Array.from({ length: collision + 1 }, (_, index) => {
      const card = index + 1;
      if (card % CORRECTION_EVERY === 0) return 'C';
      return card % IDIOM_EVERY === 0 || card === collision + 1 ? 'I' : 'W';
    }).join('');
    expect(kindsOf(ids.slice(0, collision + 1))).toBe(expected);
  });

  it(`counts each turn from its kind's last card, so the Idiom the collision moved sets the next one ${String(IDIOM_EVERY)} cards after it`, async () => {
    const many = Array.from({ length: 30 }, (_, index) => word(`w_many${String(index)}`));
    const manyCorrections = Array.from({ length: 9 }, (_, index) =>
      correction(`c_many${String(index)}`),
    );
    const manyIdioms = Array.from({ length: 7 }, (_, index) => idiom(`i_many${String(index)}`));

    const ids = await walk(
      await run({ words: many, corrections: manyCorrections, idioms: manyIdioms }),
    );

    // Cards 28 to 45. Card 35 is both turns: the Correction takes it, the Idiom
    // card 36, and the next Idiom card 43, not 42.
    expect(kindsOf(ids.slice(27, 45))).toBe('IWCWWWWCIWWWCWWIWC');
  });

  it('ends the Idiom turns once every Idiom of the Cycle was shown, and Words take their cards', async () => {
    const ids = await walk(await run({ idioms: [idiom('i_only')] }));

    expect(kindsOf(ids)).toBe('WWWWWWIWWWW');
  });

  it('offers no Idiom when Idioms are out of the Mix, and mixes them in again once they are back', async () => {
    const app = await runApp({ corrections, idioms });
    await app.mix.setIdioms(false);

    const without = await walk(app.feed);

    expect(without.some((id) => id.startsWith('i_'))).toBe(false);
    expect(new Set(without)).toEqual(new Set([...liveIds, ...corrections.map(({ id }) => id)]));

    await app.mix.setIdioms(true);
    const after = await walk(app.feed);
    expect(after.filter((id) => id.startsWith('i_'))).toEqual(expect.arrayContaining(liveIdiomIds));
  });

  it('offers no Idiom when the Idioms Feature Switch is off', async () => {
    const ids = await walk(await run({ idioms, idiomsSwitch: false }));

    expect(new Set(ids)).toEqual(new Set(liveIds));
  });

  it('opens every local day on a Word of the Day that is a Word, never an Idiom', async () => {
    const records = new Map<string, string>();
    const few = [word('w_one'), word('w_two')];
    const days = ['2026-10-11', '2026-10-12', '2026-10-13'];

    for (const day of days) {
      const feed = await run({
        records,
        words: few,
        idioms,
        clock: fakeClock(`${day}T09:00:00+03:00`).clock,
      });
      expect(feed.cards[0]?.kind).toBe('word');
      expect(wordOfTheDayOf(feed.cards[0])).toEqual(
        expect.objectContaining({ day: Number(day.slice(-2)) }),
      );
    }
  });

  it('gives an Idiom card the Idiom card model of its Idiom', async () => {
    const feed = await run({ idioms });
    while (feed.cards.length < IDIOM_EVERY) await feed.next();

    const card = feed.cards[IDIOM_EVERY - 1];

    expect(card?.kind).toBe('idiom');
    const id = entryIdOf(card) ?? '';
    expect(card?.kind === 'idiom' ? card.idiomCard : undefined).toMatchObject({
      kind: 'idiom',
      idiomId: id,
      expression: `to ${id.slice(2)}`,
      idiomType: 'idiom',
      primaryDefinition: 'A meaning.',
      sourceTitles: ['Test source'],
    });
  });

  it('marks an Idiom Seen after the dwell, never offering it again in the Cycle, and not after a quick swipe', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const feed = await run({ records, corrections, idioms, clock: time.clock });
    while (feed.cards.length < IDIOM_EVERY * 2) await feed.next();
    const [read, skipped] = [
      entryIdOf(feed.cards[IDIOM_EVERY - 1]),
      entryIdOf(feed.cards[IDIOM_EVERY * 2 - 1]),
    ];
    expect(kindsOf([read ?? '', skipped ?? ''])).toBe('II');

    await look(feed, time, IDIOM_EVERY - 1, SEEN_DWELL_MS);
    await look(feed, time, IDIOM_EVERY * 2 - 1, 300);

    const nextDay = fakeClock('2026-10-12T09:00:00+03:00').clock;
    const unseen = await walk(await run({ records, corrections, idioms, clock: nextDay }));
    expect(unseen).not.toContain(read);
    expect(unseen).toContain(skipped);
  });

  it('ends the Cycle only once every live Word, Correction and Idiom is Seen, and starts the next one with the Idioms unseen again', async () => {
    const small = [word('w_one'), word('w_two')];
    const smallIdioms = [idiom('i_one'), idiom('i_old', { retired: true })];
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const feed = await run({
      words: small,
      corrections: [correction('c_one')],
      idioms: smallIdioms,
      clock: time.clock,
    });

    // The Feed gets the next card ready while the reader looks at each card.
    const offered = [];
    for (let card = 0; card < 8; card++) {
      const position = feed.cards.length - 1;
      await feed.show(position);
      time.advance(SEEN_DWELL_MS);
      await feed.show(undefined);
      const next = feed.cards[position + 1];
      offered.push(next?.kind === 'end-of-cycle' ? 'end' : entryIdOf(next));
    }

    // After the Word of the Day: the other Word, the Correction, the Idiom, the end, then a new Cycle.
    expect(offered.slice(0, 3)).toEqual([expect.stringMatching(/^w_/), 'c_one', 'i_one']);
    expect(offered[3]).toBe('end');
    expect(new Set(offered.slice(4))).toEqual(new Set(['w_one', 'w_two', 'c_one', 'i_one']));
  });

  it('opens on the Idiom card the reader was on when the app reopens the same day', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const feed = await run({ records, idioms, clock: time.clock });
    while (feed.cards.length < IDIOM_EVERY) await feed.next();
    await feed.show(IDIOM_EVERY - 1);
    const idiomId = entryIdOf(feed.cards[IDIOM_EVERY - 1]);

    const reopened = await run({ records, idioms, clock: time.clock });

    expect(reopened.cards[reopened.startPosition]?.kind).toBe('idiom');
    expect(entryIdOf(reopened.cards[reopened.startPosition])).toBe(idiomId);
  });
});
