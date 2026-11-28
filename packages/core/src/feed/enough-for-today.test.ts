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
        mix: { kinds: { correction: false, idiom: false, synonymRow: false, tip: false } },
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
  it('comes one card after the 50th distinct Entry Seen today, the Word of the Day included', async () => {
    const app = await run({ at: dayOne });

    // 50 cards on screen, the Word of the Day first: 49 Seen, the 50th on screen.
    expect(await readOn(app, 0, 50)).toBeUndefined();
    const cards = app.feed.cards;
    expect(cards[0]?.kind === 'word' && cards[0].wordOfTheDay !== undefined).toBe(true);

    // Leaving the 50th makes it Seen: the card after the one now on screen is the Feed Notice.
    await app.feed.show(50);
    expect(app.feed.cards.findIndex(isEnough)).toBe(51);
  });

  it('never counts an Entry swiped away before it is Seen', async () => {
    const app = await run({ at: dayOne });
    expect(await readOn(app, 0, 49)).toBeUndefined();

    // The 50th swiped away after 100 ms: still 49 Seen.
    await app.feed.show(49);
    app.advance(100);
    await app.feed.show(50);
    expect(app.feed.cards.findIndex(isEnough)).toBe(-1);

    // The next one read and left is the 50th Seen.
    app.advance(1000);
    await app.feed.show(51);
    expect(app.feed.cards.findIndex(isEnough)).toBe(52);
  });

  it('counts an Entry Seen again today once', async () => {
    const app = await run({ at: dayOne });
    expect(await readOn(app, 0, 49)).toBeUndefined();

    // Back over Seen cards, each long on screen, and one opened from a notification.
    expect(await readOn(app, 0, 8)).toBeUndefined();
    const seen = app.feed.cards[3]?.entryId;
    expect(seen).toBeDefined();
    await app.openedFromNotification(seen ?? '');
    expect(await readOn(app, 48, 2)).toBeUndefined();

    // The 50th distinct one, left, brings it one card after it.
    await app.feed.show(50);
    expect(app.feed.cards.findIndex(isEnough)).toBe(51);
  });

  it('never locks the Feed: the cards go on after it, and it is gone for the day once turned past', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, at: dayOne });
    expect(await readOn(app, 0, 51)).toBe(51);

    // Turning past it shows Entries again, and it does not come twice that day.
    expect(await readOn(app, 51, 10)).toBe(51);
    expect(app.feed.cards.filter(isEnough)).toHaveLength(1);
    const after = app.feed.cards.slice(52, 61);
    expect(after).toHaveLength(9);
    expect(after.every((card) => card.kind === 'word')).toBe(true);

    const later = await run({ records: new Map(records), at: '2026-10-11T20:00:00+03:00' });
    expect(await readOn(later, 0, 15)).toBeUndefined();

    const tomorrow = await run({ records: new Map(records), at: dayTwo });
    expect(await readOn(tomorrow, 0, 50)).toBeUndefined();
    expect(await readOn(tomorrow, 50, 1)).toBe(51);
  });

  it('comes after «Ціль дня виконано!» when both are due on the same card', async () => {
    const app = await run({
      at: dayOne,
      switches: ['enoughForToday', 'xpLog', 'dailyGoal', 'seenWordXp', 'goalReachedCard'],
    });
    await app.xpLog.setDailyGoal(50);

    // Leaving the 50th Word meets the goal and the limit: one card after it «Ціль дня виконано!»
    // comes first, in the order of the Feed Notices, and «Може, на сьогодні досить?» right after.
    expect(await readOn(app, 0, 51)).toBe(52);
    const kinds = app.feed.cards.map((card) => (card.kind === 'notice' ? card.notice : card.kind));
    expect(kinds.slice(49, 53)).toEqual(['word', 'word', 'goalReached', 'enoughForToday']);
  });

  it('never comes while its Feature Switch is off', async () => {
    const off = await run({ at: dayOne, switches: [] });
    expect(await readOn(off, 0, 60)).toBeUndefined();
  });
});
