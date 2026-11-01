import { describe, expect, it } from 'vitest';

import {
  openComposition,
  type Clock,
  type Composition,
  type ContentReadPort,
  type FeatureSwitch,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { correction, fakeClock, knownCounts, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three')],
  corrections: [correction('c_one')],
});

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  pack = content,
  clock = fakeClock('2026-10-19T09:00:00.000Z').clock,
  on = ['knowledge', 'confirmedEntries', 'corrections'],
}: {
  records?: Map<string, string>;
  pack?: ContentReadPort;
  clock?: Clock;
  on?: readonly FeatureSwitch[];
} = {}): Promise<Composition> {
  return openComposition({
    content: pack,
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature),
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
  });
}

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

/** The «Вчу» list as the Entries and the local days until their Review. */
const learningOf = (app: Composition) =>
  app.knowledge.state.learning.map(({ entryId, daysUntilReview }) => [entryId, daysUntilReview]);

// Spec #461, ADR 0043: the knowledge module the cards and the Game mark through.
describe('Knowledge Marks', () => {
  it('marks a Word and a Correction, and keeps the marks for the next launch', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    await app.knowledge.tap('w_one', 'unknown');
    await app.knowledge.tap('c_one', 'known');

    const next = await run({ records });
    expect(learningOf(next)).toEqual([['w_one', 1]]);
    expect(next.knowledge.state.shown.get('w_one')).toBe('unknown');
    expect(next.knowledge.state.shown.get('c_one')).toBe('known');
    expect(next.knowledge.state).toMatchObject({ known: knownCounts({ correction: 1 }) });
    expect(next.knowledge.state.shown.get('w_two')).toBeUndefined();
  });

  it('changes the mark on a tap of the other one and removes it on a tap of the same one', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    let told = 0;
    app.knowledge.subscribe(() => {
      told += 1;
    });

    await app.knowledge.tap('w_one', 'unknown');
    await app.knowledge.tap('w_one', 'known');
    expect(app.knowledge.state.shown.get('w_one')).toBe('known');

    await app.knowledge.tap('w_one', 'known');
    expect(app.knowledge.state.shown.get('w_one')).toBeUndefined();
    expect(learningOf(app)).toEqual([]);
    expect([...records.keys()].filter((key) => key.startsWith('knowledge.'))).toEqual([]);
    expect(told).toBe(3);
  });

  it('takes a tap on a due Entry as its Review answer, the same mark too', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');
    time.advance(DAY);
    await app.resume();

    expect(app.knowledge.state.shown.get('w_one')).toBe('review');
    await app.knowledge.tap('w_one', 'unknown');

    expect(learningOf(app)).toEqual([['w_one', 1]]);
    expect(app.knowledge.state.shown.get('w_one')).toBe('unknown');
  });

  it("shows a due Entry's card as a Review with no mark, in the Feed and on its Entry screen alike", async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');
    expect(await app.entryCard('w_one')).not.toHaveProperty('review');
    time.advance(DAY);
    await app.resume();

    expect(app.knowledge.state.shown.get('w_one')).toBe('review');
    expect(await app.entryCard('w_one')).toMatchObject({ review: true });
    while ((await app.feed.next())?.kind === 'word');
    const feedCard = app.feed.cards.find((card) => card.entryId === 'w_one');
    expect(feedCard).toMatchObject({ review: true });
    expect(await app.entryCard('w_two')).not.toHaveProperty('review');

    await app.knowledge.tap('w_one', 'known');
    expect(app.knowledge.state.shown.get('w_one')).toBe('known');
    expect(await app.entryCard('w_one')).not.toHaveProperty('review');
  });

  it('keeps the instant a mark is set or changed, from a tap and from an answer alike', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ records, clock: time.clock });
    const markTime = (entryId: string) =>
      userStateRecords.knowledge.record(entryId).decode(records.get(`knowledge.${entryId}`))
        ?.markedAt;

    await app.knowledge.tap('w_one', 'unknown');
    expect(markTime('w_one')).toBe('2026-10-19T09:00:00.000Z');

    time.advance(HOUR);
    await app.knowledge.tap('w_one', 'known');
    expect(markTime('w_one')).toBe('2026-10-19T10:00:00.000Z');

    time.advance(HOUR);
    await app.knowledge.answer('w_two', 'unknown');
    expect(markTime('w_two')).toBe('2026-10-19T11:00:00.000Z');
  });

  it('keeps the mark time while a Review answer leaves the same mark', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ records, clock: time.clock });
    const record = () =>
      userStateRecords.knowledge.record('w_one').decode(records.get('knowledge.w_one'));

    await app.knowledge.tap('w_one', 'unknown');
    time.advance(DAY);
    await app.resume();
    await app.knowledge.answer('w_one', 'known');
    expect(record()).toMatchObject({ mark: 'known', markedAt: '2026-10-20T09:00:00.000Z' });

    time.advance(7 * DAY);
    await app.resume();
    await app.knowledge.answer('w_one', 'known');
    expect(record()).toMatchObject({ mark: 'known', markedAt: '2026-10-20T09:00:00.000Z' });
    expect(record()?.step).not.toBe(1);
  });

  it('reads a mark kept before 0.8.13, with no mark time, and gives it one once it changes', async () => {
    const records = new Map([
      [
        'knowledge.w_one',
        JSON.stringify({ mark: 'unknown', step: 1, reviewDay: '2026-10-20', learned: false }),
      ],
    ]);
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ records, clock: time.clock });
    const record = () =>
      userStateRecords.knowledge.record('w_one').decode(records.get('knowledge.w_one'));

    expect(app.knowledge.state.shown.get('w_one')).toBe('unknown');
    expect(learningOf(app)).toEqual([['w_one', 1]]);
    expect(record()).not.toHaveProperty('markedAt');

    await app.knowledge.tap('w_one', 'known');
    expect(record()).toMatchObject({ mark: 'known', markedAt: '2026-10-19T09:00:00.000Z' });
  });

  it('answers by the local day: Unknown at 23:50 is due the morning after', async () => {
    // 23:50 in Kyiv, still 20:50 on the same day in UTC.
    const time = fakeClock('2026-10-19T20:50:00.000Z', 'Europe/Kyiv');
    const app = await run({ clock: time.clock });

    await app.knowledge.tap('w_one', 'unknown');
    time.advance(20 * 60_000);
    await app.resume();

    expect(learningOf(app)).toEqual([['w_one', 0]]);
    expect(app.knowledge.state.due).toEqual(['w_one']);
  });

  it('keeps an Entry due until it is answered, however many days pass', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');

    expect(app.knowledge.state.due).toEqual([]);
    time.advance(5 * DAY);
    await app.resume();
    expect(app.knowledge.state.due).toEqual(['w_one']);
    expect(learningOf(app)).toEqual([['w_one', -4]]);

    await app.knowledge.answer('w_one', 'known');
    expect(app.knowledge.state.due).toEqual([]);
    expect(learningOf(app)).toEqual([['w_one', 3]]);
  });

  it('leaves a Hidden Entry out of the «Вчу» list and the due Entries until it is restored', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');
    await app.knowledge.tap('w_two', 'unknown');
    time.advance(DAY);
    await app.resume();
    let told = 0;
    app.knowledge.subscribe(() => {
      told += 1;
    });

    await app.hiddenEntries.hide('w_one');
    expect(learningOf(app)).toEqual([['w_two', 0]]);
    expect(app.knowledge.state.due).toEqual(['w_two']);
    expect(app.knowledge.weak()).toEqual(['w_two']);
    expect(told).toBe(1);

    await app.hiddenEntries.restore('w_one');
    expect(learningOf(app)).toEqual([
      ['w_one', 0],
      ['w_two', 0],
    ]);
    expect(app.knowledge.state.due).toEqual(['w_one', 'w_two']);
    expect(told).toBe(2);
  });

  it('keeps a due Entry out of the Mix in the «Вчу» list and the due Entries', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('c_one', 'unknown');
    time.advance(DAY);
    await app.resume();

    await app.mix.setKind('correction', false);
    expect(learningOf(app)).toEqual([['c_one', 0]]);
    expect(app.knowledge.state.due).toEqual(['c_one']);
  });

  it('answers by the interval rule alone, so Unknown on an Entry marked Unknown starts it again', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'known');

    await app.knowledge.answer('w_one', 'unknown');
    await app.knowledge.answer('w_one', 'unknown');

    expect(app.knowledge.state.shown.get('w_one')).toBe('unknown');
    expect(learningOf(app)).toEqual([['w_one', 1]]);
  });

  it('marks nothing with the knowledge switch off, and keeps the marks there are', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).knowledge.tap('w_one', 'unknown');
    const off = await run({ records, on: ['corrections'] });

    await off.knowledge.tap('w_one', 'unknown');
    await off.knowledge.tap('w_two', 'known');
    await off.knowledge.answer('c_one', 'unknown');

    expect(off.knowledge.state.shown.get('w_two')).toBeUndefined();
    expect(off.knowledge.state.shown.get('c_one')).toBeUndefined();
    const on = await run({ records });
    expect(on.knowledge.state.shown.get('w_one')).toBe('unknown');
    expect(learningOf(on)).toEqual([['w_one', 1]]);
    expect(on.knowledge.state.shown.get('w_two')).toBeUndefined();
  });

  it('lists the Entries the reader is learning by their next Review day, Learned and Known left out', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('c_one', 'unknown');
    await app.knowledge.tap('w_three', 'unknown');
    await app.knowledge.tap('w_two', 'known');
    time.advance(DAY);

    await app.knowledge.answer('c_one', 'known');
    await app.knowledge.tap('w_one', 'unknown');

    const { learning } = app.knowledge.state;
    expect(
      learning.map(({ entryId, daysUntilReview, row }) => [entryId, daysUntilReview, row.kind]),
    ).toEqual([
      ['w_three', 0, 'word'],
      ['w_one', 1, 'word'],
      ['c_one', 3, 'correction'],
    ]);
    expect(learning.map(({ row }) => row.entryId)).toEqual(['w_three', 'w_one', 'c_one']);
  });

  it("turns the «Вчу» list and today's Review to a new local day, and tells the subscribers", async () => {
    // 23:00 in Kyiv.
    const time = fakeClock('2026-10-19T20:00:00.000Z', 'Europe/Kyiv');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');
    const before = app.knowledge.state;
    expect(
      before.learning.map(({ entryId, daysUntilReview }) => [entryId, daysUntilReview]),
    ).toEqual([['w_one', 1]]);
    expect(before.due).toEqual([]);
    let told = 0;
    app.knowledge.subscribe(() => {
      told += 1;
    });

    time.advance(HOUR + 60_000);
    expect(app.knowledge.state).toBe(before);
    await app.resume();

    const after = app.knowledge.state;
    expect(
      after.learning.map(({ entryId, daysUntilReview }) => [entryId, daysUntilReview]),
    ).toEqual([['w_one', 0]]);
    expect(after.due).toEqual(['w_one']);
    expect(app.progress.state.dueToday).toBe(1);
    expect(told).toBe(1);
    await app.resume();
    expect(app.knowledge.state).toBe(after);
    expect(told).toBe(1);
  });

  it('leaves out a removed mark and an Entry no longer in the Language Pack', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.knowledge.tap('w_one', 'unknown');
    await app.knowledge.tap('w_two', 'unknown');
    await app.knowledge.tap('w_three', 'unknown');
    await app.knowledge.tap('w_one', 'unknown');

    const next = await run({
      records,
      pack: createMemoryContentPort({ words: [word('w_one'), word('w_three')], corrections: [] }),
    });

    expect(learningOf(next)).toEqual([['w_three', 1]]);
  });

  it('lists nothing with the knowledge switch off', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).knowledge.tap('w_one', 'unknown');

    expect((await run({ records, on: ['corrections'] })).knowledge.state).toEqual({
      learning: [],
      known: knownCounts(),
      confirmed: { total: 0, byRarity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      due: [],
      shown: new Map(),
    });
  });

  it('changes nothing in memory when keeping a mark fails', async () => {
    const records = new Map<string, string>();
    const port = createMemoryUserStatePort(records);
    const app = await openComposition({
      content,
      edition: testEdition({
        isFeatureEnabled: (feature) => feature === 'knowledge',
        userSettingDefaults: { mix: { corrections: false } },
      }),
      userState: await openUserState({ port }),
      clock: fakeClock().clock,
      random: { next: () => 0.25 },
    });
    port.write = () => Promise.reject(new Error('The disk is full'));

    const before = app.knowledge.state;
    await expect(app.knowledge.tap('w_one', 'unknown')).rejects.toThrow('The disk is full');

    expect(app.knowledge.state.shown.get('w_one')).toBeUndefined();
    expect(app.knowledge.state).toBe(before);
  });
});

/** Answers the Entry Known on each of its Reviews in turn, `times` times, the clock moved to each Review day. */
async function reviewKnown(
  app: Composition,
  time: ReturnType<typeof fakeClock>,
  entryId: string,
  times: number,
): Promise<void> {
  for (let count = 0; count < times; count += 1) {
    const days = app.knowledge.state.learning.find((entry) => entry.entryId === entryId);
    if (days === undefined) throw new Error(`${entryId} has no Review`);
    time.advance(days.daysUntilReview * DAY);
    await app.resume();
    expect(app.knowledge.state.due).toContain(entryId);
    await app.knowledge.tap(entryId, 'known');
  }
}

// Spec #1358, ADR 0043 as amended: Review at 1, 3, 7, 30 and 90 local days.
describe('Review 1–3–7–30–90', () => {
  it('brings an Entry back after 1, 3, 7, 30 and 90 days, and Known on the 90-day Review makes it Learned', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ records, clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');

    const waits: number[] = [];
    for (let count = 0; count < 5; count += 1) {
      const days = learningOf(app)[0]?.[1];
      if (typeof days !== 'number') throw new Error('No Review');
      waits.push(days);
      await reviewKnown(app, time, 'w_one', 1);
    }

    expect(waits).toEqual([1, 3, 7, 30, 90]);
    expect(learningOf(app)).toEqual([]);
    expect(app.knowledge.state.due).toEqual([]);
    expect(app.knowledge.state.shown.get('w_one')).toBe('known');
    expect(app.knowledge.state).toMatchObject({ known: knownCounts({ word: 1 }) });
    const next = await run({ records, clock: fakeClock('2028-01-01T09:00:00.000Z').clock });
    expect(next.knowledge.state.due).toEqual([]);
    expect(learningOf(next)).toEqual([]);
  });

  it('starts a Review again at 1 day on Unknown at any step', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');
    await reviewKnown(app, time, 'w_one', 3);
    expect(learningOf(app)).toEqual([['w_one', 30]]);

    time.advance(30 * DAY);
    await app.resume();
    await app.knowledge.tap('w_one', 'unknown');

    expect(learningOf(app)).toEqual([['w_one', 1]]);
    expect(app.knowledge.state.shown.get('w_one')).toBe('unknown');
  });

  it('moves an Entry kept on the old 7-day step on to 30 days on Known, not to Learned', async () => {
    const records = new Map([
      [
        'knowledge.w_one',
        JSON.stringify({ mark: 'known', step: 7, reviewDay: '2026-10-19', learned: false }),
      ],
      [
        'knowledge.w_two',
        JSON.stringify({ mark: 'known', step: null, reviewDay: null, learned: true }),
      ],
    ]);
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ records, clock: time.clock });

    expect(app.knowledge.state.due).toEqual(['w_one']);
    expect(app.knowledge.state.shown.get('w_one')).toBe('review');
    await app.knowledge.tap('w_one', 'known');

    expect(learningOf(app)).toEqual([['w_one', 30]]);
    expect(app.knowledge.state.shown.get('w_one')).toBe('known');
    // An Entry Learned before 1.0 stays Learned.
    expect(app.knowledge.state.shown.get('w_two')).toBe('known');
    expect(app.knowledge.state).toMatchObject({ known: knownCounts({ word: 2 }) });
  });
});

/** The confirmed-Entry counts as the Profile and the Badges read them. */
const confirmedOf = (app: Composition) => app.knowledge.state.confirmed;

// Spec #1358, ADR 0043: an Entry is confirmed on Known at a Review of 7 days
// or later, or answered right in a Game or a Quick Question, and stays so.
describe('Confirmed Entries', () => {
  const pack = createMemoryContentPort({
    words: [word('w_one', { rarity: 2 }), word('w_two', { rarity: 5 }), word('w_three')],
    corrections: [correction('c_one')],
  });

  it('counts an Entry on Known at its 7-day Review, by rarity, once, and not before', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ records, pack, clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');
    await app.knowledge.tap('w_two', 'unknown');
    await reviewKnown(app, time, 'w_one', 2);
    await reviewKnown(app, time, 'w_two', 2);
    expect(confirmedOf(app)).toEqual({ total: 0, byRarity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });

    await reviewKnown(app, time, 'w_one', 1);
    expect(confirmedOf(app)).toEqual({ total: 1, byRarity: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 } });

    await reviewKnown(app, time, 'w_one', 2);
    await reviewKnown(app, time, 'w_two', 1);
    expect(confirmedOf(app)).toEqual({ total: 2, byRarity: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 } });

    const next = await run({ records, pack, clock: time.clock });
    expect(confirmedOf(next)).toEqual(confirmedOf(app));
  });

  it('counts a Correction confirmed on its 30-day Review in the total, with no rarity', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ pack, clock: time.clock });
    await app.knowledge.tap('c_one', 'unknown');
    await reviewKnown(app, time, 'c_one', 4);

    expect(confirmedOf(app)).toEqual({ total: 1, byRarity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  });

  it('counts an Entry answered right in a Game or a Quick Question, and keeps it whatever its mark does', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ records, pack, clock: time.clock });
    let told = 0;
    app.knowledge.subscribe(() => {
      told += 1;
    });

    await app.knowledge.confirm('w_two');
    expect(confirmedOf(app)).toEqual({ total: 1, byRarity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } });
    expect(app.knowledge.state.shown.get('w_two')).toBeUndefined();
    expect(told).toBe(1);

    await app.knowledge.confirm('w_two');
    expect(told).toBe(1);
    await app.knowledge.answer('w_two', 'unknown');
    await app.knowledge.tap('w_two', 'unknown');
    expect(app.knowledge.state.shown.get('w_two')).toBeUndefined();
    expect(confirmedOf(app)).toEqual({ total: 1, byRarity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } });

    const next = await run({ records, pack, clock: time.clock });
    expect(confirmedOf(next)).toEqual(confirmedOf(app));
  });

  it('hides the counts and confirms nothing with the confirmedEntries Feature Switch off, while Review goes on', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ records, pack, clock: time.clock });
    await app.knowledge.confirm('w_one');

    const off = await run({ records, pack, clock: time.clock, on: ['knowledge', 'corrections'] });
    await off.knowledge.confirm('w_two');
    await off.knowledge.tap('w_three', 'unknown');
    await reviewKnown(off, time, 'w_three', 3);
    expect(learningOf(off)).toEqual([['w_three', 30]]);
    expect(confirmedOf(off)).toEqual({ total: 0, byRarity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
    expect(off.knowledge.state.shown.get('w_three')).toBe('known');

    const on = await run({ records, pack, clock: time.clock });
    expect(confirmedOf(on)).toEqual({ total: 1, byRarity: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 } });
  });
});
