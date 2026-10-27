import { describe, expect, it } from 'vitest';

import type { SynonymRow, Tip, Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type Feed,
  type FeedCard,
  type FeedNotice,
  type FeedNoticeContent,
  type FeedNotices,
  type WordCardModel,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { correction, fakeClock, idiom, randomOf, word } from '../test-support';

const words: readonly Word[] = Array.from({ length: 30 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

/** The card Yesterday shows: that of a Word, as the Feed Notices of these tests need no more. */
const yesterdaysWord: WordCardModel = {
  kind: 'word',
  wordId: 'w_00',
  lemma: '00',
  stressedVowels: [],
  partOfSpeech: 'noun',
  gender: undefined,
  primaryDefinition: 'The meaning of 00.',
  example: undefined,
  synonyms: [],
  antonyms: [],
  registers: [],
  region: undefined,
  history: undefined,
  categoryId: 'test',
  categoryName: undefined,
  details: undefined,
  linkedCorrections: [],
  synonymRow: undefined,
};

const synonymRows: readonly SynonymRow[] = Array.from({ length: 3 }, (_, index) => ({
  kind: 'synonymRow',
  id: `r_${String(index)}`,
  dominant: { text: 'іти', stress: [2] },
  meaning: 'Рухатися пішки.',
  members: [
    { text: 'простувати', stress: [6] },
    { text: 'чимчикувати', stress: [6] },
  ],
  sources: [{ title: 'Test source' }],
  retired: false,
}));

const tips: readonly Tip[] = Array.from({ length: 3 }, (_, index) => ({
  kind: 'tip',
  id: `t_${String(index)}`,
  title: 'Котра година?',
  nonStandardForm: 'Скільки час?',
  standardForm: 'Котра година?',
  explanation: 'Про час питають «котра година».',
  sources: [{ title: 'Test source' }],
  gameQuestion: {
    prompt: 'Як запитати про час?',
    rightAnswer: 'Котра година?',
    wrongAnswers: ['Скільки час?', 'Скільки годин?', 'Який час?'],
  },
  retired: false,
}));

const dayOne = '2026-10-11T09:00:00+03:00';
const dayTwo = '2026-10-12T09:00:00+03:00';

/** A fake that gives the same Feed Notices every day, as the features that make them will. */
const fakeNotices = (notices: readonly FeedNotice[]): FeedNotices => ({
  forDay: () => Promise.resolve(notices.map(contentOf)),
});

/** What the Feed Notice shows; a first-week card, that of day 1; Yesterday, the card of `w_00`. */
const contentOf = (notice: FeedNotice): FeedNoticeContent => {
  if (notice === 'firstWeek') return { notice, firstWeekDay: 1 };
  if (notice === 'yesterday') return { notice, word: yesterdaysWord };
  return { notice };
};

/** The Core composition of one app run on the day, over the records, so the user state survives between runs. */
async function run({
  records,
  at,
  feedNotices,
}: {
  records: Map<string, string>;
  at: string;
  feedNotices?: FeedNotices;
}): Promise<Composition & { advance: (ms: number) => void }> {
  const { clock, advance } = fakeClock(at);
  const app = await openComposition({
    content: createMemoryContentPort({
      words,
      corrections: [0, 1, 2].map((index) => correction(`c_${String(index)}`)),
      idioms: [0, 1, 2].map((index) => idiom(`i_${String(index)}`)),
      synonymRows,
      tips,
    }),
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) =>
        ['knowledge', 'corrections', 'idioms', 'synonymRows', 'tips'].includes(feature),
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: {
          categoryIds: ['test'],
          correctionCategoryIds: 'all' as const,
          corrections: true,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: [],
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: randomOf(0.25),
    ...(feedNotices === undefined ? {} : { feedNotices }),
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

/** What each card shows: its Entry's id, or the Feed Notice. */
const shownBy = (cards: readonly FeedCard[]) =>
  cards.map((card) => (card.kind === 'notice' ? card.notice : card.entryId));

/** Records with a Word, a Correction, an Idiom, a Synonym Row and a Tip marked «Не знаю» on day one, so due on day two. */
async function withDueEntries(): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  const app = await run({ records, at: dayOne });
  for (const id of ['w_20', 'c_2', 'i_2', 'r_2', 't_2']) await app.knowledge.tap(id, 'unknown');
  return records;
}

// Spec #832, ADR 0054: Feed Notices take no turn and make nothing Seen.
describe('Feed Notices', () => {
  it('come from the second card and leave the turns of every kind and of Review where they were', async () => {
    const records = await withDueEntries();
    const without = await firstCards(
      (await run({ records: new Map(records), at: dayTwo })).feed,
      40,
    );
    const feedNotices = fakeNotices(['yesterday']);

    const cards = await firstCards(
      (await run({ records: new Map(records), at: dayTwo, feedNotices })).feed,
      41,
    );

    expect(cards[1]).toMatchObject({ kind: 'notice', notice: 'yesterday' });
    expect(cards.filter((card) => card.kind === 'notice')).toHaveLength(1);
    expect(shownBy(cards.filter((card) => card.kind !== 'notice'))).toEqual(shownBy(without));
    expect(cards.some((card) => 'review' in card && card.review === true)).toBe(true);
  });

  it('take a card each in the order Weekly Recap, first-week card, Yesterday, then the Daily Limit card', async () => {
    const feedNotices = fakeNotices(['dailyLimit', 'yesterday', 'firstWeek', 'weeklyRecap']);

    const cards = await firstCards(
      (await run({ records: new Map(), at: dayOne, feedNotices })).feed,
      6,
    );

    expect(shownBy(cards.slice(1, 5))).toEqual([
      'weeklyRecap',
      'firstWeek',
      'yesterday',
      'dailyLimit',
    ]);
    expect(cards[5]?.kind).toBe('word');
  });

  it('give the Word of the Day the first card and the three notices of the day cards 2, 3 and 4, and the Daily Limit card the card after the limit', async () => {
    const limit = 3;
    const opened: { history?: Composition['history'] } = {};
    const feedNotices: FeedNotices = {
      forDay: () =>
        Promise.resolve(
          (
            [
              'yesterday',
              'weeklyRecap',
              'firstWeek',
              ...((opened.history?.list.length ?? 0) >= limit ? (['dailyLimit'] as const) : []),
            ] as const
          ).map(contentOf),
        ),
    };
    const app = await run({ records: new Map(), at: dayOne, feedNotices });
    opened.history = app.history;
    // The card on screen when the limit is reached.
    let onScreenAtLimit: number | undefined;

    for (let position = 0; position < 12; position += 1) {
      await app.feed.show(position);
      if (onScreenAtLimit === undefined && app.history.list.length >= limit)
        onScreenAtLimit = position;
      app.advance(1000);
    }

    const cards = app.feed.cards;
    expect(cards[0]?.kind === 'word' && cards[0].wordOfTheDay !== undefined).toBe(true);
    expect(shownBy(cards.slice(1, 4))).toEqual(['weeklyRecap', 'firstWeek', 'yesterday']);
    expect(onScreenAtLimit).toBeDefined();
    expect(cards.findIndex((card) => card.kind === 'notice' && card.notice === 'dailyLimit')).toBe(
      (onScreenAtLimit ?? 0) + 1,
    );
  });

  it('make nothing Seen, however long they stay on screen', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, at: dayOne, feedNotices: fakeNotices(['yesterday']) });
    await firstCards(app.feed, 3);
    const before = new Map(records);

    await app.feed.show(1);
    app.advance(60_000);
    await app.feed.show(undefined);

    expect([...records.keys()].filter((key) => key.startsWith('feed.seen.'))).toEqual(
      [...before.keys()].filter((key) => key.startsWith('feed.seen.')),
    );
  });

  it('close for the local day once swiped past, and come again the next day', async () => {
    const records = new Map<string, string>();
    const feedNotices = fakeNotices(['weeklyRecap', 'yesterday']);
    const app = await run({ records, at: dayOne, feedNotices });
    await firstCards(app.feed, 3);

    await app.feed.show(0);
    await app.feed.show(1);
    app.advance(1000);
    await app.feed.show(2);

    const later = await firstCards((await run({ records, at: dayOne, feedNotices })).feed, 4);
    expect(shownBy(later).filter((shown) => !shown?.startsWith('w_'))).toEqual(['yesterday']);
    const tomorrow = await firstCards((await run({ records, at: dayTwo, feedNotices })).feed, 3);
    expect(shownBy(tomorrow.slice(1, 3))).toEqual(['weeklyRecap', 'yesterday']);
  });

  it('stay open when the app goes to the background on one', async () => {
    const records = new Map<string, string>();
    const feedNotices = fakeNotices(['yesterday']);
    const app = await run({ records, at: dayOne, feedNotices });
    await firstCards(app.feed, 2);

    await app.feed.show(1);
    await app.feed.show(undefined);

    const later = await firstCards((await run({ records, at: dayOne, feedNotices })).feed, 3);
    expect(later.some((card) => card.kind === 'notice')).toBe(true);
  });

  it('keep the next Entry ready behind a Feed Notice, so the next swipe never waits', async () => {
    const app = await run({
      records: new Map(),
      at: dayOne,
      feedNotices: fakeNotices(['yesterday']),
    });

    await app.feed.show(0);

    expect(app.feed.cards.map((card) => card.kind)).toEqual(['word', 'notice', 'word']);
  });
});
