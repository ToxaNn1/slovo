import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type FeatureSwitch,
  type FeedCard,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';

const words: readonly Word[] = Array.from({ length: 12 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

// The week of Monday 19 to Sunday 25 October 2026 in Kyiv, where summer time
// ends on its Sunday, and the opens after it.
const monday = '2026-10-26T09:00:00+02:00';
const mondayEvening = '2026-10-26T21:00:00+02:00';
const tuesday = '2026-10-27T09:00:00+02:00';

const seen = (seenAt: string) => JSON.stringify({ seenAt, wordOfTheDay: false });
const marked = (mark: 'known' | 'unknown', markedAt?: string) =>
  JSON.stringify({
    mark,
    step: null,
    reviewDay: null,
    learned: false,
    ...(markedAt === undefined ? {} : { markedAt }),
  });

/** A week with Active Days, Seen Entries, Favorites and Knowledge Marks in it and around it. */
function fakeWeek(): Map<string, string> {
  return new Map([
    ['activeDays.2026-10-18', 'true'],
    ['activeDays.2026-10-24', 'true'],
    ['activeDays.2026-10-25', 'true'],
    // Seen in the week: its first minute and its last.
    ['history.w_00', seen('2026-10-18T21:00:00.000Z')],
    ['history.w_01', seen('2026-10-25T21:59:00.000Z')],
    ['history.w_02', seen('2026-10-22T10:00:00.000Z')],
    // Seen the minute before the week and the minute after it.
    ['history.w_03', seen('2026-10-18T20:59:00.000Z')],
    ['history.w_04', seen('2026-10-25T22:00:00.000Z')],
    // Added in the week, and the week before.
    ['favorites.w_05', JSON.stringify('2026-10-20T12:00:00.000Z')],
    ['favorites.w_06', JSON.stringify('2026-10-12T12:00:00.000Z')],
    // Known in the week; Known with no time; Unknown in the week; Known after it.
    ['knowledge.w_07', marked('known', '2026-10-21T12:00:00.000Z')],
    ['knowledge.w_08', marked('known')],
    ['knowledge.w_09', marked('unknown', '2026-10-22T12:00:00.000Z')],
    ['knowledge.w_10', marked('known', '2026-10-26T06:00:00.000Z')],
  ]);
}

/** The Core composition of one app run at `at`, over the records, so the user state survives between runs. */
async function run({
  records,
  at,
  off = [],
}: {
  records: Map<string, string>;
  at: string;
  off?: readonly FeatureSwitch[];
}): Promise<Composition> {
  const on: readonly FeatureSwitch[] = ['knowledge', 'weeklyRecap'];
  return openComposition({
    content: createMemoryContentPort({ words }),
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature) && !off.includes(feature),
      userSettingDefaults: {
        mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock(at).clock,
    random: randomOf(0.25),
  });
}

/** The Feed's first three cards. */
async function firstCards(app: Composition): Promise<readonly FeedCard[]> {
  while (app.feed.cards.length < 3) await app.feed.next();
  return app.feed.cards;
}

const recapCards = (cards: readonly FeedCard[]) =>
  cards.filter((card) => card.kind === 'notice' && card.notice === 'weeklyRecap');

// Spec #832, ADR 0054: the Weekly Recap.
describe('the Weekly Recap', () => {
  it('gives the week before Monday: Entries last Seen, Favorites added and Known marks set in it, and the Streak', async () => {
    const app = await run({ records: fakeWeek(), at: monday });

    const cards = await firstCards(app);

    expect(cards[1]).toEqual({
      kind: 'notice',
      notice: 'weeklyRecap',
      day: { year: 2026, month: 10, day: 26 },
    });
    expect(await app.weeklyRecap.of({ year: 2026, month: 10, day: 26 })).toEqual({
      firstDay: { year: 2026, month: 10, day: 19 },
      lastDay: { year: 2026, month: 10, day: 25 },
      seen: 3,
      saved: 1,
      known: 1,
      // Saturday, Sunday and Monday, today's open.
      streak: 3,
    });
  });

  it('comes on Monday only', async () => {
    const records = fakeWeek();
    const app = await run({ records, at: tuesday });

    expect(recapCards(await firstCards(app))).toEqual([]);
    expect(await app.weeklyRecap.of({ year: 2026, month: 10, day: 27 })).toBeUndefined();
  });

  it('comes on the first open of Monday and, swiped past, never again that day', async () => {
    const records = fakeWeek();
    const first = await run({ records, at: monday });
    await firstCards(first);
    // The reader swipes from the first card to the Weekly Recap, then past it.
    await first.feed.show(0);
    await first.feed.show(1);
    await first.feed.show(2);

    const later = await run({ records, at: mondayEvening });

    expect(recapCards(await firstCards(later))).toEqual([]);
  });

  it('is not made for a week without an Active Day', async () => {
    const records = fakeWeek();
    records.delete('activeDays.2026-10-24');
    records.delete('activeDays.2026-10-25');

    const app = await run({ records, at: monday });

    expect(recapCards(await firstCards(app))).toEqual([]);
    expect(await app.weeklyRecap.of({ year: 2026, month: 10, day: 26 })).toBeUndefined();
  });

  it('is absent with its Feature Switch off', async () => {
    const app = await run({ records: fakeWeek(), at: monday, off: ['weeklyRecap'] });

    expect(recapCards(await firstCards(app))).toEqual([]);
    expect(await app.weeklyRecap.of({ year: 2026, month: 10, day: 26 })).toBeUndefined();
  });

  it('leaves the Known marks out with the Knowledge Marks off', async () => {
    const app = await run({ records: fakeWeek(), at: monday, off: ['knowledge'] });

    expect(await app.weeklyRecap.of({ year: 2026, month: 10, day: 26 })).toEqual({
      firstDay: { year: 2026, month: 10, day: 19 },
      lastDay: { year: 2026, month: 10, day: 25 },
      seen: 3,
      saved: 1,
      streak: 3,
    });
  });
});
