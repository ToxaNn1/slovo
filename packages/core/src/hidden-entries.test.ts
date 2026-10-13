import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  entryIdOf,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Composition,
  type Feed,
  type FeedCard,
  type UserStatePort,
} from './index';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  categories: [{ id: 'test', displayName: 'Test' }],
  userSettingDefaults: { mix: { categoryIds: ['test'], corrections: true } },
};

function word(id: string, retired = false): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [0],
    partOfSpeech: 'noun',
    primaryDefinition: `The meaning of ${id.slice(2)}.`,
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

/** A small pack: eight live Words, a Retired Word, two live Corrections and a Retired one. */
const liveWordIds = Array.from({ length: 8 }, (_, index) => `w_live${String(index)}`);
const liveCorrectionIds = ['c_one', 'c_two'];
const content = createMemoryContentPort({
  words: [...liveWordIds.map((id) => word(id)), word('w_old', true)],
  corrections: [...liveCorrectionIds.map((id) => correction(id)), correction('c_old', true)],
});

/** A clock the test moves by hand. */
function fakeClock(start = '2026-10-11T09:00:00+03:00') {
  let now = new Date(start).getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  return {
    clock,
    advance(ms: number) {
      now += ms;
    },
  };
}

const MINUTE = 60_000;

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  clock = fakeClock().clock,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  clock?: Clock;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: { ...testCategories, isFeatureEnabled: (feature) => feature === 'corrections' },
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
}

/** The ids of the Hidden Entries, newest first. */
const idsOf = ({ hiddenEntries }: Composition) => hiddenEntries.list.map(({ entryId }) => entryId);

/** The ids of the Entries the cards show, in order. */
const entryIdsOf = (cards: readonly FeedCard[]) => cards.flatMap((card) => entryIdOf(card) ?? []);

/**
 * The ids of every Entry the Feed offers from where it stands, after the
 * cards so far, until it repeats, reaches the end of the Cycle or runs out.
 */
async function walk(feed: Feed): Promise<string[]> {
  const ids = entryIdsOf(feed.cards);
  for (;;) {
    const id = entryIdOf(await feed.next());
    if (id === undefined || ids.includes(id)) return ids;
    ids.push(id);
  }
}

/**
 * Reads every card of the current Cycle to its end, each long enough to be
 * Seen, and swipes on to the first card of the next Cycle. Returns the ids
 * of the Entries read.
 */
async function readToTheNextCycle(feed: Feed, time: ReturnType<typeof fakeClock>) {
  const read: string[] = [];
  for (let position = feed.startPosition; ; position += 1) {
    await feed.show(position);
    const card = feed.cards[position];
    if (card?.kind === 'end-of-cycle') {
      await feed.show(position + 1);
      return read;
    }
    read.push(entryIdOf(card) ?? '');
    time.advance(SEEN_DWELL_MS);
  }
}

describe('Hidden Entries', () => {
  it('hides an Entry with the time it was hidden, and restores it', async () => {
    const app = await run();

    await app.hiddenEntries.hide('w_live2');

    expect(app.hiddenEntries.has('w_live2')).toBe(true);
    expect(app.hiddenEntries.list).toEqual([
      {
        entryId: 'w_live2',
        hiddenAt: new Date('2026-10-11T09:00:00+03:00'),
        row: {
          kind: 'word',
          entryId: 'w_live2',
          title: 'ĺive2',
          definition: 'The meaning of live2.',
        },
      },
    ]);

    await app.hiddenEntries.restore('w_live2');

    expect(app.hiddenEntries.has('w_live2')).toBe(false);
    expect(app.hiddenEntries.list).toEqual([]);
  });

  it('lists the newest first, Corrections like Words', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });

    for (const id of ['w_live1', 'c_one', 'w_live3']) {
      await app.hiddenEntries.hide(id);
      time.advance(MINUTE);
    }

    expect(idsOf(app)).toEqual(['w_live3', 'c_one', 'w_live1']);
    expect(app.hiddenEntries.list[1]?.row).toEqual({
      kind: 'correction',
      entryId: 'c_one',
      title: 'one',
      nonStandardForm: 'not one',
    });
  });

  it('keeps the first time when a Hidden Entry is hidden again', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    await app.hiddenEntries.hide('w_live1');
    time.advance(MINUTE);

    await app.hiddenEntries.hide('w_live1');

    expect(app.hiddenEntries.list.map(({ hiddenAt }) => hiddenAt)).toEqual([
      new Date('2026-10-11T09:00:00+03:00'),
    ]);
  });

  it('survives reopening, with the times they were hidden, one `hidden.` record per Entry', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    await first.hiddenEntries.hide('w_live1');
    time.advance(MINUTE);
    await first.hiddenEntries.hide('c_one');
    await first.hiddenEntries.restore('w_live1');
    time.advance(MINUTE);
    await first.hiddenEntries.hide('w_old');

    const app = await run({ records, clock: time.clock });

    expect(app.hiddenEntries.list).toEqual(first.hiddenEntries.list);
    expect(idsOf(app)).toEqual(['w_old', 'c_one']);
    expect([...records.keys()].filter((key) => key.startsWith('hidden.')).sort()).toEqual([
      'hidden.c_one',
      'hidden.w_old',
    ]);
  });

  it('skips an id the Language Pack does not have, in the list and in every lookup', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    await first.hiddenEntries.hide('w_live1');
    records.set('hidden.w_gone', JSON.stringify('2026-10-11T07:00:00.000Z'));

    const app = await run({ records });
    await app.hiddenEntries.hide('c_gone');

    expect(idsOf(app)).toEqual(['w_live1']);
    expect(app.hiddenEntries.has('w_gone')).toBe(false);
    expect(records.has('hidden.c_gone')).toBe(false);
  });

  it('changes nothing in memory when keeping the change fails', async () => {
    const records = new Map<string, string>();
    let failing = false;
    const port = createMemoryUserStatePort(records);
    const app = await run({
      port: {
        ...port,
        write: (changes) =>
          failing ? Promise.reject(new Error('The disk is full')) : port.write(changes),
      },
    });
    // Two Words the Feed has not shown yet.
    const [hidden = '', failed = ''] = liveWordIds.filter(
      (id) => !entryIdsOf(app.feed.cards).includes(id),
    );
    await app.hiddenEntries.hide(hidden);
    failing = true;

    await expect(app.hiddenEntries.hide(failed)).rejects.toThrow('The disk is full');
    await expect(app.hiddenEntries.restore(hidden)).rejects.toThrow('The disk is full');

    expect(idsOf(app)).toEqual([hidden]);
    const offered = await walk(app.feed);
    expect(offered).toContain(failed);
    expect(offered).not.toContain(hidden);
  });

  describe('the snapshot', () => {
    it('is a new object after each change, telling the subscribers, and the same one otherwise', async () => {
      const app = await run();
      let told = 0;
      app.hiddenEntries.subscribe(() => {
        told += 1;
      });
      const empty = app.hiddenEntries.list;

      await app.hiddenEntries.restore('w_live1');
      expect(app.hiddenEntries.list).toBe(empty);

      await app.hiddenEntries.hide('w_live1');
      const hidden = app.hiddenEntries.list;
      expect(hidden).not.toBe(empty);

      await app.hiddenEntries.hide('w_live1');
      expect(app.hiddenEntries.list).toBe(hidden);
      expect(told).toBe(1);

      await app.hiddenEntries.restore('w_live1');
      expect(app.hiddenEntries.list).not.toBe(hidden);
      expect(told).toBe(2);
    });

    it('stops telling a subscriber that unsubscribed', async () => {
      const app = await run();
      let told = 0;
      const stop = app.hiddenEntries.subscribe(() => {
        told += 1;
      });

      stop();
      await app.hiddenEntries.hide('w_live1');

      expect(told).toBe(0);
    });
  });
});

describe('a Hidden Entry', () => {
  it('is not eligible: the Feed never offers it again in the same Cycle', async () => {
    const app = await run();
    const [, word = '', correction = ''] = await walk((await run()).feed).then((ids) => [
      ids[0],
      ids.find((id) => id.startsWith('w_') && id !== ids[0]),
      ids.find((id) => id.startsWith('c_')),
    ]);

    await app.hiddenEntries.hide(word);
    await app.hiddenEntries.hide(correction);
    const offered = await walk(app.feed);

    expect(offered).not.toContain(word);
    expect(offered).not.toContain(correction);
    expect(new Set(offered)).toEqual(
      new Set(
        [...liveWordIds, ...liveCorrectionIds].filter((id) => ![word, correction].includes(id)),
      ),
    );
  });

  it('never comes back in a later Cycle, nor after reopening', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    const hidden = 'w_live5';
    await app.hiddenEntries.hide(hidden);

    expect(await readToTheNextCycle(app.feed, time)).not.toContain(hidden);
    expect(await walk(app.feed)).not.toContain(hidden);

    const reopened = await run({ records, clock: time.clock });
    expect(await walk(reopened.feed)).not.toContain(hidden);
  });

  it('keeps what is Seen, the seed and the order of the Entries that stay', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    const twin = await walk((await run()).feed);
    await app.feed.show(0);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(1);
    const seen = entryIdOf(app.feed.cards[0]) ?? '';
    const cycle = records.get('feed.cycle');
    const hidden = twin.find((id, index) => index > 2 && id.startsWith('w_')) ?? '';

    await app.hiddenEntries.hide(hidden);

    expect(records.get('feed.cycle')).toBe(cycle);
    expect(records.get(`feed.seen.${seen}`)).toBe('true');
    const words = (ids: readonly string[]) => ids.filter((id) => id.startsWith('w_'));
    expect(words(await walk(app.feed))).toEqual(words(twin).filter((id) => id !== hidden));
  });

  it('is eligible again once restored, in its place in the Cycle', async () => {
    const app = await run();
    const twin = await walk((await run()).feed);
    const hidden = twin.find((id, index) => index > 2 && id.startsWith('w_')) ?? '';

    await app.hiddenEntries.hide(hidden);
    await app.hiddenEntries.restore(hidden);

    expect(await walk(app.feed)).toEqual(twin);
  });

  it('as the Word of the Day, is chosen again', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    const wordOfTheDay = entryIdOf(first.feed.cards[0]) ?? '';

    await first.hiddenEntries.hide(wordOfTheDay);
    time.advance(MINUTE);
    const app = await run({ records, clock: time.clock });

    const opening = app.feed.cards[app.feed.startPosition];
    expect(opening).toMatchObject({
      kind: 'word',
      wordOfTheDay: { year: 2026, month: 10, day: 11 },
    });
    expect(entryIdOf(opening)).not.toBe(wordOfTheDay);
    expect(await walk(app.feed)).not.toContain(wordOfTheDay);
  });

  it('stays in Favorites, Collections and History, also after reopening', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    const entryId = entryIdOf(app.feed.cards[0]) ?? '';
    await app.feed.show(0);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(1);
    await app.favorites.add(entryId);
    const created = await app.collections.create('Kept', entryId);
    if (!created.ok) throw new Error('The Collection was refused');

    await app.hiddenEntries.hide(entryId);

    for (const opened of [app, await run({ records, clock: time.clock })]) {
      expect(opened.hiddenEntries.has(entryId)).toBe(true);
      expect(opened.favorites.has(entryId)).toBe(true);
      expect(opened.collections.has(created.collection.id, entryId)).toBe(true);
      expect(opened.history.list.map((seen) => seen.entryId)).toEqual([entryId]);
    }
  });
});
