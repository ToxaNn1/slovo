import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Composition,
  type FeatureSwitch,
  type UserStateChanges,
  type UserStatePort,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, word } from '../test-support';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  id: 'test',
  languageTraits: { distractorRule: 'same-part-of-speech' as const },
  userSettingDefaults: {
    mix: {
      categoryIds: ['test'],
      correctionCategoryIds: 'all' as const,
      corrections: false,
      idioms: true,
      synonymRows: true,
      tips: true,
    },
    notificationTimes: [],
  },
};

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three')],
});

/**
 * The Core composition of one app run over the records, with every write it
 * makes kept, the Word of the Day archive on unless said otherwise.
 */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock('2026-10-26T09:00:00+03:00').clock,
  on = ['wordOfTheDayArchive'],
}: { records?: Map<string, string>; clock?: Clock; on?: FeatureSwitch[] } = {}) {
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
    edition: { ...testCategories, isFeatureEnabled: (feature) => on.includes(feature) },
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
  return { app, records, writes };
}

/** Shows the card at `position` for `ms` and takes it off screen, as the UI reports it. */
async function look(
  app: Composition,
  time: ReturnType<typeof fakeClock>,
  position: number,
  ms: number,
) {
  await app.feed.show(position);
  time.advance(ms);
  await app.feed.show(undefined);
}

/** The Entry the card at `position` shows. */
function idAt(app: Composition, position: number): string {
  const id = app.feed.cards[position]?.entryId;
  if (id === undefined) throw new Error(`No Entry card at ${String(position)}`);
  return id;
}

/** The archive as kept: each local date and the id of its Word. */
const archiveOf = (records: Map<string, string>): [string, unknown][] =>
  [...records]
    .filter(([key]) => key.startsWith('wordOfTheDayArchive.'))
    .map(([key, value]) => [key.slice('wordOfTheDayArchive.'.length), JSON.parse(value)]);

describe('The Word of the Day archive', () => {
  it("keeps the local date and the Word once the Word of the Day's card is Seen, in the Seen write", async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app, records, writes } = await run({ clock: time.clock });
    const today = idAt(app, 0);

    await look(app, time, 0, SEEN_DWELL_MS);

    expect(archiveOf(records)).toEqual([['2026-10-26', today]]);
    const seenWrite = writes.find((changes) => changes.has(`feed.seen.${today}`));
    expect(seenWrite?.get('wordOfTheDayArchive.2026-10-26')).toBe(JSON.stringify(today));
  });

  it('keeps nothing before the card is Seen', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app, records } = await run({ clock: time.clock });

    await look(app, time, 0, SEEN_DWELL_MS - 1);

    expect(archiveOf(records)).toEqual([]);
  });

  it('keeps nothing of a card that is not the Word of the Day', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app, records } = await run({ clock: time.clock });

    await look(app, time, 1, SEEN_DWELL_MS);

    expect(archiveOf(records)).toEqual([]);
  });

  it('keeps the day the Word of the Day is opened from its notification', async () => {
    const { app, records } = await run();
    const today = idAt(app, 0);

    await app.openedFromNotification(today);

    expect(archiveOf(records)).toEqual([['2026-10-26', today]]);
  });

  it('gathers one day after another, each under its own date', async () => {
    const records = new Map<string, string>();
    const monday = fakeClock('2026-10-26T09:00:00+03:00');
    const first = await run({ records, clock: monday.clock });
    const mondaysWord = idAt(first.app, 0);
    await look(first.app, monday, 0, SEEN_DWELL_MS);
    const tuesday = fakeClock('2026-10-27T09:00:00+03:00');
    const second = await run({ records, clock: tuesday.clock });
    const tuesdaysWord = idAt(second.app, 0);

    await look(second.app, tuesday, 0, SEEN_DWELL_MS);

    expect(tuesdaysWord).not.toBe(mondaysWord);
    expect(archiveOf(records)).toEqual([
      ['2026-10-26', mondaysWord],
      ['2026-10-27', tuesdaysWord],
    ]);
  });

  it('keeps nothing while the Feature Switch `wordOfTheDayArchive` is off, and the Seen write goes through', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app, records } = await run({ clock: time.clock, on: [] });
    const today = idAt(app, 0);

    await look(app, time, 0, SEEN_DWELL_MS);

    expect(archiveOf(records)).toEqual([]);
    expect(records.has(`feed.seen.${today}`)).toBe(true);
  });
});
