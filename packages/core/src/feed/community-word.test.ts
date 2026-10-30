import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Feed,
  type FeedCard,
} from '../index';
import { createFakeCommunityWordApi, createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';

const words: readonly Word[] = [
  ...Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
  word('w_retired', { retired: true }),
];

const lastWednesday = '2026-10-21T09:00:00+03:00';
const monday = '2026-10-26T09:00:00+03:00';
const mondayPastMidnight = '2026-10-26T00:30:00+02:00';
const mondayEvening = '2026-10-26T21:00:00+03:00';
const tuesday = '2026-10-27T09:00:00+03:00';

const ON = ['weeklyRecap', 'communityCounters', 'communityWord'];

/** The Core composition of one app run at `at`, over the records, so the user state survives between runs. */
async function run({
  records,
  at,
  api,
  features = ON,
}: {
  records: Map<string, string>;
  at: string;
  api?: ReturnType<typeof createFakeCommunityWordApi>;
  features?: readonly string[];
}) {
  const { clock, advance } = fakeClock(at);
  const app = await openComposition({
    content: createMemoryContentPort({ words }),
    edition: testEdition({
      isFeatureEnabled: (feature) => features.includes(feature),
      userSettingDefaults: {
        mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: randomOf(0.25),
    ...(api === undefined ? {} : { communityWord: api }),
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

/** Records with an Active Day in the week before `monday`, so it has a Weekly Recap. */
async function withLastWeek(): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  await run({ records, at: lastWednesday });
  return records;
}

/** A Community Word API that answers `w_07` with 12 adds. */
function apiOfWord(entryId = 'w_07') {
  const api = createFakeCommunityWordApi();
  api.answer({ entryId, adds: 12 });
  return api;
}

// Spec #886, ADR 0060: the Community Word, a Feed Notice on a local Monday.
describe('The Community Word', () => {
  it('shows on a local Monday right after the Weekly Recap, with its Entry card and its adds', async () => {
    const app = await run({ records: await withLastWeek(), at: monday, api: apiOfWord() });

    const cards = await firstCards(app.feed, 4);

    expect(shownBy(cards.slice(1, 3))).toEqual(['weeklyRecap', 'communityWord']);
    expect(cards[2]).toMatchObject({
      kind: 'notice',
      notice: 'communityWord',
      adds: 12,
      card: { kind: 'word', entryId: 'w_07', model: { wordId: 'w_07' } },
    });
    expect(cards[3]?.kind).toBe('word');
  });

  it('shows on a Monday without a Weekly Recap too', async () => {
    const app = await run({ records: new Map(), at: monday, api: apiOfWord() });

    const cards = await firstCards(app.feed, 3);

    expect(shownBy(cards)[1]).toBe('communityWord');
    expect(cards[2]?.kind).toBe('word');
  });

  it('is not there on a Tuesday, and the week is not even asked for', async () => {
    const api = apiOfWord();
    const app = await run({ records: await withLastWeek(), at: tuesday, api });

    const cards = await firstCards(app.feed, 4);

    expect(cards.some((card) => card.kind === 'notice')).toBe(false);
    expect(api.asked).toBe(0);
  });

  it('is not there when nobody added anything', async () => {
    const app = await run({
      records: new Map(),
      at: monday,
      api: createFakeCommunityWordApi(),
    });

    expect((await firstCards(app.feed, 4)).some((card) => card.kind === 'notice')).toBe(false);
  });

  it('is not there when its Entry is Hidden for the reader', async () => {
    const records = new Map<string, string>();
    const before = await run({ records, at: lastWednesday });
    await before.hide({ kind: 'entry', entryId: 'w_07' });

    const app = await run({ records, at: monday, api: apiOfWord() });

    const cards = await firstCards(app.feed, 4);
    expect(cards.some((card) => card.kind === 'notice' && card.notice === 'communityWord')).toBe(
      false,
    );
  });

  it('is not there when its Entry is Retired or not in the Language Pack', async () => {
    for (const entryId of ['w_retired', 'w_unknown']) {
      const app = await run({ records: new Map(), at: monday, api: apiOfWord(entryId) });

      expect((await firstCards(app.feed, 4)).some((card) => card.kind === 'notice')).toBe(false);
    }
  });

  it('is not there with the Feature Switch communityWord off, and the week is not asked for', async () => {
    const api = apiOfWord();
    const app = await run({
      records: new Map(),
      at: monday,
      api,
      features: ['weeklyRecap', 'communityCounters'],
    });

    expect((await firstCards(app.feed, 4)).some((card) => card.kind === 'notice')).toBe(false);
    expect(api.asked).toBe(0);
  });

  it('is not there with the Feature Switch communityCounters off, even with communityWord on, and the week is not asked for', async () => {
    const api = apiOfWord();
    const app = await run({
      records: new Map(),
      at: monday,
      api,
      features: ['weeklyRecap', 'communityWord'],
    });

    expect((await firstCards(app.feed, 4)).some((card) => card.kind === 'notice')).toBe(false);
    expect(api.asked).toBe(0);
  });

  it('is gone for the day once swiped past', async () => {
    const records = new Map<string, string>();
    const api = apiOfWord();
    const app = await run({ records, at: monday, api });
    await firstCards(app.feed, 3);

    await app.feed.show(0);
    await app.feed.show(1);
    app.advance(1000);
    await app.feed.show(2);

    const later = await run({ records, at: mondayEvening, api });
    expect((await firstCards(later.feed, 4)).some((card) => card.kind === 'notice')).toBe(false);
  });

  it('reads the week once a day, however often the app opens that day', async () => {
    const records = new Map<string, string>();
    const api = apiOfWord();
    await firstCards((await run({ records, at: monday, api })).feed, 3);

    const later = await firstCards((await run({ records, at: mondayEvening, api })).feed, 3);

    expect(shownBy(later)[1]).toBe('communityWord');
    expect(api.asked).toBe(1);
  });

  it('asks again on a later card when the week could not be read', async () => {
    const api = apiOfWord();
    api.fail('offline');
    const app = await run({ records: new Map(), at: monday, api });

    const cards = await firstCards(app.feed, 4);

    expect(cards.map((card) => card.kind)).toEqual(['word', 'word', 'notice', 'word']);
    expect(shownBy(cards)[2]).toBe('communityWord');
    expect(api.asked).toBe(2);
  });

  it('waits for the backend’s week to turn, as just past a local midnight east of UTC, and asks on a later run that day', async () => {
    const records = new Map<string, string>();
    const api = apiOfWord();

    const early = await firstCards((await run({ records, at: mondayPastMidnight, api })).feed, 3);
    const later = await firstCards((await run({ records, at: monday, api })).feed, 3);

    expect(shownBy(early)).not.toContain('communityWord');
    expect(shownBy(later)[1]).toBe('communityWord');
    expect(api.asked).toBe(1);
  });
});
