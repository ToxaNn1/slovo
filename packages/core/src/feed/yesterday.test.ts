import { describe, expect, it } from 'vitest';

import type { FeatureSwitch, Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Composition,
  type Feed,
  type FeedCard,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, word } from '../test-support';

const words: readonly Word[] = Array.from({ length: 20 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

const everySwitch: readonly FeatureSwitch[] = ['yesterday', 'wordOfTheDayArchive', 'knowledge'];

/** 09:00 in Kyiv on the local day `date` (`YYYY-MM-DD`). */
const morningOf = (date: string) => `${date}T09:00:00+03:00`;

/** The Core composition of one app run on the day, over the records, so the user state survives between runs. */
async function run({
  records,
  on,
  content = words,
  switches = everySwitch,
}: {
  records: Map<string, string>;
  on: string;
  content?: readonly Word[];
  switches?: readonly FeatureSwitch[];
}): Promise<Composition & { advance: (ms: number) => void }> {
  const { clock, advance } = fakeClock(morningOf(on));
  const app = await openComposition({
    content: createMemoryContentPort({ words: content }),
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => switches.includes(feature),
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: {
          categoryIds: ['test'],
          correctionCategoryIds: 'all' as const,
          corrections: false,
          idioms: false,
          synonymRows: false,
          tips: false,
        },
        notificationTimes: [],
      },
    },
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

/** The Yesterday notice among the Feed's first cards on the day, if any. */
async function yesterdayOf(app: Composition) {
  const cards = await firstCards(app.feed, 4);
  return cards.find((card) => card.kind === 'notice' && card.notice === 'yesterday');
}

/** Records where the reader Saw the Word of the Day of `on`; with its id. */
async function sawWordOfTheDay(on: string, records = new Map<string, string>()) {
  const app = await run({ records, on });
  const wordId = app.feed.cards[0]?.entryId;
  if (wordId === undefined) throw new Error('No Word of the Day');
  await app.feed.show(0);
  app.advance(SEEN_DWELL_MS);
  await app.feed.show(undefined);
  return { records, wordId };
}

// Spec #832, ADR 0054: «Пам'ятаєте вчорашнє слово?» shows yesterday's Word of the Day.
describe('Yesterday', () => {
  it("shows yesterday's Word of the Day on the second card, as a Word card", async () => {
    const { records, wordId } = await sawWordOfTheDay('2026-10-26');

    const cards = await firstCards((await run({ records, on: '2026-10-27' })).feed, 3);

    expect(cards[0]?.kind).toBe('word');
    expect(cards[0]?.entryId).not.toBe(wordId);
    expect(cards[1]).toMatchObject({
      kind: 'notice',
      notice: 'yesterday',
      day: { year: 2026, month: 10, day: 27 },
      word: { kind: 'word', wordId },
    });
    expect(cards[2]?.kind).toBe('word');
  });

  it('shows nothing when the archive has no Word of yesterday', async () => {
    const { records } = await sawWordOfTheDay('2026-10-25');

    expect(await yesterdayOf(await run({ records, on: '2026-10-27' }))).toBeUndefined();
  });

  it('shows nothing when the reader never Saw yesterday’s Word of the Day', async () => {
    const records = new Map<string, string>();
    await firstCards((await run({ records, on: '2026-10-26' })).feed, 1);

    expect(await yesterdayOf(await run({ records, on: '2026-10-27' }))).toBeUndefined();
  });

  it('shows nothing when that Word is Hidden since', async () => {
    const { records, wordId } = await sawWordOfTheDay('2026-10-26');
    const app = await run({ records, on: '2026-10-27' });

    await app.hide({ kind: 'entry', entryId: wordId });

    expect(await yesterdayOf(app)).toBeUndefined();
  });

  it('shows nothing when that Word is Retired since', async () => {
    const { records, wordId } = await sawWordOfTheDay('2026-10-26');
    const retired = words.map((each) => (each.id === wordId ? { ...each, retired: true } : each));

    expect(await yesterdayOf(await run({ records, on: '2026-10-27', content: retired }))).toBe(
      undefined,
    );
  });

  it('shows nothing while either its Feature Switch or the archive’s is off', async () => {
    const { records } = await sawWordOfTheDay('2026-10-26');

    for (const switches of [['wordOfTheDayArchive'], ['yesterday']] as const) {
      expect(await yesterdayOf(await run({ records, on: '2026-10-27', switches }))).toBe(undefined);
    }
  });

  it('comes once a day: swiped past, it is gone for the day', async () => {
    const { records } = await sawWordOfTheDay('2026-10-26');
    const app = await run({ records, on: '2026-10-27' });
    expect(await yesterdayOf(app)).toBeDefined();

    await app.feed.show(0);
    await app.feed.show(1);
    app.advance(1000);
    await app.feed.show(2);

    expect(await yesterdayOf(await run({ records, on: '2026-10-27' }))).toBeUndefined();
  });

  it('takes Knowledge Marks as on any card: «Не знаю» starts a Review of the Word', async () => {
    const { records, wordId } = await sawWordOfTheDay('2026-10-26');
    const app = await run({ records, on: '2026-10-27' });
    const notice = await yesterdayOf(app);
    if (notice === undefined) throw new Error('No Yesterday');

    await app.knowledge.tap(notice.word.wordId, 'unknown');

    expect(app.knowledge.state.shown.get(wordId)).toBe('unknown');
    expect(app.knowledge.state.learning).toMatchObject([{ entryId: wordId, daysUntilReview: 1 }]);
  });
});
