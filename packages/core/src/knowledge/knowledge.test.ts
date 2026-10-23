import { describe, expect, it } from 'vitest';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type ContentReadPort,
  type FeatureSwitch,
} from '../index';
import { correction, fakeClock, knownCounts, word } from '../test-support';

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three')],
  corrections: [correction('c_one')],
});

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  pack = content,
  clock = fakeClock('2026-10-19T09:00:00.000Z').clock,
  on = ['knowledge', 'corrections'],
}: {
  records?: Map<string, string>;
  pack?: ContentReadPort;
  clock?: Clock;
  on?: readonly FeatureSwitch[];
} = {}): Promise<Composition> {
  return openComposition({
    content: pack,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => on.includes(feature),
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: { categoryIds: ['test'], corrections: true, idioms: true },
        notificationTimes: [],
      },
    },
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
      due: [],
      shown: new Map(),
    });
  });

  it('changes nothing in memory when keeping a mark fails', async () => {
    const records = new Map<string, string>();
    const port = createMemoryUserStatePort(records);
    const app = await openComposition({
      content,
      edition: {
        id: 'test',
        isFeatureEnabled: (feature) => feature === 'knowledge',
        languageTraits: { distractorRule: 'same-part-of-speech' },
        userSettingDefaults: {
          mix: { categoryIds: ['test'], corrections: false, idioms: true },
          notificationTimes: [],
        },
      },
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
