import { describe, expect, it } from 'vitest';

import {
  openComposition,
  type Clock,
  type Composition,
  type UserStateChanges,
  type UserStatePort,
} from './index';
import { createMemoryContentPort } from './testing';
import { correction, fakeClock, testEdition, word } from './test-support';
import { createMemoryUserStatePort, openUserState } from './user-state/user-state';

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three'), word('w_old', { retired: true })],
  corrections: [correction('c_one')],
});

const DAY = 24 * 60 * 60 * 1000;

/**
 * The Core composition of one app run over the records, with every write it
 * makes kept. The Edition turns Corrections on; `corrections` says whether
 * the reader's Mix holds them.
 */
async function run({
  clock = fakeClock().clock,
  corrections = true,
}: { clock?: Clock; corrections?: boolean } = {}) {
  const records = new Map<string, string>();
  const memory = createMemoryUserStatePort(records);
  const writes: UserStateChanges[] = [];
  const port: UserStatePort = {
    ...memory,
    write(changes) {
      writes.push(changes);
      return memory.write(changes);
    },
  };
  const app: Composition = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => feature === 'corrections',
      userSettingDefaults: { mix: { corrections } },
    }),
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
  return { app, records, writes };
}

/** The keys of each write made since `before`, sorted. */
const keysSince = (writes: readonly UserStateChanges[], before: number) =>
  writes.slice(before).map((changes) => [...changes.keys()].sort());

/** The ids of the Entries in History, newest first. */
const historyIdsOf = ({ history }: Composition) => history.list.map(({ entryId }) => entryId);

/** Today's Word of the Day: the card the Feed opens on. */
const wordOfTheDayOf = ({ feed }: Composition) => feed.cards[feed.startPosition]?.entryId;

describe('opening an Entry from the widget', () => {
  it('writes Seen, the History entry and today as an Active Day in one write, and gives its card', async () => {
    const time = fakeClock();
    const { app, records, writes } = await run({ clock: time.clock });
    // A new local day starts with the app in the background; the widget opens it.
    time.advance(DAY);
    const before = writes.length;

    const card = await app.widget.opened('w_three');

    expect(card?.entryId).toBe('w_three');
    expect(keysSince(writes, before)).toEqual([
      ['activeDays.2026-10-12', 'feed.seen.w_three', 'history.w_three'],
    ]);
    expect(records.get('feed.seen.w_three')).toBe('1');
    expect(historyIdsOf(app)).toEqual(['w_three']);
    expect(app.history.list[0]).toMatchObject({
      seenAt: new Date('2026-10-12T09:00:00+03:00'),
      wordOfTheDay: false,
    });
    expect(app.progress.state).toMatchObject({ streak: 2, bestStreak: 2, seenToday: 1 });
  });

  it('makes a Correction in the Mix Seen the same way', async () => {
    const time = fakeClock();
    const { app, writes } = await run({ clock: time.clock });
    time.advance(DAY);
    const before = writes.length;

    const card = await app.widget.opened('c_one');

    expect(card).toMatchObject({ kind: 'correction' });
    expect(card?.entryId).toBe('c_one');
    expect(keysSince(writes, before)).toEqual([
      ['activeDays.2026-10-12', 'feed.seen.c_one', 'history.c_one'],
    ]);
    expect(app.history.list.map(({ entryId, wordOfTheDay }) => [entryId, wordOfTheDay])).toEqual([
      ['c_one', false],
    ]);
  });

  it("joins History as the Word of the Day's card only when it is today's Word of the Day", async () => {
    const { app } = await run();
    const today = wordOfTheDayOf(app);
    if (today === undefined) throw new Error('No Word of the Day');
    const other = ['w_one', 'w_two', 'w_three'].find((id) => id !== today);
    if (other === undefined) throw new Error('No other Word');

    await app.widget.opened(other);
    await app.widget.opened(today);

    expect(app.history.list.map(({ entryId, wordOfTheDay }) => [entryId, wordOfTheDay])).toEqual([
      [today, true],
      [other, false],
    ]);
  });

  it('writes only today as an Active Day for a Hidden Entry, and gives its card', async () => {
    const time = fakeClock();
    const { app, records, writes } = await run({ clock: time.clock });
    await app.hide({ kind: 'entry', entryId: 'w_two' });
    time.advance(DAY);
    const before = writes.length;

    const card = await app.widget.opened('w_two');

    expect(card?.entryId).toBe('w_two');
    expect(keysSince(writes, before)).toEqual([['activeDays.2026-10-12']]);
    expect(records.has('feed.seen.w_two')).toBe(false);
    expect(historyIdsOf(app)).toEqual([]);
  });

  it('writes only today as an Active Day for a Retired Word, and gives its card', async () => {
    const time = fakeClock();
    const { app, records, writes } = await run({ clock: time.clock });
    time.advance(DAY);
    const before = writes.length;

    const card = await app.widget.opened('w_old');

    expect(card?.entryId).toBe('w_old');
    expect(keysSince(writes, before)).toEqual([['activeDays.2026-10-12']]);
    expect(records.has('feed.seen.w_old')).toBe(false);
    expect(historyIdsOf(app)).toEqual([]);
  });

  it('writes only today as an Active Day for a Correction out of the Mix', async () => {
    const time = fakeClock();
    const { app, records, writes } = await run({ clock: time.clock, corrections: false });
    time.advance(DAY);
    const before = writes.length;

    const card = await app.widget.opened('c_one');

    expect(card?.entryId).toBe('c_one');
    expect(keysSince(writes, before)).toEqual([['activeDays.2026-10-12']]);
    expect(records.has('feed.seen.c_one')).toBe(false);
    expect(historyIdsOf(app)).toEqual([]);
  });

  it('writes only today as an Active Day for an Entry already Seen in the Cycle', async () => {
    const time = fakeClock();
    const { app, writes } = await run({ clock: time.clock });
    await app.widget.opened('w_two');
    const history = app.history.list;
    time.advance(DAY);
    const before = writes.length;

    await app.widget.opened('w_two');

    expect(keysSince(writes, before)).toEqual([['activeDays.2026-10-12']]);
    expect(app.history.list).toBe(history);
  });

  it('writes nothing new when the same Entry is opened again', async () => {
    const { app, writes } = await run();
    await app.widget.opened('c_one');
    const before = writes.length;
    const history = app.history.list;

    const card = await app.widget.opened('c_one');

    expect(card?.entryId).toBe('c_one');
    expect(writes).toHaveLength(before);
    expect(app.history.list).toBe(history);
  });

  it('gives no card for an id the Language Pack does not have', async () => {
    const { app, records } = await run();

    expect(await app.widget.opened('w_gone')).toBeUndefined();
    expect(records.has('feed.seen.w_gone')).toBe(false);
    expect(historyIdsOf(app)).toEqual([]);
  });
});
