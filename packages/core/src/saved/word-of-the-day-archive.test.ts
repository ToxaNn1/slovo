import { describe, expect, it } from 'vitest';

import {
  openComposition,
  type Clock,
  type Composition,
  type FeatureSwitch,
  type LocalDate,
  type UserStatePort,
} from '../index';
import { SEEN_DWELL_MS } from '../feed/feed';
import { type UserStateChanges } from '../ports';
import { openWordOfTheDayArchive } from './word-of-the-day-archive';
import { createMemoryContentPort } from '../testing';
import { fakeClock, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
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
  /** A record kept behind the composition's back, as nothing in one app run does. */
  const keepUnseen = (date: string, wordId: string) =>
    memory.write(new Map([[`wordOfTheDayArchive.${date}`, JSON.stringify(wordId)]]));
  const app: Composition = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature),
      userSettingDefaults: { mix: { kinds: { correction: false } } },
    }),
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
  return { app, records, writes, keepUnseen };
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

  it('opens, leaving out a kept record whose id is no date', async () => {
    const records = new Map([['wordOfTheDayArchive.oops', JSON.stringify('w_one')]]);
    const { app } = await run({ records });

    expect(app.wordOfTheDayArchive.list).toEqual([]);
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

/** The archive list of the UA Edition over the kept records, its Feature Switch on. */
async function listOf(records: Map<string, string>) {
  const { archive } = await openWordOfTheDayArchive({
    content: createMemoryContentPort({
      words: [
        word('w_sumyrnyi', { lemma: 'сумирний', stress: [3] }),
        word('w_lahidnyi', { lemma: 'лагідний', stress: [3] }),
        word('w_oldword', { lemma: 'стародавній', stress: [6], retired: true }),
      ],
    }),
    edition: { locale: 'uk-UA', isFeatureEnabled: () => true },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock('2026-10-27T09:00:00+02:00').clock,
    dayTurned: { subscribe: () => undefined },
  });
  return archive.list.map(({ date, dateLabel, row }) => [
    keyOf(date),
    dateLabel,
    row.entryId,
    row.title,
  ]);
}

/** A local date as its `YYYY-MM-DD` key. */
const keyOf = ({ year, month, day }: LocalDate) =>
  [year, month, day].map((part) => String(part).padStart(2, '0')).join('-');

/** The records of an archive kept on each date, by Word id. */
const kept = (days: Record<string, string>) =>
  new Map(
    Object.entries(days).map(([date, wordId]) => [
      `wordOfTheDayArchive.${date}`,
      JSON.stringify(wordId),
    ]),
  );

describe('The Word of the Day archive list', () => {
  it("lists each kept date newest first, with the date in the Edition's locale and the Lemma", async () => {
    const list = await listOf(
      kept({
        '2026-10-25': 'w_lahidnyi',
        '2026-10-27': 'w_sumyrnyi',
        '2026-09-30': 'w_lahidnyi',
      }),
    );

    expect(list).toEqual([
      ['2026-10-27', '27 жовтня', 'w_sumyrnyi', 'суми\u0301рний'],
      ['2026-10-25', '25 жовтня', 'w_lahidnyi', 'лагі\u0301дний'],
      ['2026-09-30', '30 вересня', 'w_lahidnyi', 'лагі\u0301дний'],
    ]);
  });

  it('gives the year only to a date of a past year', async () => {
    const list = await listOf(
      kept({ '2026-01-02': 'w_sumyrnyi', '2025-12-31': 'w_lahidnyi', '2025-10-26': 'w_sumyrnyi' }),
    );

    expect(list.map(([dateKey, dateLabel]) => [dateKey, dateLabel])).toEqual([
      ['2026-01-02', '2 січня'],
      ['2025-12-31', '31 грудня 2025'],
      ['2025-10-26', '26 жовтня 2025'],
    ]);
  });

  it('keeps a Retired Word in its place', async () => {
    const list = await listOf(
      kept({ '2026-10-26': 'w_oldword', '2026-10-27': 'w_sumyrnyi', '2026-10-25': 'w_lahidnyi' }),
    );

    expect(list.map(([dateKey, , entryId]) => [dateKey, entryId])).toEqual([
      ['2026-10-27', 'w_sumyrnyi'],
      ['2026-10-26', 'w_oldword'],
      ['2026-10-25', 'w_lahidnyi'],
    ]);
  });

  it('leaves out a Word the Language Pack no longer has', async () => {
    const list = await listOf(kept({ '2026-10-26': 'w_gone', '2026-10-27': 'w_sumyrnyi' }));

    expect(list.map(([dateKey]) => dateKey)).toEqual(['2026-10-27']);
  });

  it('is empty while nothing is kept', async () => {
    expect(await listOf(new Map())).toEqual([]);
  });

  it('lists through the composition the day the Feed keeps once the card is Seen', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app } = await run({ clock: time.clock });
    const today = idAt(app, 0);
    expect(app.wordOfTheDayArchive.list).toEqual([]);

    await look(app, time, 0, SEEN_DWELL_MS);

    const { list } = app.wordOfTheDayArchive;
    expect(list.map(({ date, row }) => [keyOf(date), row.entryId])).toEqual([
      ['2026-10-26', today],
    ]);
  });

  it('tells its subscribers once the Feed keeps a day, with a new list that has it', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app } = await run({ clock: time.clock });
    const today = idAt(app, 0);
    const before = app.wordOfTheDayArchive.list;
    const told: string[][] = [];
    app.wordOfTheDayArchive.subscribe(() => {
      told.push(app.wordOfTheDayArchive.list.map(({ row }) => row.entryId));
    });

    await look(app, time, 0, SEEN_DWELL_MS);

    expect(told).toEqual([[today]]);
    expect(before).toEqual([]);
  });

  it('tells a subscriber no more once it stops', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app } = await run({ clock: time.clock });
    let told = 0;
    const stop = app.wordOfTheDayArchive.subscribe(() => {
      told += 1;
    });
    stop();

    await look(app, time, 0, SEEN_DWELL_MS);

    expect(told).toBe(0);
  });

  it('gives the day kept under a date, the one in the list, and nothing for a date not kept', async () => {
    const { app } = await run({
      records: kept({ '2026-10-25': 'w_one', '2026-10-24': 'w_gone' }),
    });
    const { list } = app.wordOfTheDayArchive;

    expect(list).toHaveLength(1);
    expect(app.wordOfTheDayArchive.day('2026-10-25')).toBe(list[0]);
    expect(app.wordOfTheDayArchive.day('2026-10-24')).toBeUndefined();
    expect(app.wordOfTheDayArchive.day('2026-10-26')).toBeUndefined();
  });

  it('keeps one list, read when it opens, while a card that is not the Word of the Day is Seen', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app, keepUnseen } = await run({ clock: time.clock });
    const { list } = app.wordOfTheDayArchive;
    let told = 0;
    app.wordOfTheDayArchive.subscribe(() => {
      told += 1;
    });
    await keepUnseen('2026-10-20', 'w_one');

    await look(app, time, 1, SEEN_DWELL_MS);
    await app.resume();

    expect(app.wordOfTheDayArchive.list).toBe(list);
    expect(told).toBe(0);
  });

  it('keeps its list and tells nothing when a day turns within the year', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app } = await run({ clock: time.clock, records: kept({ '2026-10-25': 'w_one' }) });
    const { list } = app.wordOfTheDayArchive;
    let told = 0;
    app.wordOfTheDayArchive.subscribe(() => {
      told += 1;
    });

    time.advance(24 * 60 * 60 * 1000);
    await app.resume();

    expect(app.wordOfTheDayArchive.list).toBe(list);
    expect(told).toBe(0);
  });

  it('gives the dates of the year before their year once the first day of a year comes', async () => {
    const time = fakeClock('2026-12-31T09:00:00+02:00');
    const { app } = await run({
      clock: time.clock,
      records: kept({ '2026-12-30': 'w_one' }),
    });
    const labels = () => app.wordOfTheDayArchive.list.map(({ dateLabel }) => dateLabel);
    let told = 0;
    app.wordOfTheDayArchive.subscribe(() => {
      told += 1;
    });
    expect(labels()).toEqual(['December 30']);

    time.advance(24 * 60 * 60 * 1000);
    await app.resume();

    expect(labels()).toEqual(['December 30, 2026']);
    expect(told).toBe(1);
  });

  it('tells nothing while the Feature Switch `wordOfTheDayArchive` is off', async () => {
    const time = fakeClock('2026-10-26T09:00:00+03:00');
    const { app } = await run({ clock: time.clock, on: [] });
    let told = 0;
    app.wordOfTheDayArchive.subscribe(() => {
      told += 1;
    });

    await look(app, time, 0, SEEN_DWELL_MS);

    expect(told).toBe(0);
    expect(app.wordOfTheDayArchive.list).toEqual([]);
  });
});
