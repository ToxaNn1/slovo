import { describe, expect, it } from 'vitest';

import type { FeatureSwitch, Word } from '@slovo/contracts';

import { openComposition, type Composition, type FeedCard } from '../index';
import { createMemoryContentPort } from '../testing';
import { correction, fakeClock, randomOf, testEdition, tip, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const words: readonly Word[] = Array.from({ length: 40 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

const dayOne = '2026-10-11T09:00:00+03:00';
const dayTwo = '2026-10-12T09:00:00+03:00';
const goalSwitches: readonly FeatureSwitch[] = ['xpLog', 'dailyGoal', 'seenWordXp'];

type App = Composition & { advance: (ms: number) => void };

/** The Core composition of one app run on the day, over the records, so the user state survives between runs. */
async function run({
  records = new Map(),
  at,
  switches = [...goalSwitches, 'goalReachedCard'],
}: {
  records?: Map<string, string>;
  at: string;
  switches?: readonly FeatureSwitch[];
}): Promise<App> {
  const { clock, advance } = fakeClock(at);
  const app = await openComposition({
    content: createMemoryContentPort({
      words,
      corrections: [0, 1, 2].map((index) => correction(`c_${String(index)}`)),
      tips: [0, 1, 2].map((index) => tip(`t_${String(index)}`)),
    }),
    edition: testEdition({ isFeatureEnabled: (feature) => switches.includes(feature) }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: randomOf(0.25),
  });
  return Object.assign(app, { advance });
}

const isGoalReached = (card: FeedCard | undefined) =>
  card?.kind === 'notice' && card.notice === 'goalReached';

/** Shows the cards from `from` on, each long enough to be Seen, and returns where «Ціль дня виконано!» is, if it came. */
async function readOn(app: App, from: number, count: number): Promise<number | undefined> {
  for (let position = from; position < from + count; position += 1) {
    await app.feed.show(position);
    app.advance(1000);
  }
  const at = app.feed.cards.findIndex(isGoalReached);
  return at === -1 ? undefined : at;
}

/** The Lemmas of the Word cards from `from` up to `to`, in the order they were on screen: `word` makes each from its id. */
const lemmasOf = (app: App, from: number, to: number) =>
  app.feed.cards
    .slice(from, to)
    .flatMap((card) => (card.kind === 'word' ? [card.entryId.slice(2)] : []));

// Owner 14.11: «Ціль дня виконано!», a Feed Notice once the Daily Goal is met.
describe('«Ціль дня виконано!»', () => {
  it('comes one card after the Word that meets the Daily Goal, with the goal and the first Words Seen today', async () => {
    const app = await run({ at: dayOne });
    await app.xpLog.setDailyGoal(3);

    // Three Words on screen, the third not left yet: the goal is not met, so no card is got ready for it.
    expect(await readOn(app, 0, 3)).toBeUndefined();
    // Leaving the third Word meets the goal: the card after the one now on screen is the Feed Notice.
    await app.feed.show(3);
    expect(app.xpLog.state.dailyGoal?.met).toBe(true);
    expect(app.feed.cards.findIndex(isGoalReached)).toBe(4);

    const card = app.feed.cards[4];
    expect(card?.kind === 'notice' && card.notice === 'goalReached' && card).toMatchObject({
      goal: 3,
      words: lemmasOf(app, 0, 3),
    });
  });

  it('never comes for a Word swiped away before it is Seen, and comes once the goal is really met', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, at: dayOne });
    await app.xpLog.setDailyGoal(3);

    // Two Words Seen, the third swiped away after 100 ms: still two Seen.
    expect(await readOn(app, 0, 2)).toBeUndefined();
    await app.feed.show(2);
    app.advance(100);
    await app.feed.show(3);
    expect(app.xpLog.state.dailyGoal).toMatchObject({ met: false, seen: 2 });
    expect(app.feed.cards.findIndex(isGoalReached)).toBe(-1);
    expect(records.has('feed.noticesClosed')).toBe(false);

    // The next Word read and left meets the goal: the card comes one card after it.
    app.advance(1000);
    await app.feed.show(4);
    expect(app.xpLog.state.dailyGoal).toMatchObject({ met: true, seen: 3 });
    expect(app.feed.cards.findIndex(isGoalReached)).toBe(5);
  });

  it('names at most three Words, the first Seen today', async () => {
    const app = await run({ at: dayOne });
    await app.xpLog.setDailyGoal(5);

    expect(await readOn(app, 0, 6)).toBe(6);
    const card = app.feed.cards[6];
    expect(card?.kind === 'notice' && card.notice === 'goalReached' && card).toMatchObject({
      goal: 5,
      words: lemmasOf(app, 0, 3),
    });
  });

  it('comes once: gone for the day once turned past, and back only on a day the goal is met again', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, at: dayOne });
    await app.xpLog.setDailyGoal(3);
    expect(await readOn(app, 0, 5)).toBe(4);

    expect(await readOn(app, 5, 6)).toBe(4);
    expect(app.feed.cards.filter(isGoalReached)).toHaveLength(1);

    const later = await run({ records: new Map(records), at: '2026-10-11T20:00:00+03:00' });
    expect(await readOn(later, 0, 6)).toBeUndefined();

    const tomorrow = await run({ records: new Map(records), at: dayTwo });
    expect(await readOn(tomorrow, 0, 3)).toBeUndefined();
    expect(await readOn(tomorrow, 3, 2)).toBe(4);
  });

  it('never comes without a Daily Goal', async () => {
    const app = await run({ at: dayOne });
    await app.xpLog.setDailyGoal(null);
    expect(await readOn(app, 0, 12)).toBeUndefined();
  });

  it('never comes while the reader hides the counters («Без лічильників», ADR 0066)', async () => {
    const records = new Map<string, string>();
    const hiding = await openUserState({ port: createMemoryUserStatePort(records) });
    await hiding.write(userStateRecords.noCounters.change(true));
    const app = await run({ records, at: dayOne });
    await app.xpLog.setDailyGoal(3);
    expect(await readOn(app, 0, 8)).toBeUndefined();
    expect(app.xpLog.state.dailyGoal?.met).toBe(true);
  });

  it('never comes while its Feature Switch is off', async () => {
    const off = await run({ at: dayOne, switches: goalSwitches });
    await off.xpLog.setDailyGoal(3);
    expect(await readOn(off, 0, 8)).toBeUndefined();
  });

  it('is met only by Words: a Correction or a Tip Seen does not count', async () => {
    const app = await run({
      at: dayOne,
      switches: [...goalSwitches, 'goalReachedCard', 'corrections', 'tips'],
    });
    await app.xpLog.setDailyGoal(9);

    const at = await readOn(app, 0, 13);

    // Eight Words Seen with a Correction and a Tip between them: the Word after the Tip meets the
    // goal, and the card comes one card after it.
    const kinds = app.feed.cards.map((card) => card.kind);
    expect(kinds.slice(0, 11).filter((kind) => kind === 'word')).toHaveLength(8);
    expect(kinds.slice(9, 12)).toEqual(['correction', 'tip', 'word']);
    expect(at).toBe(13);
  });

  describe('in a later app run of the day the goal was met, before the card was turned past', () => {
    /** Meets a Daily Goal of `goal` on day one, ending on the Feed Notice, and returns the records and the first three Lemmas Seen. */
    async function metAndLeft(goal: number) {
      const records = new Map<string, string>();
      const app = await run({ records, at: dayOne });
      await app.xpLog.setDailyGoal(goal);
      expect(await readOn(app, 0, goal + 2)).toBe(goal + 1);
      return { records, lemmas: lemmasOf(app, 0, goal + 1).slice(0, 3) };
    }

    const goalCardOf = async (records: Map<string, string>) => {
      const later = await run({ records, at: '2026-10-11T20:00:00+03:00' });
      const at = await readOn(later, 0, 3);
      const card = at === undefined ? undefined : later.feed.cards[at];
      return card?.kind === 'notice' && card.notice === 'goalReached' ? card : undefined;
    };

    it('names each Word Seen today once', async () => {
      const { records, lemmas } = await metAndLeft(2);

      expect((await goalCardOf(records))?.words).toEqual(lemmas);
    });

    it('names only Words Seen today, passing over the other kinds', async () => {
      const { records, lemmas } = await metAndLeft(3);
      const seen = (seenAt: string) => JSON.stringify({ seenAt, wordOfTheDay: false });
      // Seen before the Words of the day: a Correction and a Tip today, a Word the day before.
      records.set('history.c_0', seen('2026-10-11T05:00:00.000Z'));
      records.set('history.t_0', seen('2026-10-11T05:01:00.000Z'));
      records.set('history.w_39', seen('2026-10-10T12:00:00.000Z'));

      expect((await goalCardOf(records))?.words).toEqual(lemmas);
    });
  });
});
