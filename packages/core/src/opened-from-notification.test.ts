import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  entryIdOf,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type UserStateChanges,
  type UserStatePort,
} from './index';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  categories: [{ id: 'test', displayName: 'Test' }],
  userSettingDefaults: { mix: { categoryIds: ['test'], corrections: false } },
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

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three'), word('w_old', true)],
});

/** A clock the test moves in time. */
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

const DAY = 24 * 60 * 60 * 1000;

/** The Core composition of one app run over the records, with every write it makes kept. */
async function run({ clock = fakeClock().clock }: { clock?: Clock } = {}) {
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
    edition: { ...testCategories, isFeatureEnabled: () => false },
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
  return { app, records, writes };
}

/** The ids of the Entries in History, newest first. */
const historyIdsOf = ({ history }: Composition) => history.list.map(({ entryId }) => entryId);

/** Today's Word of the Day: the card the Feed opens on. */
const wordOfTheDayOf = ({ feed }: Composition) => entryIdOf(feed.cards[feed.startPosition]);

describe('opening a Word from a notification', () => {
  it('writes Seen, the History entry and today as an Active Day in one write, and gives its card', async () => {
    const time = fakeClock();
    const { app, records, writes } = await run({ clock: time.clock });
    // A new local day starts with the app in the background; the notification opens it.
    time.advance(DAY);
    const before = writes.length;

    const card = await app.openedFromNotification('w_three');

    expect(card === undefined ? undefined : entryIdOf(card)).toBe('w_three');
    expect(writes.slice(before).map((changes) => [...changes.keys()].sort())).toEqual([
      ['activeDays.2026-10-12', 'feed.seen.w_three', 'history.w_three'],
    ]);
    expect(records.get('feed.seen.w_three')).toBe('true');
    expect(historyIdsOf(app)).toEqual(['w_three']);
    expect(app.history.list[0]).toMatchObject({
      seenAt: new Date('2026-10-12T09:00:00+03:00'),
      wordOfTheDay: false,
    });
    expect(app.progress.state).toEqual({ streak: 2, bestStreak: 2 });
  });

  it("joins History as the Word of the Day's card only when it is today's Word of the Day", async () => {
    const { app } = await run();
    const today = wordOfTheDayOf(app);
    if (today === undefined) throw new Error('No Word of the Day');

    await app.openedFromNotification(today);

    expect(app.history.list.map(({ entryId, wordOfTheDay }) => [entryId, wordOfTheDay])).toEqual([
      [today, true],
    ]);
  });

  it('writes nothing new when the same Word is opened again', async () => {
    const { app, writes } = await run();
    await app.openedFromNotification('w_two');
    const before = writes.length;
    const history = app.history.list;

    const card = await app.openedFromNotification('w_two');

    expect(card === undefined ? undefined : entryIdOf(card)).toBe('w_two');
    expect(writes).toHaveLength(before);
    expect(app.history.list).toBe(history);
  });

  it('opens a Hidden Word as a kept Entry, without Seen or a History entry', async () => {
    const time = fakeClock();
    const { app, records } = await run({ clock: time.clock });
    await app.hide({ kind: 'entry', entryId: 'w_two' });
    time.advance(DAY);

    const card = await app.openedFromNotification('w_two');

    expect(card === undefined ? undefined : entryIdOf(card)).toBe('w_two');
    expect(records.has('feed.seen.w_two')).toBe(false);
    expect(historyIdsOf(app)).toEqual([]);
    // Opening the app from the notification still makes today an Active Day.
    expect(records.get('activeDays.2026-10-12')).toBe('true');
  });

  it('opens a Retired Word as a kept Entry, without Seen or a History entry', async () => {
    const { app, records } = await run();

    const card = await app.openedFromNotification('w_old');

    expect(card === undefined ? undefined : entryIdOf(card)).toBe('w_old');
    expect(records.has('feed.seen.w_old')).toBe(false);
    expect(historyIdsOf(app)).toEqual([]);
  });

  it('gives no card for an id the Language Pack does not have', async () => {
    const { app, records } = await run();

    expect(await app.openedFromNotification('w_gone')).toBeUndefined();
    expect(records.has('feed.seen.w_gone')).toBe(false);
    expect(historyIdsOf(app)).toEqual([]);
  });
});
