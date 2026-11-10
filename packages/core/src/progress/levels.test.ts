import { describe, expect, it } from 'vitest';

import {
  openComposition,
  type AnalyticsPort,
  type Composition,
  type FeatureSwitch,
  type FeedCard,
  type Round,
} from '../index';
import { renderStress } from '../entries/stress';
import { type XpRecord } from './records';
import { createMemoryContentPort } from '../testing';
import {
  fakeClock,
  optionsOf,
  seededRandom,
  testEdition,
  word,
  analyticsInto,
} from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

// Spec #1358 stories 10–13 and 85, ticket #1368, ADR 0066: the Level derived
// from total XP, its Edition name and the level-milestone Feed Notices.

const words = Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`));
const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words,
});
const byDefinition = new Map(words.map((w) => [w.primaryDefinition, w]));

const ALL_ON: readonly FeatureSwitch[] = [
  'game',
  'gameGuessWord',
  'xpLog',
  'levels',
  'noCounters',
  'analytics',
];

/** One XP record of `amount` on the local day `date`, at 08:00 in Kyiv. */
const xp = (date: string, amount: number): XpRecord => ({
  kind: 'xp',
  date,
  at: new Date(`${date}T08:00:00+03:00`).toISOString(),
  source: 'game-round',
  amount,
});

/** One Review XP record of `amount` on the local day `date`, at 08:30 in Kyiv. */
const review = (date: string, amount: number): XpRecord => ({
  kind: 'xp',
  date,
  at: new Date(`${date}T08:30:00+03:00`).toISOString(),
  source: 'review-answer',
  amount,
});

/** The records of a reader whose XP log holds `xps`. */
async function readerWith(...xps: readonly XpRecord[]): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  for (const [index, record] of xps.entries()) {
    await userState.write(userStateRecords.xpLog.record(`seeded-${String(index)}`).change(record));
  }
  return records;
}

/** A port that keeps what reached it. */
function fakePort() {
  const events: unknown[][] = [];
  const port: AnalyticsPort = {
    // The onboarding, which opens on a fresh user state, has events of its own.
    track: (event, properties) => {
      if (!event.startsWith('onboarding')) events.push([event, properties]);
    },
    stop: () => undefined,
  };
  return { port, events };
}

/** The Core composition of one app run on the local day `on`, over the records. */
async function run({
  records = new Map<string, string>(),
  on = '2026-10-14',
  off = [],
}: {
  records?: Map<string, string>;
  on?: string;
  off?: readonly FeatureSwitch[];
} = {}) {
  const fake = fakePort();
  const time = fakeClock(`${on}T09:00:00+03:00`);
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => ALL_ON.includes(feature) && !off.includes(feature),
      userSettingDefaults: {
        mix: { kinds: { correction: false, idiom: false, synonymRow: false, tip: false } },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: seededRandom(7),
    analytics: analyticsInto(fake.port),
  });
  return { app, events: fake.events };
}

/** The Level part of the XP state: the Level, its name and the progress to the next. */
async function levelAt(total: number) {
  const { app } = await run({ records: await readerWith(xp('2026-10-01', total)) });
  return app.xpLog.state.level;
}

/** The level-milestone Feed Notices among the Feed's first cards. */
async function milestonesIn(app: Composition): Promise<readonly FeedCard[]> {
  while (app.feed.cards.length < 4) {
    if ((await app.feed.next()) === undefined) break;
  }
  return app.feed.cards.filter(
    (card) => card.kind === 'notice' && card.notice === 'levelMilestone',
  );
}

/** Swipes from the level-milestone Feed Notice to the card after it, which closes it. */
async function swipePastMilestone(app: Composition): Promise<void> {
  const index = app.feed.cards.findIndex(
    (card) => card.kind === 'notice' && card.notice === 'levelMilestone',
  );
  if (index < 0) throw new Error('No level-milestone Feed Notice among the cards');
  await app.feed.show(index);
  await app.feed.show(index + 1);
}

const rightOption = (round: Round) =>
  optionsOf(round).findIndex(({ text }) => {
    const answer = byDefinition.get(round.prompt);
    return answer !== undefined && text === renderStress(answer);
  });

/** Starts «Вгадай слово» and answers its first `rounds` Rounds right, which earns 1 XP each. */
async function earnXp(app: Composition, rounds: number): Promise<void> {
  while (app.game.state.modes.some((offer) => 'planning' in offer)) {
    await new Promise<void>((resolve) => {
      const stop = app.game.subscribe(() => {
        stop();
        resolve();
      });
    });
  }
  await app.game.start('guess-word');
  for (let played = 0; played < rounds; played += 1) {
    if (played > 0) await app.game.next();
    const round = app.game.state.current?.round;
    if (round === undefined || round.form === 'typed') throw new Error('No pick Round in play');
    await app.game.answer({ form: 'pick', option: rightOption(round) });
  }
}

/** Starts «Вгадай слово» and answers its first Round right, which earns 1 XP. */
const earnOneXp = (app: Composition) => earnXp(app, 1);

describe('the Level curve', () => {
  it('starts at level 0 with 50 XP to level 1', async () => {
    const { app } = await run();
    expect(app.xpLog.state.level).toMatchObject({
      level: 0,
      name: 'Seed',
      progress: 0,
      toNext: 50,
    });
  });

  it('reaches level 1 at 50 XP, and level 2 costs 10% more', async () => {
    expect(await levelAt(49)).toMatchObject({ level: 0, name: 'Seed', progress: 49, toNext: 50 });
    expect(await levelAt(50)).toMatchObject({ level: 1, name: 'Seed', progress: 0, toNext: 55 });
    expect(await levelAt(104)).toMatchObject({ level: 1, progress: 54 });
    expect(await levelAt(105)).toMatchObject({ level: 2, name: 'Seed', progress: 0, toNext: 61 });
  });

  it('reaches level 5 at 306 XP and level 10 at 798 XP, each level rounded to whole XP', async () => {
    expect(await levelAt(305)).toMatchObject({ level: 4, progress: 72, toNext: 73 });
    expect(await levelAt(306)).toMatchObject({ level: 5, name: 'Sprout', progress: 0, toNext: 81 });
    expect(await levelAt(797)).toMatchObject({ level: 9, progress: 117, toNext: 118 });
    expect(await levelAt(798)).toMatchObject({
      level: 10,
      name: 'Sapling',
      progress: 0,
      toNext: 120,
    });
  });

  it('costs 120 XP for every level after 10, with no top', async () => {
    expect(await levelAt(917)).toMatchObject({ level: 10, progress: 119, toNext: 120 });
    expect(await levelAt(918)).toMatchObject({ level: 11, progress: 0, toNext: 120 });
    expect(await levelAt(1998)).toMatchObject({
      level: 20,
      name: 'Grove',
      progress: 0,
      toNext: 120,
    });
    expect(await levelAt(100_000)).toMatchObject({ level: 836, progress: 82, toNext: 120 });
  });

  it('names one name per five levels and keeps the last name above them', async () => {
    expect((await levelAt(1478))?.name).toBe('Tree'); // level 15
    expect((await levelAt(100_000))?.name).toBe('Grove');
  });

  // Ticket #1648: the name's band, the next name and the XP to its first Level, and the ladder.
  it.each([
    [0, 0, { first: 0, last: 4 }, { name: 'Sprout', level: 5, xp: 306 }],
    [4, 305, { first: 0, last: 4 }, { name: 'Sprout', level: 5, xp: 1 }],
    [5, 306, { first: 5, last: 9 }, { name: 'Sapling', level: 10, xp: 492 }],
    [19, 1878, { first: 15, last: 19 }, { name: 'Grove', level: 20, xp: 120 }],
    [25, 2598, { first: 20, last: undefined }, undefined],
    [40, 4398, { first: 20, last: undefined }, undefined],
  ])(
    'at level %i gives the band of its name and the XP left to the next name',
    async (level, total, band, next) => {
      expect(await levelAt(total)).toMatchObject({ level, band, next });
    },
  );

  it('lays the names out as a ladder of passed, current and ahead rungs', async () => {
    expect((await levelAt(1878))?.ladder).toEqual([
      { name: 'Seed', band: { first: 0, last: 4 }, state: 'passed' },
      { name: 'Sprout', band: { first: 5, last: 9 }, state: 'passed' },
      { name: 'Sapling', band: { first: 10, last: 14 }, state: 'passed' },
      { name: 'Tree', band: { first: 15, last: 19 }, state: 'current' },
      { name: 'Grove', band: { first: 20, last: undefined }, state: 'ahead' },
    ]);
    expect((await levelAt(0))?.ladder.map(({ state }) => state)).toEqual([
      'current',
      'ahead',
      'ahead',
      'ahead',
      'ahead',
    ]);
    expect((await levelAt(4398))?.ladder.at(-1)?.state).toBe('current');
  });

  it('derives the Level from the XP log as it grows, and stores no Level', async () => {
    const records = await readerWith(xp('2026-10-01', 49));
    const { app } = await run({ records });
    const before = new Set(records.keys());

    await earnOneXp(app);

    expect(app.xpLog.state.level).toMatchObject({ level: 1, progress: 0 });
    const written = [...records.keys()].filter((key) => !before.has(key));
    expect(written.every((key) => key.startsWith('xp.') || key.startsWith('game'))).toBe(true);
    expect(written.some((key) => /level/i.test(key))).toBe(false);
  });

  it('counts Review XP up to the daily cap toward the day a Level is reached', async () => {
    // 295 Game XP and 15 Review XP on one day, of which the cap counts 10: level 5 (306 XP) waits.
    const dayOne = [xp('2026-10-13', 295), review('2026-10-13', 10), review('2026-10-13', 5)];
    const { app } = await run({ records: await readerWith(...dayOne), on: '2026-10-13' });
    expect(app.xpLog.state.level?.level).toBe(4);
    expect(app.xpLog.reachedOn(306)).toBeUndefined();
    expect(await milestonesIn(app)).toEqual([]);

    const records = await readerWith(...dayOne, xp('2026-10-14', 6));
    expect((await run({ records })).app.xpLog.reachedOn(306)).toBe('2026-10-14');
  });

  it('has no Level while the levels Feature Switch is off, or the XP log is', async () => {
    const records = await readerWith(xp('2026-10-01', 400));
    expect((await run({ records, off: ['levels'] })).app.xpLog.state.level).toBeUndefined();
    expect((await run({ records, off: ['xpLog'] })).app.xpLog.state.level).toBeUndefined();
  });
});

// Review ticket T-mobile-6: the Core tells a Level reached, so no app diffs Levels.
describe('the Level reached', () => {
  it('is told once, with its number and name, by the XP that crosses it', async () => {
    const { app } = await run({ records: await readerWith(xp('2026-10-01', 48)) });
    const reached: { level: number; name: string }[] = [];
    app.xpLog.onLevelReached(({ level, name }) => reached.push({ level, name }));

    // 49 XP, then 50 XP reach level 1, then 51 XP stay on it.
    await earnXp(app, 3);

    expect(app.xpLog.state.level).toMatchObject({ level: 1, progress: 1 });
    expect(reached).toEqual([{ level: 1, name: 'Seed' }]);
  });

  it('is not told for a Level the log opened at, as after a sync, nor by XP that stays on it', async () => {
    const { app } = await run({ records: await readerWith(xp('2026-10-01', 50)) });
    const reached: number[] = [];
    app.xpLog.onLevelReached(({ level }) => reached.push(level));

    await earnOneXp(app);

    expect(app.xpLog.state.level).toMatchObject({ level: 1, progress: 1 });
    expect(reached).toEqual([]);
  });
});

describe('the level-milestone Feed Notices', () => {
  it('shows the milestone on the local day the reader reaches level 5, with its Level name', async () => {
    const records = await readerWith(xp('2026-10-13', 300), xp('2026-10-14', 6));

    const cards = await milestonesIn((await run({ records, on: '2026-10-14' })).app);

    expect(cards).toEqual([
      expect.objectContaining({
        kind: 'notice',
        notice: 'levelMilestone',
        level: 5,
        name: 'Sprout',
      }),
    ]);
  });

  it('shows each milestone once: from the day it is reached until closed, and not below its level', async () => {
    const records = await readerWith(xp('2026-10-13', 305));
    await earnOneXp((await run({ records, on: '2026-10-14' })).app);

    const nextDay = (await run({ records, on: '2026-10-15' })).app;
    expect(await milestonesIn(nextDay)).toEqual([expect.objectContaining({ level: 5 })]);
    await swipePastMilestone(nextDay);
    expect(await milestonesIn((await run({ records, on: '2026-10-16' })).app)).toEqual([]);

    const below = await readerWith(xp('2026-10-13', 300), xp('2026-10-14', 6));
    expect(await milestonesIn((await run({ records: below, on: '2026-10-13' })).app)).toEqual([]);
  });

  it('shows the milestones of levels 10 and 20, and none for the levels between', async () => {
    const at10 = await readerWith(xp('2026-10-13', 790), xp('2026-10-14', 8));
    const at20 = await readerWith(xp('2026-10-13', 1990), xp('2026-10-14', 8));
    const at11 = await readerWith(xp('2026-10-13', 910), xp('2026-10-14', 8));

    expect(await milestonesIn((await run({ records: at10 })).app)).toEqual([
      expect.objectContaining({ level: 10, name: 'Sapling' }),
    ]);
    expect(await milestonesIn((await run({ records: at20 })).app)).toEqual([
      expect.objectContaining({ level: 20, name: 'Grove' }),
    ]);
    // Level 11 brings no milestone of its own: the one of level 10, still open, comes first.
    expect(await milestonesIn((await run({ records: at11 })).app)).toEqual([
      expect.objectContaining({ level: 10 }),
    ]);
  });

  it('shows the milestone reached in a Game earlier that day', async () => {
    const records = await readerWith(xp('2026-10-13', 305));
    const { app } = await run({ records });

    await earnOneXp(app);

    expect(await milestonesIn(app)).toEqual([expect.objectContaining({ level: 5 })]);
  });

  it('shows no milestone while the levels Feature Switch is off or the reader hides the counters', async () => {
    const records = await readerWith(xp('2026-10-13', 300), xp('2026-10-14', 6));
    expect(await milestonesIn((await run({ records, off: ['levels'] })).app)).toEqual([]);

    const hiding = await openUserState({ port: createMemoryUserStatePort(records) });
    await hiding.write(userStateRecords.noCounters.change(true));
    expect(await milestonesIn((await run({ records })).app)).toEqual([]);
  });

  it('shows the milestone again once the reader turns the counters back on', async () => {
    const records = await readerWith(xp('2026-10-13', 300), xp('2026-10-14', 6));
    const userState = await openUserState({ port: createMemoryUserStatePort(records) });
    await userState.write(userStateRecords.noCounters.change(true));
    await userState.write(userStateRecords.noCounters.change(false));

    expect(await milestonesIn((await run({ records })).app)).toEqual([
      expect.objectContaining({ level: 5 }),
    ]);
  });

  it('shows the milestone to a reader who hid the Streak while «Без лічильників» is switched off', async () => {
    const records = await readerWith(xp('2026-10-13', 300), xp('2026-10-14', 6));
    const hiding = await openUserState({ port: createMemoryUserStatePort(records) });
    await hiding.write(userStateRecords.noCounters.change(true));

    expect(await milestonesIn((await run({ records, off: ['noCounters'] })).app)).toEqual([
      expect.objectContaining({ level: 5 }),
    ]);
  });
});

describe('the new Level event', () => {
  it('sends the new Level to the Analytics port once the reader reaches it', async () => {
    const { app, events } = await run({ records: await readerWith(xp('2026-10-13', 49)) });

    await earnOneXp(app);

    expect(events).toContainEqual(['levelReached', { level: 1 }]);
  });

  it('sends no new Level for XP within a level', async () => {
    const { app, events } = await run({ records: await readerWith(xp('2026-10-13', 10)) });

    await earnOneXp(app);

    expect(events.filter(([event]) => event === 'levelReached')).toEqual([]);
  });

  it('sends nothing while «Ділитися анонімною статистикою» is off', async () => {
    const records = await readerWith(xp('2026-10-13', 49));
    const sharing = await openUserState({ port: createMemoryUserStatePort(records) });
    await sharing.write(userStateRecords.shareCounters.change(false));
    const { app, events } = await run({ records });

    await earnOneXp(app);

    expect(app.xpLog.state.level?.level).toBe(1);
    expect(events).toEqual([]);
  });
});
