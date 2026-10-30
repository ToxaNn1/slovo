import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type UserStateChanges,
  type UserStatePort,
} from './index';
import { createMemoryContentPort } from './testing';
import { fakeClock, testEdition, word } from './test-support';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three'), word('w_old', { retired: true })],
});

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
    edition: testEdition({
      isFeatureEnabled: () => false,
      userSettingDefaults: { mix: { corrections: false } },
    }),
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
  return { app, records, writes };
}

/** The ids of the Entries in History, newest first. */
const historyIdsOf = ({ history }: Composition) => history.list.map(({ entryId }) => entryId);

/** Today's Word of the Day: the card the Feed opens on. */
const wordOfTheDayOf = ({ feed }: Composition) => feed.cards[feed.startPosition]?.entryId;
describe.each([
  ['Search', (app: Composition, entryId: string) => app.openedFromSearch(entryId)],
  ['the mood roulette', (app: Composition, entryId: string) => app.openedFromMood(entryId)],
])('opening an Entry from %s', (_source, open) => {
  it('gives its card and leaves Seen, History and the Feed unchanged, writing nothing', async () => {
    const time = fakeClock();
    const { app, records, writes } = await run({ clock: time.clock });
    time.advance(DAY);
    const before = writes.length;
    const cards = app.feed.cards;
    const history = app.history.list;

    const card = await open(app, 'w_three');

    expect(card?.entryId).toBe('w_three');
    expect(writes).toHaveLength(before);
    expect(records.has('feed.seen.w_three')).toBe(false);
    expect(app.history.list).toBe(history);
    expect(app.feed.cards).toBe(cards);
    expect(app.progress.state.seenToday).toBe(0);
  });

  it("leaves today's Word of the Day unseen and out of History", async () => {
    const { app, records } = await run();
    const today = wordOfTheDayOf(app);
    if (today === undefined) throw new Error('No Word of the Day');

    const card = await open(app, today);

    expect(card?.entryId).toBe(today);
    expect(records.has(`feed.seen.${today}`)).toBe(false);
    expect(historyIdsOf(app)).toEqual([]);
  });

  it('leaves an Entry Seen before as it was', async () => {
    const { app } = await run();
    await app.openedFromNotification('w_two');
    const history = app.history.list;

    await open(app, 'w_two');

    expect(app.history.list).toBe(history);
    expect(historyIdsOf(app)).toEqual(['w_two']);
  });

  it('gives no card for an id the Language Pack does not have', async () => {
    const { app, writes } = await run();
    const before = writes.length;

    expect(await open(app, 'w_gone')).toBeUndefined();
    expect(writes).toHaveLength(before);
  });
});

describe('opening the same Entry from a notification after Search', () => {
  it('still makes it Seen and adds it to History', async () => {
    const { app, records } = await run();
    await app.openedFromSearch('w_three');
    await app.openedFromMood('w_three');

    await app.openedFromNotification('w_three');

    expect(records.get('feed.seen.w_three')).toBe('1');
    expect(historyIdsOf(app)).toEqual(['w_three']);
  });
});
