import { describe, expect, it } from 'vitest';

import { openComposition, type AnalyticsPort, type FeatureSwitch } from '../index';
import { vocabulary } from '../game/crossing-crossword.test-support';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word, analyticsInto } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

// Spec #1358, ticket #1367, ADR 0066: the XP of the Daily Crossword and of Review answers.

const words = Array.from({ length: 14 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`));
/** The Words Review marks, and Words of 3–5 letters for the Daily Crossword to cross. */
const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: [...words, ...vocabulary],
});

const ALL_ON: readonly FeatureSwitch[] = [
  'xpLog',
  'game',
  'dailyCrossword',
  'crossingCrossword',
  'knowledge',
  'analytics',
];

/** The Core composition of one app run over the records, with the analytics events it emits. */
async function run({
  records = new Map<string, string>(),
  on = ALL_ON,
  time = fakeClock('2026-10-14T08:00:00+03:00'),
  seed = 7,
}: {
  records?: Map<string, string>;
  on?: readonly FeatureSwitch[];
  time?: ReturnType<typeof fakeClock>;
  /** Each device its own random source, as no two devices make the same record id. */
  seed?: number;
} = {}) {
  const events: [string, unknown][] = [];
  const analytics: AnalyticsPort = {
    // The onboarding, which opens on a fresh user state, has events of its own.
    track: (event, properties) => {
      if (!event.startsWith('onboarding')) events.push([event, properties]);
    },
    stop: () => undefined,
  };
  const app = await openComposition({
    content,
    edition: testEdition({ isFeatureEnabled: (feature) => on.includes(feature) }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: seededRandom(seed),
    analytics: analyticsInto(analytics),
  });
  return { app, records, events, time };
}

type App = Awaited<ReturnType<typeof run>>['app'];

/** Opens today's Daily Crossword. */
async function daily(app: App) {
  const opening = await app.openDailyCrossword();
  if (opening.kind !== 'crossing') throw new Error(`No Daily Crossword today: ${opening.kind}`);
  return opening.crossword;
}

/** Enters the Word of this index on its Letter Wheel, letter by letter, and releases. */
async function enter(crossword: Awaited<ReturnType<typeof daily>>, index: number) {
  const target = crossword.puzzle.words[index];
  if (!target) throw new Error('No such Word');
  await crossword.play({ type: 'select', place: target.start });
  if (crossword.state.current !== index)
    await crossword.play({ type: 'select', place: target.start });
  const used = new Set<number>();
  for (const letter of target.letters) {
    const tile = target.wheel.findIndex((candidate, i) => candidate === letter && !used.has(i));
    used.add(tile);
    await crossword.play({ type: 'extend', tile });
  }
  await crossword.play({ type: 'release' });
}

/** Opens today's Daily Crossword and enters every Word, which solves it. */
async function solve(app: App) {
  const crossword = await daily(app);
  for (const index of crossword.puzzle.words.keys()) await enter(crossword, index);
}

/** Records of Entries due for Review today, by their ids. */
function due(ids: readonly string[]): Map<string, string> {
  return new Map(
    ids.map((id) => [
      `knowledge.${id}`,
      JSON.stringify({ mark: 'unknown', step: 1, reviewDay: '2026-10-13', learned: false }),
    ]),
  );
}

const xpKeys = (records: Map<string, string>) =>
  [...records.keys()].filter((key) => key.startsWith('xp.'));

describe('the Daily Crossword XP', () => {
  it('gives 15 XP when the Daily Crossword is solved, and nothing before', async () => {
    const { app, events } = await run();
    await enter(await daily(app), 0);
    expect(app.xpLog.state).toMatchObject({ total: 0, today: 0 });

    await solve(app);

    expect(app.xpLog.state).toMatchObject({ total: 15, today: 15 });
    expect(events).toContainEqual(['dailyCrosswordSolved', { date: '2026-10-14' }]);
  });

  it('gives it once: a solved day opened again earns nothing more', async () => {
    const { app, records } = await run();
    await solve(app);
    const again = await run({ records });

    await solve(again.app);

    expect(again.app.xpLog.state).toMatchObject({ total: 15, today: 15 });
    expect(xpKeys(records)).toHaveLength(1);
  });

  it('gives it once across two devices that solve the same day', async () => {
    const phone = await run();
    const tablet = await run({ seed: 8 });
    await solve(phone.app);
    await solve(tablet.app);

    const merged = new Map([...phone.records, ...tablet.records]);
    const { app } = await run({ records: merged });

    expect(app.xpLog.state).toMatchObject({ total: 15, today: 15 });
  });

  it('gives 15 XP again for the next day’s Daily Crossword', async () => {
    const { records } = await run().then(async (first) => {
      await solve(first.app);
      return first;
    });
    const { app } = await run({ records, time: fakeClock('2026-10-15T08:00:00+03:00') });

    await solve(app);

    expect(app.xpLog.state).toMatchObject({ total: 30, today: 15 });
  });

  it('appends nothing with the xpLog switch off', async () => {
    const { app, records } = await run({ on: ['game', 'dailyCrossword', 'crossingCrossword'] });
    await solve(app);
    expect(xpKeys(records)).toEqual([]);
  });
});

describe('the Review XP', () => {
  it('gives 1 XP for each Review answer, Known or Unknown', async () => {
    const { app, events } = await run({ records: due(['w_00', 'w_01']) });

    await app.knowledge.tap('w_00', 'known');
    await app.knowledge.tap('w_01', 'unknown');

    expect(app.xpLog.state).toMatchObject({ total: 2, today: 2 });
    expect(events.filter(([event]) => event === 'reviewAnswered')).toEqual([
      ['reviewAnswered', { mark: 'known', entryKind: 'word', rarity: 3, categoryId: 'test' }],
      ['reviewAnswered', { mark: 'unknown', entryKind: 'word', rarity: 3, categoryId: 'test' }],
    ]);
  });

  it('gives nothing for a mark on an Entry that is not due for Review', async () => {
    const { app, events } = await run();
    await app.knowledge.tap('w_00', 'known');
    expect(app.xpLog.state).toMatchObject({ total: 0, today: 0 });
    expect(events.some(([event]) => event === 'reviewAnswered')).toBe(false);
  });

  it('stops at 10 XP a local day and starts again the next day', async () => {
    const ids = words.map(({ id }) => id).slice(0, 12);
    const { app, records } = await run({ records: due(ids) });
    for (const id of ids) await app.knowledge.tap(id, 'known');

    expect(app.xpLog.state.today).toBe(10);
    expect(xpKeys(records)).toHaveLength(10);

    const next = await run({
      records: new Map([...records, ...due(['w_12'])]),
      time: fakeClock('2026-10-15T08:00:00+03:00'),
    });
    await next.app.knowledge.tap('w_12', 'unknown');
    expect(next.app.xpLog.state).toMatchObject({ total: 11, today: 1 });
  });

  it('keeps the cap when two devices’ Review XP of one day merge', async () => {
    const phone = await run({ records: due(words.map(({ id }) => id).slice(0, 8)) });
    const tablet = await run({ records: due(words.map(({ id }) => id).slice(6, 14)), seed: 8 });
    for (const id of words.map(({ id }) => id).slice(0, 8))
      await phone.app.knowledge.tap(id, 'known');
    for (const id of words.map(({ id }) => id).slice(6, 14))
      await tablet.app.knowledge.tap(id, 'known');

    const { app } = await run({ records: new Map([...phone.records, ...tablet.records]) });

    expect(app.xpLog.state).toMatchObject({ total: 10, today: 10 });
  });

  it('takes the amount and the cap from the Edition XP table', async () => {
    const records = due(['w_00', 'w_01', 'w_02']);
    const app = await openComposition({
      content,
      edition: testEdition({
        isFeatureEnabled: (feature) => ALL_ON.includes(feature),
        xp: {
          round: 1,
          finishedGame: 5,
          finishedGameShare: 0.5,
          bestResult: 5,
          dailyCrossword: 15,
          reviewAnswer: 2,
          reviewDailyCap: 3,
          quickQuestion: 2,
          seenWord: 1,
        },
      }),
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: fakeClock('2026-10-14T08:00:00+03:00').clock,
      random: seededRandom(7),
    });
    for (const id of ['w_00', 'w_01', 'w_02']) await app.knowledge.tap(id, 'known');
    expect(app.xpLog.state.today).toBe(3);
  });
});

describe('the analytics of the Daily Crossword and Review', () => {
  it('emits none while «Ділитися анонімною статистикою» is off', async () => {
    const records = new Map([...due(['w_05']), ['settings.shareCounters', 'false']]);
    const { app, events } = await run({ records });

    await solve(app);
    await app.knowledge.tap('w_05', 'known');

    expect(app.xpLog.state.today).toBe(16);
    expect(events).toEqual([]);
  });
});
