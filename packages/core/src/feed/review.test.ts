import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type FeatureSwitch,
  type Feed,
  type FeedCard,
} from '../index';
import { correction, fakeClock, randomOf, word } from '../test-support';

/** Twenty Words of the test Category, one of another Category and one of rarity 1. */
const words: readonly Word[] = [
  ...Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
  word('w_other', { categoryId: 'other' }),
  word('w_common', { rarity: 1 }),
];

const corrections: readonly Correction[] = Array.from({ length: 4 }, (_, index) =>
  correction(`c_${String(index)}`),
);

const dayOne = '2026-10-11T09:00:00+03:00';
const dayTwo = '2026-10-12T09:00:00+03:00';

/** The Core composition of one app run on the day, over the records, so the user state survives between runs. */
async function run({
  records,
  at,
  withCorrections = false,
  on = ['knowledge', 'corrections', 'rarityFilter'],
}: {
  records: Map<string, string>;
  at: string;
  withCorrections?: boolean;
  on?: readonly FeatureSwitch[];
}): Promise<Composition & { advance: (ms: number) => void }> {
  const { clock, advance } = fakeClock(at);
  const app = await openComposition({
    content: createMemoryContentPort({ words, corrections: withCorrections ? corrections : [] }),
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => on.includes(feature),
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: { categoryIds: ['test', 'other'], corrections: true },
        notificationTimes: [],
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: randomOf(0.25),
  });
  return Object.assign(app, { advance });
}

const entryIdOf = (card: FeedCard | undefined) => {
  if (card?.kind === 'word') return card.wordCard.wordId;
  return card?.kind === 'correction' ? card.correctionCard.correctionId : undefined;
};

/** The ids of the Feed's first `count` cards, asking for the next card until there are that many. */
async function firstCards(feed: Feed, count: number): Promise<(string | undefined)[]> {
  while (feed.cards.length < count) {
    if ((await feed.next()) === undefined) break;
  }
  return feed.cards.slice(0, count).map(entryIdOf);
}

/**
 * On day one the reader reads the Feed's first `count` cards, each long
 * enough to be Seen, and marks the Words of the last `unknown` of them
 * «Не знаю». Returns the Words marked, due on day two.
 */
async function markSeenWordsUnknown(
  records: Map<string, string>,
  {
    count,
    unknown,
    withCorrections = false,
  }: { count: number; unknown: number; withCorrections?: boolean },
): Promise<string[]> {
  const app = await run({ records, at: dayOne, withCorrections });
  for (let position = 0; position < count; position += 1) {
    await app.feed.show(position);
    app.advance(1000);
  }
  await app.feed.show(undefined);
  const marked = app.feed.cards
    .slice(0, count)
    .filter((card) => card.kind === 'word')
    .slice(-unknown)
    .map((card) => entryIdOf(card) ?? '');
  for (const id of marked) await app.knowledge.tap(id, 'unknown');
  return marked;
}

/** Marks the Words «Не знаю» on day one, without showing them. */
async function markUnknown(records: Map<string, string>, ids: readonly string[]): Promise<void> {
  const app = await run({ records, at: dayOne });
  for (const id of ids) await app.knowledge.tap(id, 'unknown');
}

// Spec #461, ADR 0043: a Word due for Review comes back in every 3rd slot of the Feed.
describe('Review in the Feed', () => {
  it('puts a due Word in slots 3, 6 and 9, even one Seen in this Cycle, the one shown longest ago first', async () => {
    const records = new Map<string, string>();
    const due = await markSeenWordsUnknown(records, { count: 3, unknown: 2 });

    const ids = await firstCards((await run({ records, at: dayTwo })).feed, 9);

    expect([ids[2], ids[5]].sort()).toEqual([...due].sort());
    expect(ids[8]).toBe(ids[2]);
    const otherSlots = ids.filter((_, index) => ![2, 5, 8].includes(index));
    expect(otherSlots.filter((id) => id !== undefined && due.includes(id))).toEqual([]);
  });

  it('leaves the Feed as before while no Word is due', async () => {
    const records = new Map<string, string>();
    await markSeenWordsUnknown(records, { count: 3, unknown: 0 });
    const unmarked = new Map(records);
    // Marked today, due only tomorrow.
    const marking = await run({ records, at: dayOne });
    await marking.knowledge.tap('w_05', 'unknown');
    await marking.knowledge.tap('w_06', 'unknown');

    const ids = await firstCards((await run({ records, at: dayOne })).feed, 12);

    expect(ids).toEqual(await firstCards((await run({ records: unmarked, at: dayOne })).feed, 12));
  });

  it('leaves the Feed as before with the knowledge Feature Switch off', async () => {
    const records = new Map<string, string>();
    await markSeenWordsUnknown(records, { count: 3, unknown: 0 });
    const unmarked = new Map(records);
    await markUnknown(records, ['w_05', 'w_06']);
    const off: FeatureSwitch[] = ['corrections', 'rarityFilter'];

    const ids = await firstCards((await run({ records, at: dayTwo, on: off })).feed, 12);

    expect(ids).toEqual(
      await firstCards((await run({ records: unmarked, at: dayTwo, on: off })).feed, 12),
    );
  });

  it('keeps a due Word due, slot after slot, until the reader answers it', async () => {
    const records = new Map<string, string>();
    const [due] = await markSeenWordsUnknown(records, { count: 3, unknown: 1 });
    const app = await run({ records, at: dayTwo });

    const before = await firstCards(app.feed, 6);
    expect([before[2], before[5]]).toEqual([due, due]);

    await app.knowledge.tap(due ?? '', 'known');
    const after = await firstCards(app.feed, 12);
    expect(after.slice(6)).not.toContain(due);
  });

  it('skips a Hidden due Word until it is restored', async () => {
    const records = new Map<string, string>();
    const [due] = await markSeenWordsUnknown(records, { count: 3, unknown: 1 });
    const app = await run({ records, at: dayTwo });

    await app.hiddenEntries.hide(due ?? '');
    expect(await firstCards(app.feed, 9)).not.toContain(due);

    await app.hiddenEntries.restore(due ?? '');
    expect((await firstCards(app.feed, 12))[11]).toBe(due);
  });

  it('skips a due Word out of the Mix or under the Rarity Floor until it is eligible again', async () => {
    const records = new Map<string, string>();
    const due = ['w_other', 'w_common'];
    await markUnknown(records, due);
    const app = await run({ records, at: dayTwo });

    await app.mix.takeOut('other');
    await app.mix.setRarityFloor(2);
    const ids = await firstCards(app.feed, 9);
    expect(ids.filter((id) => id !== undefined && due.includes(id))).toEqual([]);

    await app.mix.putBack('other');
    await app.mix.setRarityFloor(1);
    const back = await firstCards(app.feed, 15);
    expect(due).toContain(back[11]);
    expect(due).toContain(back[14]);
  });

  it('keeps every 5th card a Correction, taking the Review slots around it', async () => {
    const records = new Map<string, string>();
    const due = await markSeenWordsUnknown(records, {
      count: 3,
      unknown: 1,
      withCorrections: true,
    });

    const ids = await firstCards(
      (await run({ records, at: dayTwo, withCorrections: true })).feed,
      15,
    );

    expect([ids[4], ids[9], ids[14]].every((id) => id?.startsWith('c_'))).toBe(true);
    expect([ids[2], ids[5], ids[8], ids[11]]).toEqual([due[0], due[0], due[0], due[0]]);
  });
});
