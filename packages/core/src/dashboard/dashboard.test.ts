import { describe, expect, it } from 'vitest';

import {
  openComposition,
  type Clock,
  type DashboardBlock,
  type FeatureSwitch,
  type PreviousWordsBlock,
  type WordOfTheDayHero,
} from '../index';
import { dateKeyOf } from '../local-date';
import { createMemoryContentPort } from '../testing';
import { fakeClock, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const content = createMemoryContentPort({
  words: [
    word('w_one'),
    word('w_two'),
    word('w_three'),
    word('w_four'),
    { ...word('w_five'), retired: true },
  ],
});

/** The Core composition of one app run over the records, the Dashboard on unless said otherwise. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock('2026-11-04T09:00:00+02:00').clock,
  on = ['wordOfTheDay', 'wordOfTheDayArchive', 'dashboard'],
}: { records?: Map<string, string>; clock?: Clock; on?: FeatureSwitch[] } = {}) {
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature),
      userSettingDefaults: { mix: { corrections: false } },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
  });
  return { app, records };
}

/** The Word of the Day hero among the blocks. */
function heroOf(blocks: readonly DashboardBlock[]): WordOfTheDayHero {
  const [block] = blocks;
  if (block?.kind !== 'wordOfTheDay') throw new Error('No Word of the Day block');
  return block.hero;
}

/** The Word of the Day archive's records, one Word under each date. */
function archived(days: Record<string, string>): Map<string, string> {
  return new Map(
    Object.entries(days).map(([date, wordId]) => [
      `wordOfTheDayArchive.${date}`,
      JSON.stringify(wordId),
    ]),
  );
}

/** The block «Попередні слова» among the blocks, if there is one. */
function previousWordsOf(blocks: readonly DashboardBlock[]): PreviousWordsBlock | undefined {
  return blocks.find((block): block is PreviousWordsBlock => block.kind === 'previousWords');
}

describe('The Dashboard', () => {
  it("shows today's Word of the Day unrevealed, the Word the Feed opens on", async () => {
    const { app } = await run();

    const blocks = app.dashboard.blocks;

    expect(blocks.map(({ kind }) => kind)).toEqual(['wordOfTheDay']);
    expect(heroOf(blocks)).toMatchObject({
      state: 'unrevealed',
      wordId: app.feed.cards[0]?.entryId,
    });
  });

  it('has no Word of the Day block with `dashboard` off', async () => {
    const { app } = await run({ on: ['wordOfTheDay', 'wordOfTheDayArchive'] });

    expect(app.dashboard.blocks).toEqual([]);
  });

  it('reveals the Lemma with its Stress, part of speech, Rarity and short Definition, and makes the Word Seen and archived', async () => {
    const { app } = await run();
    const wordId = heroOf(app.dashboard.blocks).wordId;
    let told = 0;
    app.dashboard.subscribe(() => (told += 1));

    await app.dashboard.reveal();

    const hero = heroOf(app.dashboard.blocks);
    if (hero.state !== 'revealed') throw new Error('The hero is not revealed');
    const lemma = wordId.slice('w_'.length);
    expect(hero.lemmaWithStress.normalize('NFD').replace(/\u0301/g, '')).toBe(lemma);
    expect(hero.lemmaWithStress).not.toBe(lemma);
    expect(hero.definition).toBe(`The meaning of ${lemma}.`);
    const { partOfSpeech, gender, rarity } = word(wordId);
    expect(hero).toMatchObject({ partOfSpeech, gender, rarity });
    expect(told).toBeGreaterThan(0);
    expect(app.history.list.map(({ entryId }) => entryId)).toEqual([wordId]);
    expect((await app.wordOfTheDayArchive.list()).map(({ row }) => row.entryId)).toEqual([wordId]);
  });

  it('stays revealed after a reopen the same day, and is unrevealed the next day', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    await first.app.dashboard.reveal();
    const revealedId = heroOf(first.app.dashboard.blocks).wordId;

    const later = await run({ records, clock: fakeClock('2026-11-04T21:00:00+02:00').clock });
    expect(heroOf(later.app.dashboard.blocks)).toMatchObject({
      state: 'revealed',
      wordId: revealedId,
    });

    const next = await run({ records, clock: fakeClock('2026-11-05T09:00:00+02:00').clock });
    const hero = heroOf(next.app.dashboard.blocks);
    expect(hero.state).toBe('unrevealed');
    expect(hero.wordId).not.toBe(revealedId);
  });

  it('turns to the next day with the app left open over midnight', async () => {
    const time = fakeClock('2026-11-04T23:59:00+02:00');
    const { app } = await run({ clock: time.clock });
    await app.dashboard.reveal();
    const yesterdays = heroOf(app.dashboard.blocks).wordId;

    time.advance(2 * 60 * 1000);
    await app.resume();

    const hero = heroOf(app.dashboard.blocks);
    expect(hero.state).toBe('unrevealed');
    expect(hero.wordId).not.toBe(yesterdays);
  });

  it("leaves the Feed to choose the next day's Word of the Day, past the cards it showed", async () => {
    const time = fakeClock('2026-11-04T23:58:00+02:00');
    const { app } = await run({ clock: time.clock });
    await app.feed.next();
    const shown = app.feed.cards.map(({ entryId }) => entryId);

    time.advance(5 * 60 * 1000);
    await app.resume();
    const hero = heroOf(app.dashboard.blocks);
    const card = await app.feed.next();

    expect(shown).not.toContain(hero.wordId);
    expect(card?.entryId).toBe(hero.wordId);
  });
});

describe('«Попередні слова» on the Dashboard', () => {
  const on: FeatureSwitch[] = ['wordOfTheDay', 'wordOfTheDayArchive', 'dashboard', 'previousWords'];

  it('shows the three newest archive days before today, newest first, a Retired Word kept', async () => {
    const { app } = await run({
      on,
      records: archived({
        '2026-11-04': 'w_one',
        '2026-11-03': 'w_five',
        '2026-11-01': 'w_two',
        '2026-10-31': 'w_three',
        '2026-10-30': 'w_four',
      }),
    });

    const block = previousWordsOf(app.dashboard.blocks);

    expect(app.dashboard.blocks.map(({ kind }) => kind)).toEqual(['wordOfTheDay', 'previousWords']);
    expect(block?.days.map(({ date, row }) => [dateKeyOf(date), row.entryId])).toEqual([
      ['2026-11-03', 'w_five'],
      ['2026-11-01', 'w_two'],
      ['2026-10-31', 'w_three'],
    ]);
    expect(block?.days[0]?.dateLabel).toBe('November 3');
  });

  it('shows the one archive day there is', async () => {
    const { app } = await run({ on, records: archived({ '2026-11-02': 'w_two' }) });

    expect(previousWordsOf(app.dashboard.blocks)?.days.map(({ row }) => row.entryId)).toEqual([
      'w_two',
    ]);
  });

  it('has no block without an archive day before today', async () => {
    const { app } = await run({ on });
    await app.dashboard.reveal();

    expect(app.dashboard.blocks.map(({ kind }) => kind)).toEqual(['wordOfTheDay']);
  });

  it('shows yesterday once the day turns', async () => {
    const time = fakeClock('2026-11-04T23:59:00+02:00');
    const { app } = await run({ on, clock: time.clock });
    await app.dashboard.reveal();
    const yesterdays = heroOf(app.dashboard.blocks).wordId;

    time.advance(2 * 60 * 1000);
    await app.resume();

    expect(previousWordsOf(app.dashboard.blocks)?.days.map(({ row }) => row.entryId)).toEqual([
      yesterdays,
    ]);
  });

  it('opens a previous Word without making anything Seen', async () => {
    const { app, records } = await run({ on, records: archived({ '2026-11-02': 'w_two' }) });
    const before = new Map(records);
    const [day] = previousWordsOf(app.dashboard.blocks)?.days ?? [];
    if (day === undefined) throw new Error('No previous Word');

    const card = await app.openedFromSearch(day.row.entryId);

    expect(card?.entryId).toBe('w_two');
    expect(app.history.list).toEqual([]);
    expect(heroOf(app.dashboard.blocks).state).toBe('unrevealed');
    expect(records).toEqual(before);
  });

  it('has no block with `previousWords` off', async () => {
    const { app } = await run({ records: archived({ '2026-11-02': 'w_two' }) });

    expect(previousWordsOf(app.dashboard.blocks)).toBeUndefined();
  });
});

describe('The Categories rail on the Dashboard', () => {
  const categoriesOf = (blocks: readonly DashboardBlock[]) =>
    blocks.find((block) => block.kind === 'categories');

  it('lists the Categories of Words of the Language Pack in its order', async () => {
    const { app } = await run({ on: ['dashboard', 'categoryScreens'] });
    const categories = await content.listCategories();

    expect(categories.length).toBeGreaterThan(0);
    expect(categoriesOf(app.dashboard.blocks)).toEqual({ kind: 'categories', categories });
  });

  it('has no block with `categoryScreens` off', async () => {
    const { app } = await run();

    expect(categoriesOf(app.dashboard.blocks)).toBeUndefined();
  });
});
