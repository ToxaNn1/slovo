import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Composition,
  type Feed,
  type FeedCard,
  type UserStatePort,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { correction, fakeClock, word } from '../test-support';

/** The Edition, with the test Words' one Category in its default Mix. */
const testCategories = {
  id: 'test',
  languageTraits: { distractorRule: 'same-part-of-speech' as const },
  userSettingDefaults: {
    mix: { categoryIds: ['test'], corrections: true, idioms: true },
    notificationTimes: [],
  },
};

/** A small pack: eight live Words, a Retired Word, two live Corrections and a Retired one. */
const liveWordIds = Array.from({ length: 8 }, (_, index) => `w_live${String(index)}`);
const liveCorrectionIds = ['c_one', 'c_two'];
const content = createMemoryContentPort({
  words: [...liveWordIds.map((id) => word(id)), word('w_old', { retired: true })],
  corrections: [
    ...liveCorrectionIds.map((id) => correction(id)),
    correction('c_old', { retired: true }),
  ],
});

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
const entryIdsOf = (cards: readonly FeedCard[]) => cards.flatMap((card) => card.entryId ?? []);

/**
 * The ids of every Entry the Feed offers from where it stands, after the
 * cards so far, until it repeats, reaches the end of the Cycle or runs out.
 */
async function walk(feed: Feed): Promise<string[]> {
  const ids = entryIdsOf(feed.cards);
  for (;;) {
    const id = (await feed.next())?.entryId;
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
    read.push(card?.entryId ?? '');
    time.advance(SEEN_DWELL_MS);
  }
}

// What the Hidden Entries share with Favorites is tested once for both in `entry-list.test.ts`.
describe('Hidden Entries', () => {
  it('hides an Entry with the time it had before, so undoing a restore leaves the list exactly as it was', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    await app.hiddenEntries.hide('w_live1');
    time.advance(MINUTE);
    await app.hiddenEntries.hide('w_live2');
    time.advance(MINUTE);
    await app.hiddenEntries.hide('c_one');
    const before = app.hiddenEntries.list;

    const hiddenAt = await app.hiddenEntries.restore('w_live1');
    time.advance(MINUTE);
    await app.hiddenEntries.hide('w_live1', hiddenAt);

    expect(app.hiddenEntries.list).toEqual(before);
    expect(idsOf(app)).toEqual(['c_one', 'w_live2', 'w_live1']);
  });

  it('gives nothing back when restoring an Entry that is not Hidden', async () => {
    const app = await run();

    expect(await app.hiddenEntries.restore('w_live1')).toBeUndefined();
  });

  it('keeps the time it had before across reopening, and a fresh hide still uses the clock', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    await first.hiddenEntries.hide('w_live1');
    time.advance(MINUTE);
    const hiddenAt = await first.hiddenEntries.restore('w_live1');
    time.advance(MINUTE);
    await first.hiddenEntries.hide('w_live1', hiddenAt);
    await first.hiddenEntries.hide('w_live2');

    const app = await run({ records, clock: time.clock });

    expect(app.hiddenEntries.list.map(({ entryId, hiddenAt }) => [entryId, hiddenAt])).toEqual([
      ['w_live2', new Date('2026-10-11T09:02:00+03:00')],
      ['w_live1', new Date('2026-10-11T09:00:00+03:00')],
    ]);
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
      secondLine: 'not one',
      kindKey: 'correction',
      spoken: 'one, not one',
      correctionType: 'calque',
    });
  });

  it('carries what labels a row: a Word\u2019s part of speech, gender and registers, a Correction\u2019s type', async () => {
    const labelled: Word = {
      ...word('w_labelled'),
      partOfSpeech: 'noun',
      gender: 'feminine',
      registers: ['archaic', 'dialectal'],
    };
    const app = await openComposition({
      content: createMemoryContentPort({ words: [labelled], corrections: [correction('c_one')] }),
      edition: { ...testCategories, isFeatureEnabled: (feature) => feature === 'corrections' },
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock: fakeClock().clock,
      random: { next: () => 0.25 },
    });

    expect(await app.entryRow('w_labelled')).toMatchObject({
      kind: 'word',
      partOfSpeech: 'noun',
      gender: 'feminine',
      registers: ['archaic', 'dialectal'],
    });
    expect(await app.entryRow('c_one')).toMatchObject({
      kind: 'correction',
      correctionType: 'calque',
    });
  });

  it('reads eligibility again before it tells the subscribers', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    const hidden = app.feed.cards[1]?.entryId ?? '';
    const told: { hidden: boolean; feed: readonly string[] }[] = [];
    app.hiddenEntries.subscribe(() =>
      told.push({ hidden: app.hiddenEntries.has(hidden), feed: entryIdsOf(app.feed.cards) }),
    );

    await app.hiddenEntries.hide(hidden);
    await app.hiddenEntries.restore(hidden);

    expect(told).toHaveLength(2);
    expect(told[0]?.hidden).toBe(true);
    expect(told[0]?.feed).not.toContain(hidden);
    expect(told[1]?.hidden).toBe(false);
    expect(told[1]?.feed).toContain(hidden);
  });

  it('keeps an Entry eligible when keeping its hide fails, and not eligible when keeping its restore fails', async () => {
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

    const offered = await walk(app.feed);
    expect(offered).toContain(failed);
    expect(offered).not.toContain(hidden);
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
    const seen = app.feed.cards[0]?.entryId ?? '';
    const cycle = records.get('feed.cycle');
    const hidden = twin.find((id, index) => index > 2 && id.startsWith('w_')) ?? '';

    await app.hiddenEntries.hide(hidden);

    expect(records.get('feed.cycle')).toBe(cycle);
    expect(records.get(`feed.seen.${seen}`)).toBe('1');
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
    const wordOfTheDay = first.feed.cards[0]?.entryId ?? '';

    await first.hiddenEntries.hide(wordOfTheDay);
    time.advance(MINUTE);
    const app = await run({ records, clock: time.clock });

    const opening = app.feed.cards[app.feed.startPosition];
    expect(opening).toMatchObject({
      kind: 'word',
      wordOfTheDay: { year: 2026, month: 10, day: 11 },
    });
    expect(opening?.entryId).not.toBe(wordOfTheDay);
    expect(await walk(app.feed)).not.toContain(wordOfTheDay);
  });

  it('stays in Favorites, Collections and History, also after reopening', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    const entryId = app.feed.cards[0]?.entryId ?? '';
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

/** Turns the Feed page by page from its first card to `position`, each too quickly to be Seen. */
async function turnTo(feed: Feed, position: number): Promise<void> {
  for (let page = 0; page <= position; page += 1) await feed.show(page);
}

describe('the Feed, when an Entry is hidden or restored', () => {
  it('drops the hidden card on screen at once: the next card takes its place and the card after it is ready', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    const [first, hidden, next] = entryIdsOf(app.feed.cards);
    const told: (readonly string[])[] = [];
    app.feed.subscribe(() => told.push(entryIdsOf(app.feed.cards)));

    await app.hiddenEntries.hide(hidden ?? '');

    const ids = entryIdsOf(app.feed.cards);
    expect(ids.slice(0, 2)).toEqual([first, next]);
    expect(ids).not.toContain(hidden);
    expect(ids).toHaveLength(3);
    expect(app.feed.position).toBe(1);
    expect(told[0]).toEqual([first, next]);
  });

  it('drops every card of the hidden Entry, also one before the card on screen, and keeps the reader on their card', async () => {
    const app = await run();
    await turnTo(app.feed, 2);
    const [hidden, second, onScreen] = entryIdsOf(app.feed.cards);

    await app.hiddenEntries.hide(hidden ?? '');

    expect(entryIdsOf(app.feed.cards).slice(0, 2)).toEqual([second, onScreen]);
    expect(app.feed.cards[app.feed.position]?.entryId).toBe(onScreen);
  });

  it('drops a hidden card that is ready but not on screen, and gets the next one ready', async () => {
    const app = await run();
    const twin = await walk((await run()).feed);
    await app.feed.show(0);
    const hidden = app.feed.cards[1]?.entryId ?? '';

    await app.hiddenEntries.hide(hidden);

    expect(entryIdsOf(app.feed.cards)).toEqual(twin.filter((id) => id !== hidden).slice(0, 2));
    expect(app.feed.position).toBe(0);
  });

  it('keeps the reader’s place on the card they left while no card is on screen', async () => {
    const app = await run();
    await turnTo(app.feed, 1);

    await app.feed.show(undefined);

    expect(app.feed.position).toBe(1);
  });

  it('gives the place of the card the reader left to the next card when it is hidden while no card is on screen', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    await app.feed.show(undefined);
    const before = entryIdsOf(app.feed.cards);
    const [, hidden, next] = before;

    await app.hiddenEntries.hide(hidden ?? '');

    expect(entryIdsOf(app.feed.cards)).toEqual(before.filter((id) => id !== hidden));
    expect(app.feed.position).toBe(1);
    expect(app.feed.cards[1]?.entryId).toBe(next);
  });

  it('keeps the reader on a card before the one hidden while no card is on screen', async () => {
    const app = await run();
    await turnTo(app.feed, 2);
    await app.feed.show(undefined);
    const [hidden, , onScreen] = entryIdsOf(app.feed.cards);

    await app.hiddenEntries.hide(hidden ?? '');

    expect(app.feed.cards[app.feed.position]?.entryId).toBe(onScreen);
  });

  it('gives the place back to the card the reader left on an undo while no card is on screen', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    await app.feed.show(undefined);
    const before = entryIdsOf(app.feed.cards);
    const hidden = before[1] ?? '';
    await app.hiddenEntries.hide(hidden);

    await app.hiddenEntries.restore(hidden);

    expect(entryIdsOf(app.feed.cards).slice(0, 3)).toEqual(before);
    expect(app.feed.position).toBe(1);
  });

  it('gives the place back on an undo after the reader left the screen, as they haven’t moved', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    const hidden = app.feed.cards[1]?.entryId ?? '';
    await app.hiddenEntries.hide(hidden);
    await app.feed.show(undefined);

    await app.hiddenEntries.restore(hidden);

    expect(app.feed.position).toBe(1);
    expect(app.feed.cards[1]?.entryId).toBe(hidden);
  });

  /** Leaves card 1 before it is Seen and hides it while no card is on screen. */
  async function hideWhileOut() {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    await turnTo(app.feed, 1);
    time.advance(SEEN_DWELL_MS - 1);
    await app.feed.show(undefined);
    const hidden = app.feed.cards[1]?.entryId ?? '';
    time.advance(MINUTE);
    await app.hiddenEntries.hide(hidden);
    time.advance(MINUTE);
    return { records, time, app, hidden, next: app.feed.cards[1]?.entryId ?? '' };
  }

  it('leaves the card the reader left unseen when it is hidden while no card is on screen', async () => {
    const { records, hidden } = await hideWhileOut();

    expect(records.has(`feed.seen.${hidden}`)).toBe(false);
  });

  it('keeps the reader’s place on the card that took it once the reader comes back', async () => {
    const { records, time, app, next } = await hideWhileOut();

    await app.feed.show(app.feed.position);

    const reopened = await run({ records, clock: time.clock });
    expect(reopened.feed.cards[reopened.feed.startPosition]?.entryId).toBe(next);
  });

  it('counts the dwell time of the card that took the place from the reader’s coming back', async () => {
    const { records, time, app, next } = await hideWhileOut();
    await app.feed.show(app.feed.position);

    time.advance(SEEN_DWELL_MS - 1);
    await app.feed.show(2);

    expect(records.has(`feed.seen.${next}`)).toBe(false);
  });

  it('gets the next card into the place of the only card, hidden before any card was on screen', async () => {
    const app = await run();
    const twin = await walk((await run()).feed);
    const hidden = app.feed.cards[0]?.entryId ?? '';

    await app.hiddenEntries.hide(hidden);

    expect(entryIdsOf(app.feed.cards)).toEqual([twin[1]]);
    expect(app.feed.position).toBe(0);
  });

  it('puts the card back where it was on undo, on screen again, with the card after it ready', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    const before = entryIdsOf(app.feed.cards);
    const hidden = before[1] ?? '';
    await app.hiddenEntries.hide(hidden);

    await app.hiddenEntries.restore(hidden);

    const ids = entryIdsOf(app.feed.cards);
    expect(ids.slice(0, 3)).toEqual(before);
    expect(app.feed.position).toBe(1);
    expect(app.feed.cards[1]?.entryId).toBe(hidden);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts back a card that left from before the card on screen, and keeps the reader on their card', async () => {
    const app = await run();
    await turnTo(app.feed, 2);
    const before = entryIdsOf(app.feed.cards);
    const hidden = before[0] ?? '';
    await app.hiddenEntries.hide(hidden);

    await app.hiddenEntries.restore(hidden);

    expect(entryIdsOf(app.feed.cards).slice(0, before.length)).toEqual(before);
    expect(app.feed.position).toBe(2);
  });

  it('puts the card back without taking the screen once the reader has moved on', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    const hidden = app.feed.cards[1]?.entryId ?? '';
    await app.hiddenEntries.hide(hidden);
    await app.feed.show(2);
    const onScreen = app.feed.cards[2]?.entryId;

    await app.hiddenEntries.restore(hidden);

    expect(app.feed.cards[1]?.entryId).toBe(hidden);
    expect(app.feed.cards[app.feed.position]?.entryId).toBe(onScreen);
  });

  it(`makes the hidden card on screen Seen, into History, once it stayed there ${String(SEEN_DWELL_MS)} ms`, async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    await turnTo(app.feed, 1);
    const hidden = app.feed.cards[1]?.entryId ?? '';
    time.advance(SEEN_DWELL_MS);

    await app.hiddenEntries.hide(hidden);

    expect(records.get(`feed.seen.${hidden}`)).toBe('1');
    expect(app.history.list.map(({ entryId }) => entryId)).toEqual([hidden]);
  });

  it('leaves the hidden card on screen unseen when it left before the dwell time', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    await turnTo(app.feed, 1);
    const hidden = app.feed.cards[1]?.entryId ?? '';
    time.advance(SEEN_DWELL_MS - 1);

    await app.hiddenEntries.hide(hidden);

    expect(records.has(`feed.seen.${hidden}`)).toBe(false);
    expect(app.history.list).toEqual([]);
  });

  it('counts the dwell time of the card that takes the place from the moment it does', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    await turnTo(app.feed, 1);
    time.advance(SEEN_DWELL_MS);
    await app.hiddenEntries.hide(app.feed.cards[1]?.entryId ?? '');
    const next = app.feed.cards[1]?.entryId ?? '';

    time.advance(SEEN_DWELL_MS - 1);
    await app.feed.show(2);
    expect(records.has(`feed.seen.${next}`)).toBe(false);

    await app.feed.show(1);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(2);
    expect(records.get(`feed.seen.${next}`)).toBe('1');
  });

  it('keeps the reader on the end-of-Cycle card when the first card of the next Cycle is hidden, and puts that card back into the next Cycle on undo', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    let end = app.feed.startPosition;
    for (; app.feed.cards[end]?.kind !== 'end-of-cycle'; end += 1) {
      await app.feed.show(end);
      time.advance(SEEN_DWELL_MS);
    }
    await app.feed.show(end);
    const hidden = app.feed.cards[end + 1]?.entryId ?? '';
    /** The card on screen and the one after it. */
    const onScreenAndNext = () => {
      const position = app.feed.position;
      return [app.feed.cards[position]?.kind, app.feed.cards[position + 1]?.entryId];
    };

    await app.hiddenEntries.hide(hidden);

    const [onScreen, next] = onScreenAndNext();
    expect(onScreen).toBe('end-of-cycle');
    expect(next).toBeDefined();
    expect(entryIdsOf(app.feed.cards)).not.toContain(hidden);

    await app.hiddenEntries.restore(hidden);

    expect(onScreenAndNext()).toEqual(['end-of-cycle', hidden]);
    const position = app.feed.position;
    await app.feed.show(position + 1);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(position + 2);
    // Seen in the next Cycle.
    expect(records.get(`feed.seen.${hidden}`)).toBe('2');
  });

  it('reopens the same day on the card that took the hidden one’s place', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    await turnTo(app.feed, 1);
    await app.hiddenEntries.hide(app.feed.cards[1]?.entryId ?? '');
    const onScreen = app.feed.cards[1]?.entryId;
    time.advance(MINUTE);

    const reopened = await run({ records, clock: time.clock });

    expect(reopened.feed.cards[reopened.feed.startPosition]?.entryId).toBe(onScreen);
  });
});
