import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import { openComposition, type Composition, type Feed, type FeedCard } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const words: readonly Word[] = Array.from({ length: 20 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

/** 09:00 in Kyiv on the local day `date` (`YYYY-MM-DD`). */
const morningOf = (date: string) => `${date}T09:00:00+03:00`;

/** The Core composition of one app run on the day, over the records, so the user state survives between runs. */
async function run({
  records,
  on,
  firstWeek = true,
}: {
  records: Map<string, string>;
  on: string;
  firstWeek?: boolean;
}): Promise<Composition & { advance: (ms: number) => void }> {
  const { clock, advance } = fakeClock(morningOf(on));
  const app = await openComposition({
    content: createMemoryContentPort({ words }),
    edition: testEdition({
      isFeatureEnabled: (feature) => feature === 'firstWeek' && firstWeek,
      userSettingDefaults: {
        mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: randomOf(0.25),
  });
  return Object.assign(app, { advance });
}

/** The Feed's first `count` cards, asking for the next card until there are that many. */
async function firstCards(feed: Feed, count: number): Promise<readonly FeedCard[]> {
  while (feed.cards.length < count) {
    if ((await feed.next()) === undefined) break;
  }
  return feed.cards.slice(0, count);
}

/** The day of the first week the Feed's first cards show a first-week card of, if any. */
async function firstWeekDayOn(records: Map<string, string>, on: string, firstWeek = true) {
  const cards = await firstCards((await run({ records, on, firstWeek })).feed, 4);
  return cards.flatMap((card) =>
    card.kind === 'notice' && card.notice === 'firstWeek' ? [card.firstWeekDay] : [],
  )[0];
}

/** Records of a reader who finishes the onboarding on the local day `on`. */
async function newReader(on: string): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  const app = await run({ records, on });
  await app.onboarding.finish();
  return records;
}

// Spec #832, ADR 0054: one intro card a day on the first 7 Active Days after onboarding.
describe('The first week', () => {
  it('gives a new reader the card of day 1 on the second card of the day they finish the onboarding', async () => {
    const records = await newReader('2026-11-02');

    const cards = await firstCards((await run({ records, on: '2026-11-02' })).feed, 3);

    expect(cards[0]?.kind).toBe('word');
    expect(cards[1]).toMatchObject({ kind: 'notice', notice: 'firstWeek', firstWeekDay: 1 });
    expect(cards[2]?.kind).toBe('word');
  });

  it('counts its days in Active Days, so a missed calendar day eats no card', async () => {
    const records = await newReader('2026-11-02');

    // Opened on the 2nd, the 3rd and the 7th, then on the 8th to the 11th.
    const days = [];
    for (const on of ['03', '07', '08', '09', '10', '11', '12', '13']) {
      days.push(await firstWeekDayOn(records, `2026-11-${on}`));
    }

    expect(days).toEqual([2, 3, 4, 5, 6, 7, undefined, undefined]);
  });

  it('never brings a closed card back, though the reader opens the app again that day', async () => {
    const records = await newReader('2026-11-02');
    const app = await run({ records, on: '2026-11-02' });
    await firstCards(app.feed, 3);

    await app.feed.show(0);
    await app.feed.show(1);
    app.advance(1000);
    await app.feed.show(2);

    expect(await firstWeekDayOn(records, '2026-11-02')).toBeUndefined();
    expect(await firstWeekDayOn(records, '2026-11-03')).toBe(2);
  });

  it('gives an existing reader, who finished the onboarding before it, no card', async () => {
    const records = new Map<string, string>();
    await run({ records, on: '2026-10-20' });
    records.set('onboarding.finished', JSON.stringify(new Date(morningOf('2026-10-20'))));

    expect(await firstWeekDayOn(records, '2026-10-20')).toBeUndefined();
    expect(await firstWeekDayOn(records, '2026-10-21')).toBeUndefined();
  });

  it('gives no card while its Feature Switch is off, and goes on by Active Days once it is on', async () => {
    const records = await newReader('2026-11-02');

    expect(await firstWeekDayOn(records, '2026-11-02', false)).toBeUndefined();
    expect(await firstWeekDayOn(records, '2026-11-03', false)).toBeUndefined();
    expect(await firstWeekDayOn(records, '2026-11-04')).toBe(3);
  });
});
