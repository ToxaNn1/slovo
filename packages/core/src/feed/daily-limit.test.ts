import { describe, expect, it } from 'vitest';

import type { DailyLimit, FeatureSwitch, Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  createSettings,
  openComposition,
  openUserState,
  type Composition,
  type FeedCard,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';

const words: readonly Word[] = Array.from({ length: 40 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

const dayOne = '2026-10-11T09:00:00+03:00';
const dayTwo = '2026-10-12T09:00:00+03:00';

/** The Core composition of one app run on the day, over the records, so the user state survives between runs. */
async function run({
  records,
  at,
  switches = ['dailyLimit'],
}: {
  records: Map<string, string>;
  at: string;
  switches?: readonly FeatureSwitch[];
}): Promise<Composition & { advance: (ms: number) => void }> {
  const { clock, advance } = fakeClock(at);
  const app = await openComposition({
    content: createMemoryContentPort({ words }),
    edition: testEdition({
      isFeatureEnabled: (feature) => switches.includes(feature),
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

/** Records where the reader set the Daily Limit in Settings. */
async function withLimit(dailyLimit: DailyLimit): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  await createSettings({
    userState,
    defaults: { theme: 'system', fontSize: 'M', vibration: true, dailyLimit: 'off' },
  }).update({ dailyLimit });
  return records;
}

const isDailyLimit = (card: FeedCard | undefined) =>
  card?.kind === 'notice' && card.notice === 'dailyLimit';

/**
 * Shows the cards from `from` on, each long enough to be Seen, until `count`
 * cards were on screen, and returns where the Daily Limit card is, if it came.
 */
async function readOn(
  app: Composition & { advance: (ms: number) => void },
  from: number,
  count: number,
): Promise<number | undefined> {
  for (let position = from; position < from + count; position += 1) {
    await app.feed.show(position);
    app.advance(1000);
  }
  const at = app.feed.cards.findIndex(isDailyLimit);
  return at === -1 ? undefined : at;
}

// Spec #832, ADR 0054: the Daily Limit counts distinct Entries Seen on the local day.
describe('The Daily Limit', () => {
  it('comes as the card after the 10th distinct Entry Seen today, the Word of the Day included', async () => {
    const app = await run({ records: await withLimit(10), at: dayOne });

    // Nine cards Seen, the Word of the Day first: the tenth is on screen, Seen once it leaves.
    expect(await readOn(app, 0, 10)).toBeUndefined();
    const cards = app.feed.cards;
    expect(cards[0]?.kind === 'word' && cards[0].wordOfTheDay !== undefined).toBe(true);

    await app.feed.show(10);
    expect(app.feed.cards.findIndex(isDailyLimit)).toBe(11);
  });

  it('counts an Entry Seen again today once', async () => {
    const app = await run({ records: await withLimit(10), at: dayOne });
    expect(await readOn(app, 0, 9)).toBeUndefined();

    // Back over the Seen cards, each long on screen, and one opened from a notification.
    expect(await readOn(app, 0, 8)).toBeUndefined();
    const seen = app.feed.cards[3]?.entryId;
    expect(seen).toBeDefined();
    await app.openedFromNotification(seen ?? '');
    // Nine distinct Entries Seen, the tenth on screen.
    expect(await readOn(app, 8, 2)).toBeUndefined();

    // The tenth distinct one brings it.
    await app.feed.show(10);
    expect(app.feed.cards.findIndex(isDailyLimit)).toBe(11);
  });

  it('is gone until tomorrow once the reader turns past it, and comes again the next day', async () => {
    const records = await withLimit(10);
    const app = await run({ records, at: dayOne });
    const at = await readOn(app, 0, 11);
    expect(at).toBe(11);

    // «Гортати далі» turns to the next card, like a swipe.
    expect(await readOn(app, 11, 10)).toBe(11);
    expect(app.feed.cards.filter(isDailyLimit)).toHaveLength(1);

    const later = await run({ records: new Map(records), at: '2026-10-11T20:00:00+03:00' });
    expect(await readOn(later, 0, 15)).toBeUndefined();

    const tomorrow = await run({ records: new Map(records), at: dayTwo });
    expect(await readOn(tomorrow, 0, 9)).toBeUndefined();
    expect(await readOn(tomorrow, 9, 2)).toBe(11);
  });

  it('never comes while it is off, or while its Feature Switch is', async () => {
    const off = await run({ records: await withLimit('off'), at: dayOne });
    expect(await readOn(off, 0, 35)).toBeUndefined();

    const switchedOff = await run({ records: await withLimit(10), at: dayOne, switches: [] });
    expect(await readOn(switchedOff, 0, 35)).toBeUndefined();
  });

  it('follows the Edition default until the reader chooses', async () => {
    const { clock, advance } = fakeClock(dayOne);
    const app = await openComposition({
      content: createMemoryContentPort({ words }),
      edition: testEdition({
        isFeatureEnabled: (feature) => feature === 'dailyLimit',
        userSettingDefaults: {
          mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
          dailyLimit: 20,
        },
      }),
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock,
      random: randomOf(0.25),
    });
    expect(await readOn(Object.assign(app, { advance }), 0, 21)).toBe(21);
  });
});
