import { describe, expect, it } from 'vitest';

import type { FeatureSwitch, Word } from '@slovo/contracts';

import { openComposition, type Composition, type FeedCard } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const words: readonly Word[] = Array.from({ length: 160 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

const dayOne = '2026-10-11T09:00:00+03:00';
const dayTwo = '2026-10-12T09:00:00+03:00';

/** The Core composition of one app run on the day, over the records, so the user state survives between runs. */
async function run({
  records = new Map(),
  at,
  switches = ['enoughForToday'],
}: {
  records?: Map<string, string>;
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

const isEnough = (card: FeedCard | undefined) =>
  card?.kind === 'notice' && card.notice === 'enoughForToday';

/**
 * Shows the cards from `from` on, each long enough to be Seen, until `count`
 * cards were on screen, and returns where «Може, на сьогодні досить?» is, if it came.
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
  const at = app.feed.cards.findIndex(isEnough);
  return at === -1 ? undefined : at;
}

// Spec #1358, ticket #1369, ADR 0066: «Може, на сьогодні досить?» after 50 distinct Entries Seen on the local day.
describe('«Може, на сьогодні досить?»', () => {
  it('comes as the card after the 50th distinct Entry Seen today, the Word of the Day included', async () => {
    const app = await run({ at: dayOne });

    // 49 cards on screen, the Word of the Day first: 48 Seen, the 49th on screen.
    expect(await readOn(app, 0, 49)).toBeUndefined();
    const cards = app.feed.cards;
    expect(cards[0]?.kind === 'word' && cards[0].wordOfTheDay !== undefined).toBe(true);

    // The 50th on screen: the card after it is the Feed Notice.
    await app.feed.show(49);
    expect(app.feed.cards.findIndex(isEnough)).toBe(50);
  });

  it('counts an Entry Seen again today once', async () => {
    const app = await run({ at: dayOne });
    expect(await readOn(app, 0, 49)).toBeUndefined();

    // Back over Seen cards, each long on screen, and one opened from a notification.
    expect(await readOn(app, 0, 8)).toBeUndefined();
    const seen = app.feed.cards[3]?.entryId;
    expect(seen).toBeDefined();
    await app.openedFromNotification(seen ?? '');
    expect(await readOn(app, 48, 1)).toBeUndefined();

    // The 50th distinct one brings it as the card after it.
    await app.feed.show(49);
    expect(app.feed.cards.findIndex(isEnough)).toBe(50);
  });

  it('never locks the Feed: the cards go on after it, and it is gone for the day once turned past', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, at: dayOne });
    expect(await readOn(app, 0, 50)).toBe(50);

    // Turning past it shows Entries again, and it does not come twice that day.
    expect(await readOn(app, 50, 10)).toBe(50);
    expect(app.feed.cards.filter(isEnough)).toHaveLength(1);
    expect(app.feed.cards.slice(51, 60).every((card) => card.kind !== 'notice')).toBe(true);

    const later = await run({ records: new Map(records), at: '2026-10-11T20:00:00+03:00' });
    expect(await readOn(later, 0, 15)).toBeUndefined();

    const tomorrow = await run({ records: new Map(records), at: dayTwo });
    expect(await readOn(tomorrow, 0, 49)).toBeUndefined();
    expect(await readOn(tomorrow, 49, 1)).toBe(50);
  });

  it('never comes while its Feature Switch is off', async () => {
    const off = await run({ at: dayOne, switches: [] });
    expect(await readOn(off, 0, 60)).toBeUndefined();
  });
});
