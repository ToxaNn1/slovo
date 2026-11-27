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
  it('comes as the card after the Word that meets the Daily Goal, with the goal and the first Words Seen today', async () => {
    const app = await run({ at: dayOne });
    await app.xpLog.setDailyGoal(3);

    // Two Words Seen, the third on screen: the card after it is the Feed Notice.
    expect(await readOn(app, 0, 2)).toBeUndefined();
    await app.feed.show(2);
    expect(app.feed.cards.findIndex(isGoalReached)).toBe(3);

    const card = app.feed.cards[3];
    expect(card?.kind === 'notice' && card.notice === 'goalReached' && card).toMatchObject({
      goal: 3,
      words: lemmasOf(app, 0, 3),
    });
  });

  it('names at most three Words, the first Seen today', async () => {
    const app = await run({ at: dayOne });
    await app.xpLog.setDailyGoal(5);

    expect(await readOn(app, 0, 5)).toBe(5);
    const card = app.feed.cards[5];
    expect(card?.kind === 'notice' && card.notice === 'goalReached' && card).toMatchObject({
      goal: 5,
      words: lemmasOf(app, 0, 3),
    });
  });

  it('comes once: gone for the day once turned past, and back only on a day the goal is met again', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, at: dayOne });
    await app.xpLog.setDailyGoal(3);
    expect(await readOn(app, 0, 3)).toBe(3);

    expect(await readOn(app, 3, 6)).toBe(3);
    expect(app.feed.cards.filter(isGoalReached)).toHaveLength(1);

    const later = await run({ records: new Map(records), at: '2026-10-11T20:00:00+03:00' });
    expect(await readOn(later, 0, 6)).toBeUndefined();

    const tomorrow = await run({ records: new Map(records), at: dayTwo });
    expect(await readOn(tomorrow, 0, 2)).toBeUndefined();
    expect(await readOn(tomorrow, 2, 1)).toBe(3);
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

  it('is met only by a Word: a Correction or a Tip on screen brings no card after it', async () => {
    const app = await run({
      at: dayOne,
      switches: [...goalSwitches, 'goalReachedCard', 'corrections', 'tips'],
    });
    await app.xpLog.setDailyGoal(9);

    const at = await readOn(app, 0, 13);

    // Eight Words Seen with a Correction and a Tip between them: the Word after the Tip meets the goal.
    const kinds = app.feed.cards.map((card) => card.kind);
    expect(kinds.slice(0, 11).filter((kind) => kind === 'word')).toHaveLength(8);
    expect(kinds.slice(9, 11)).toEqual(['correction', 'tip']);
    expect(at).toBe(12);
  });

  describe('in a later app run of the day the goal was met, before the card was turned past', () => {
    /** Meets a Daily Goal of `goal` on day one, ending on the Feed Notice, and returns the records and the Lemmas named. */
    async function metAndLeft(goal: number) {
      const records = new Map<string, string>();
      const app = await run({ records, at: dayOne });
      await app.xpLog.setDailyGoal(goal);
      expect(await readOn(app, 0, goal + 1)).toBe(goal);
      return { records, lemmas: lemmasOf(app, 0, goal) };
    }

    const goalCardOf = async (records: Map<string, string>) => {
      const later = await run({ records, at: '2026-10-11T20:00:00+03:00' });
      const at = await readOn(later, 0, 3);
      const card = at === undefined ? undefined : later.feed.cards[at];
      return card?.kind === 'notice' && card.notice === 'goalReached' ? card : undefined;
    };

    it('names each Word once, though the card follows a Word Seen today', async () => {
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
