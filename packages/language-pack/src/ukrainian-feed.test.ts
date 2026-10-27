import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CORRECTION_EVERY,
  type Entry,
  IDIOM_EVERY,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type ContentReadPort,
  type Edition,
  type Feed,
  type FeedCard,
  NOTIFICATION_BODY_LENGTH,
  type Random,
} from '@slovo/core';
import { createFakeNotificationScheduler } from '@slovo/core/testing';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';
import { ukrainian, ukrainianFolder } from './test-support';

// The Core's Feed over the real Ukrainian Language Pack, opened through the
// Core composition (spec #96, seam 1). It lives here because only this
// package can build and read a pack in Node.

let workDir: string;
let pack: NodeLanguagePack;
/** The pack as the Feed reads it: each Word and Correction is read from it once per file. */
let content: ContentReadPort;
let liveIds: readonly string[];
let liveCorrectionIds: readonly string[];
let liveIdiomIds: readonly string[];
let liveSynonymRowIds: readonly string[];
let liveTipIds: readonly string[];

/**
 * Remembers every Word and Correction by id. The pack never changes while it
 * is open, but every `run` opens a new composition, and the pack reads a Word
 * with eight queries and a schema check: left alone, a walk through all the
 * Words costs seconds on a loaded machine, and a test walks several times.
 */
function remembering(port: ContentReadPort): ContentReadPort {
  const known = new Map<string, Promise<Entry | undefined>>();
  return {
    ...port,
    async getEntries(ids) {
      const unknown = ids.filter((id) => !known.has(id));
      const read = unknown.length > 0 ? port.getEntries(unknown) : Promise.resolve([]);
      const entries = await Promise.all(
        ids.map((id) => {
          let kept = known.get(id);
          if (kept === undefined) {
            kept = read.then((found) => found.find((entry) => entry.id === id));
            known.set(id, kept);
          }
          return kept;
        }),
      );
      return entries.filter((entry) => entry !== undefined);
    },
  };
}

/** The Ukrainian Edition with every other kind of Entry turned off, so a test counts Words only. */
const otherKinds = new Set(['corrections', 'idioms', 'synonymRows', 'tips']);
const wordsOnly: Edition = {
  ...ukrainian,
  isFeatureEnabled: (feature) => !otherKinds.has(feature) && ukrainian.isFeatureEnabled(feature),
};

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-feed-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  pack = openLanguagePack(outFile);
  content = remembering(pack);
  liveIds = await pack.listWordIds();
  liveCorrectionIds = await pack.listCorrectionIds();
  liveIdiomIds = await pack.listIdiomIds();
  liveSynonymRowIds = await pack.listSynonymRowIds();
  liveTipIds = await pack.listTipIds();
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
  const composition = await openComposition({
    content,
    edition,
    userState,
    clock,
    random: seededRandom(seed),
  });
  return composition.feed;
}

/** The local day a card is the Word of the Day of, if it is. */
const wordOfTheDayOf = (card: FeedCard | undefined) =>
  card?.kind === 'word' ? card.wordOfTheDay : undefined;

/** The Correction card a card shows, if it shows one. */
const correctionCardOf = (card: FeedCard | undefined) =>
  card?.kind === 'correction' ? card.model : undefined;

/** The ids of the Entries the cards show, in order. */
const entryIdsOf = (cards: readonly FeedCard[]) => cards.flatMap((card) => card.entryId ?? []);

/**
 * Every Entry the Feed offers from where it stands, until it repeats, reaches
 * the end of the Cycle or runs out.
 */
async function walk(feed: Feed): Promise<string[]> {
  const ids = entryIdsOf(feed.cards);
  for (;;) {
    const id = (await feed.next())?.entryId;
    if (id === undefined || ids.includes(id)) return ids;
    ids.push(id);
  }
}

async function look(feed: Feed, time: ReturnType<typeof fakeClock>, position: number, ms: number) {
  await feed.show(position);
  time.advance(ms);
  await feed.show(undefined);
}

/** The Words a fresh run offers the next day, when the Feed doesn't reopen on the last card. */
async function unseenNextDay(records: Map<string, string>): Promise<string[]> {
  return walk(await run(records, fakeClock('2026-10-12T09:00:00+03:00').clock));
}

const today = '2026-10-11T09:00:00+03:00';

/**
 * These tests walk the Feed through every live Word, building each card from
 * the pack once. That took about 0.3 s alone and 2.5 s on a 12-core machine
 * busy with four times as many processes as cores (measured for #257), where
 * Vitest's 5 s default is too close. The cost is the walk itself, so only the
 * tests that make it get more.
 */
const WALK_TIMEOUT_MS = 20_000;

describe('the Feed over the Ukrainian Language Pack', () => {
  it('opens a pack the build writes in pack format 7 and shows its first card', async () => {
    expect(await pack.metadata()).toMatchObject({ editionId: 'uk', packFormat: 7 });

    const feed = await run(new Map(), fakeClock(today).clock);

    expect(liveIds).toContain(feed.cards[0]?.entryId);
  });

  it(
    'offers each live Word once and never a Retired Word',
    { timeout: WALK_TIMEOUT_MS },
    async () => {
      const offered = await walk(await run(new Map(), fakeClock(today).clock));

      const words = await content.getEntries(offered);
      expect(offered).toHaveLength(liveIds.length);
      expect(new Set(offered)).toEqual(new Set(liveIds));
      expect(words).toHaveLength(offered.length);
      expect(words.filter((word) => word.retired)).toEqual([]);
      // The content has Retired Words, so leaving them out is tested for real.
      expect(await pack.getEntries(['w_z21mlp'])).toMatchObject([{ retired: true }]);
    },
  );

  it(
    'shuffles the same way for the same seed, also after a restart',
    { timeout: WALK_TIMEOUT_MS },
    async () => {
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
    },
  );

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
    // The Feed gets each next card ready while the one before it is on screen.
    for (let position = 0; position < 5; position++) await look(feed, time, position, 2000);
    const read = entryIdsOf(feed.cards).slice(0, 5);

    const restarted = await run(records, time.clock);
    // It reopens on the card the reader was on; every card after it is new.
    const [reopenedOn, ...after] = (await walk(restarted)).slice(restarted.startPosition);

    expect(reopenedOn).toBe(read.at(-1));
    expect(after).toHaveLength(liveIds.length - read.length);
    for (const id of read) expect(after).not.toContain(id);
  });

  it('starts each local day with an unseen Word of the Day that stays until midnight', async () => {
    const records = new Map<string, string>();
    const time = fakeClock(today);
    const feed = await run(records, time.clock);
    // The Feed gets each next card ready while the one before it is on screen.
    for (let position = 0; position < 3; position++) await look(feed, time, position, 2000);
    const read = entryIdsOf(feed.cards).slice(0, 3);

    const midnight = fakeClock('2026-10-12T00:00:00+03:00');
    const nextDay = await run(records, midnight.clock);
    await look(nextDay, midnight, 0, 300);
    const lateThatDay = await run(records, fakeClock('2026-10-12T23:59:00+03:00').clock);

    expect(wordOfTheDayOf(feed.cards[0])).toEqual({ year: 2026, month: 10, day: 11 });
    expect(wordOfTheDayOf(nextDay.cards[0])).toEqual({ year: 2026, month: 10, day: 12 });
    expect(read).not.toContain(nextDay.cards[0]?.entryId);
    expect(lateThatDay.cards).toEqual(nextDay.cards.slice(0, 1));
  });
});

describe('Corrections in the Feed over the Ukrainian Language Pack', () => {
  it('turns the Corrections Feature Switch on and has live Corrections to mix in', () => {
    expect(ukrainian.isFeatureEnabled('corrections')).toBe(true);
    expect(liveCorrectionIds.length).toBeGreaterThan(0);
  });

  it('gives each Correction card the Correction card model of its Correction', async () => {
    const feed = await run(new Map(), fakeClock(today).clock, 7, ukrainian);
    while (feed.cards.length < CORRECTION_EVERY) await feed.next();

    const card = feed.cards[CORRECTION_EVERY - 1];
    const [entry] = await content.getEntries([card?.entryId ?? '']);
    const correction = entry?.kind === 'correction' ? entry : undefined;

    // The stressed vowels of a stress trap's forms are the stress traps' test.
    expect(correctionCardOf(card)).toMatchObject({
      kind: 'correction',
      correctionId: correction?.id,
      nonStandardForm: correction?.nonStandardForm,
      mainEquivalent: correction?.standardEquivalents[0],
      otherEquivalents: correction?.standardEquivalents.slice(1),
      correctionType: correction?.correctionType,
      explanation: correction?.explanation,
      examplePair: correction?.examplePair,
      sourceTitles: correction?.sources.map((source) => source.title),
    });
  });
});

describe('Idioms in the Feed over the Ukrainian Language Pack', () => {
  it('turns the Idioms Feature Switch on and has live Idioms to mix in', () => {
    expect(ukrainian.isFeatureEnabled('idioms')).toBe(true);
    expect(liveIdiomIds.length).toBeGreaterThan(0);
  });

  it(
    'opens on a Word and offers each live Entry of every kind once',
    { timeout: WALK_TIMEOUT_MS },
    async () => {
      const feed = await run(new Map(), fakeClock(today).clock, 7, ukrainian);
      const offered = await walk(feed);

      expect(feed.cards[0]?.kind).toBe('word');
      const live = [
        ...liveIds,
        ...liveCorrectionIds,
        ...liveIdiomIds,
        ...liveSynonymRowIds,
        ...liveTipIds,
      ];
      expect(offered).toHaveLength(live.length);
      expect(new Set(offered)).toEqual(new Set(live));
    },
  );

  it('gives each Idiom card the Idiom card model of its Idiom', async () => {
    const feed = await run(new Map(), fakeClock(today).clock, 7, ukrainian);
    while (feed.cards.length < IDIOM_EVERY) await feed.next();

    const card = feed.cards[IDIOM_EVERY - 1];
    const [entry] = await content.getEntries([card?.entryId ?? '']);
    const idiom = entry?.kind === 'idiom' ? entry : undefined;

    expect(card?.kind === 'idiom' ? card.model : undefined).toEqual({
      kind: 'idiom',
      idiomId: idiom?.id,
      expression: idiom?.expression,
      idiomType: idiom?.idiomType,
      primaryDefinition: idiom?.primaryDefinition,
      extraDefinitions: idiom?.extraDefinitions,
      examples: idiom?.examples,
      etymology: idiom?.etymology,
      sourceTitles: idiom?.sources.map((source) => source.title),
    });
  });
});

describe('Favorites over the Ukrainian Language Pack', () => {
  async function open(records: Map<string, string>, clock: Clock) {
    return openComposition({
      content,
      edition: ukrainian,
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock,
      random: seededRandom(7),
    });
  }

  it('keeps a Word and a Correction hearted on their Feed cards across a restart, newest first', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const first = await open(records, time.clock);
    const word = first.feed.cards[0];
    const correctionId = liveCorrectionIds[0];
    if (word?.kind !== 'word' || correctionId === undefined)
      throw new Error('No Word or Correction');

    await first.favorites.toggle(word.entryId);
    time.advance(60_000);
    await first.favorites.toggle(correctionId);
    const app = await open(records, time.clock);

    expect(app.favorites.list.map((favorite) => favorite.entryId)).toEqual([
      correctionId,
      word.entryId,
    ]);
    expect(app.favorites.list[1]?.row).toMatchObject({
      kind: 'word',
      title: word.model.lemma,
      secondLine: word.model.primaryDefinition,
      labelKey: 'word',
    });
    expect(await app.entryCard(correctionId)).toMatchObject({
      kind: 'correction',
      entryId: correctionId,
      model: { mainEquivalent: app.favorites.list[0]?.row.title },
    });
  });
});

describe('the notification plan over the Ukrainian Language Pack', () => {
  it('plans the default times with live Words, each once, titled with their Stress', async () => {
    const scheduler = createFakeNotificationScheduler();
    await openComposition({
      content,
      edition: ukrainian,
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock: fakeClock('2026-10-14T08:00:00+03:00').clock,
      random: seededRandom(7),
      scheduling: { scheduler, ellipsis: '…', titles: ['{word}'] },
    });

    const plan = scheduler.plan ?? [];
    expect(plan).toHaveLength(14 * ukrainian.userSettingDefaults.notificationTimes.length);
    expect(new Set(plan.map(({ wordId }) => wordId)).size).toBe(plan.length);
    for (const notification of plan) {
      expect(liveIds).toContain(notification.wordId);
      expect(notification.title).toMatch(/\u0301/);
      expect(Array.from(notification.body).length).toBeLessThanOrEqual(NOTIFICATION_BODY_LENGTH);
      expect(notification.sound).toEqual({ file: 'notification.wav' });
    }
  });
});
