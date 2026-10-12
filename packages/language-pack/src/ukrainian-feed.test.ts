import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CORRECTION_EVERY,
  createEntries,
  createMemoryUserStatePort,
  loadEdition,
  openFeed,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Edition,
  type Feed,
  type FeedCard,
  type Random,
} from '@slovo/core';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';

// The Core's Feed over the real Ukrainian Language Pack (spec #51, seam 1). It
// lives here because only this package can build and read a pack in Node.

const editionDir = fileURLToPath(new URL('../../../editions/uk', import.meta.url));

let workDir: string;
let pack: NodeLanguagePack;
let liveIds: readonly string[];
let liveCorrectionIds: readonly string[];

/** The Ukrainian Edition as it ships, with the Corrections Feature Switch on. */
const ukrainian = loadEdition(
  JSON.parse(readFileSync(join(editionDir, 'edition.json'), 'utf8')) as unknown,
);

/** The Ukrainian Edition with Corrections turned off, so a test counts Words only. */
const wordsOnly: Edition = {
  ...ukrainian,
  isFeatureEnabled: (feature) => feature !== 'corrections' && ukrainian.isFeatureEnabled(feature),
};

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-feed-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  pack = openLanguagePack(outFile);
  liveIds = await pack.listWordIds();
  liveCorrectionIds = await pack.listCorrectionIds();
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

/** A seeded random port (a linear congruential generator), so every run draws the same. */
function seededRandom(seed: number): Random {
  let state = seed;
  return {
    next() {
      state = (state * 1_664_525 + 1_013_904_223) % 2 ** 32;
      return state / 2 ** 32;
    },
  };
}

function fakeClock(start: string) {
  let now = new Date(start).getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  return {
    clock,
    advance(ms: number) {
      now += ms;
    },
  };
}

async function run(
  records: Map<string, string>,
  clock: Clock,
  seed = 7,
  edition: Edition = wordsOnly,
): Promise<Feed> {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return openFeed({
    entries: createEntries({ content: pack, edition }),
    userState,
    clock,
    random: seededRandom(seed),
  });
}

/** The id of the Entry a card shows, if it shows one. */
const entryIdOf = (card: FeedCard | undefined) =>
  card === undefined || card.kind === 'end-of-cycle' ? undefined : card.entry.id;

/** The local day a card is the Word of the Day of, if it is. */
const wordOfTheDayOf = (card: FeedCard | undefined) =>
  card?.kind === 'word' ? card.wordOfTheDay : undefined;

/** The Correction card a card shows, if it shows one. */
const correctionCardOf = (card: FeedCard | undefined) =>
  card?.kind === 'correction' ? card.correctionCard : undefined;

/** The ids of the Entries the cards show, in order. */
const entryIdsOf = (cards: readonly FeedCard[]) => cards.flatMap((card) => entryIdOf(card) ?? []);

/**
 * Every Entry the Feed offers from where it stands, until it repeats, reaches
 * the end of the Cycle or runs out.
 */
async function walk(feed: Feed): Promise<string[]> {
  const ids = entryIdsOf(feed.cards);
  for (;;) {
    const id = entryIdOf(await feed.next());
    if (id === undefined || ids.includes(id)) return ids;
    ids.push(id);
  }
}

async function look(feed: Feed, time: ReturnType<typeof fakeClock>, position: number, ms: number) {
  await feed.cardVisible(position);
  time.advance(ms);
  await feed.cardHidden(position);
}

/** The Words a fresh run offers the next day, when the Feed doesn't reopen on the last card. */
async function unseenNextDay(records: Map<string, string>): Promise<string[]> {
  return walk(await run(records, fakeClock('2026-10-12T09:00:00+03:00').clock));
}

const today = '2026-10-11T09:00:00+03:00';

describe('the Feed over the Ukrainian Language Pack', () => {
  it('offers each live Word once and never a Retired Word', async () => {
    const offered = await walk(await run(new Map(), fakeClock(today).clock));

    const words = await Promise.all(offered.map((id) => pack.getWord(id)));
    expect(offered).toHaveLength(liveIds.length);
    expect(new Set(offered)).toEqual(new Set(liveIds));
    expect(words.filter((word) => word?.retired !== false)).toEqual([]);
    // The content has Retired Words, so leaving them out is tested for real.
    expect(await pack.getWord('w_z21mlp')).toMatchObject({ retired: true });
  });

  it('shuffles the same way for the same seed, also after a restart', async () => {
    const records = new Map<string, string>();
    const first = await walk(await run(records, fakeClock(today).clock, 7));
    const sameSeed = await walk(await run(new Map(), fakeClock(today).clock, 7));
    const otherSeed = await walk(await run(new Map(), fakeClock(today).clock, 8));

    // The Cycle keeps the seed it started with, whatever the random port draws now.
    const restarted = await walk(await run(records, fakeClock(today).clock, 99));

    expect(sameSeed).toEqual(first);
    expect(restarted).toEqual(first);
    expect(otherSeed).not.toEqual(first);
    expect(first).not.toEqual(liveIds);
  });

  it(`makes a Word Seen only after ${String(SEEN_DWELL_MS)} ms on screen, never on a quick swipe, and never by going back`, async () => {
    const records = new Map<string, string>();
    const time = fakeClock(today);
    const feed = await run(records, time.clock);
    await feed.next();
    await feed.next();
    const [read, skipped, almost] = entryIdsOf(feed.cards);

    await look(feed, time, 0, SEEN_DWELL_MS);
    await look(feed, time, 1, 250);
    await look(feed, time, 2, SEEN_DWELL_MS - 1);
    // Back over the skipped card to the one already read.
    await look(feed, time, 1, 250);
    await look(feed, time, 0, 10_000);

    const unseen = await unseenNextDay(records);
    expect(unseen).toHaveLength(liveIds.length - 1);
    expect(unseen).not.toContain(read);
    expect(unseen).toContain(skipped);
    expect(unseen).toContain(almost);
  });

  it('offers no Seen Word again after a restart in the same Cycle', async () => {
    const records = new Map<string, string>();
    const time = fakeClock(today);
    const feed = await run(records, time.clock);
    for (let position = 0; position < 5; position++) {
      if (position > 0) await feed.next();
      await look(feed, time, position, 2000);
    }
    const read = entryIdsOf(feed.cards);

    const restarted = await run(records, time.clock);
    // It reopens on the card the reader was on; every card after it is new.
    const [reopenedOn, ...after] = await walk(restarted);

    expect(reopenedOn).toBe(read.at(-1));
    expect(after).toHaveLength(liveIds.length - read.length);
    for (const id of read) expect(after).not.toContain(id);
  });

  it('starts each local day with an unseen Word of the Day that stays until midnight', async () => {
    const records = new Map<string, string>();
    const time = fakeClock(today);
    const feed = await run(records, time.clock);
    for (let position = 0; position < 3; position++) {
      if (position > 0) await feed.next();
      await look(feed, time, position, 2000);
    }
    const read = entryIdsOf(feed.cards);

    const midnight = fakeClock('2026-10-12T00:00:00+03:00');
    const nextDay = await run(records, midnight.clock);
    await look(nextDay, midnight, 0, 300);
    const lateThatDay = await run(records, fakeClock('2026-10-12T23:59:00+03:00').clock);

    expect(wordOfTheDayOf(feed.cards[0])).toEqual({ year: 2026, month: 10, day: 11 });
    expect(wordOfTheDayOf(nextDay.cards[0])).toEqual({ year: 2026, month: 10, day: 12 });
    expect(read).not.toContain(entryIdOf(nextDay.cards[0]));
    expect(lateThatDay.cards).toEqual(nextDay.cards.slice(0, 1));
  });
});

describe('Corrections in the Feed over the Ukrainian Language Pack', () => {
  it('turns the Corrections Feature Switch on and has live Corrections to mix in', () => {
    expect(ukrainian.isFeatureEnabled('corrections')).toBe(true);
    expect(liveCorrectionIds.length).toBeGreaterThan(0);
  });

  it(`makes every ${String(CORRECTION_EVERY)}th card a Correction until the Corrections run out, and offers each live Entry once`, async () => {
    const offered = await walk(await run(new Map(), fakeClock(today).clock, 7, ukrainian));

    const mixed = offered.slice(0, liveCorrectionIds.length * CORRECTION_EVERY);
    mixed.forEach((id, position) => {
      const correctionTurn = (position + 1) % CORRECTION_EVERY === 0;
      expect(id.startsWith('c_'), `card ${String(position)}: ${id}`).toBe(correctionTurn);
    });
    expect(offered).toHaveLength(liveIds.length + liveCorrectionIds.length);
    expect(new Set(offered)).toEqual(new Set([...liveIds, ...liveCorrectionIds]));
  });

  it('gives each Correction card the Correction card model of its Correction', async () => {
    const feed = await run(new Map(), fakeClock(today).clock, 7, ukrainian);
    while (feed.cards.length < CORRECTION_EVERY) await feed.next();

    const card = feed.cards[CORRECTION_EVERY - 1];
    const correction = await pack.getCorrection(entryIdOf(card) ?? '');

    expect(correctionCardOf(card)).toEqual({
      kind: 'correction',
      correctionId: correction?.id,
      nonStandardForm: correction?.nonStandardForm,
      mainEquivalent: correction?.standardEquivalents[0],
      otherEquivalents: correction?.standardEquivalents.slice(1),
      correctionType: correction?.correctionType,
      explanation: correction?.explanation,
      examplePair: correction?.examplePair,
    });
  });
});
