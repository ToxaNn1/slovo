import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  renderStress,
  userStateRecords,
  type AnalyticsPort,
  type Composition,
  type FeatureSwitch,
  type FeedCard,
  type Round,
  type XpRecord,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, optionsOf, seededRandom, testEdition, word } from '../test-support';

// Spec #1358 stories 10–13 and 85, ticket #1368, ADR 0066: the Level derived
// from total XP, its Edition name and the level-milestone Feed Notices.

const words = Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`));
const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test' }],
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
    track: (event, properties) => void events.push([event, properties]),
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
        mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: seededRandom(7),
    analytics: fake.port,
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

const rightOption = (round: Round) =>
  optionsOf(round).findIndex(({ text }) => {
    const answer = byDefinition.get(round.prompt);
    return answer !== undefined && text === renderStress(answer);
  });

/** Starts «Вгадай слово» and answers its first Round right, which earns 1 XP. */
async function earnOneXp(app: Composition): Promise<void> {
  while (app.game.state.modes.some((offer) => 'planning' in offer)) {
    await new Promise<void>((resolve) => {
      const stop = app.game.subscribe(() => {
        stop();
        resolve();
      });
    });
  }
  await app.game.start('guess-word');
  const round = app.game.state.current?.round;
  if (round === undefined || round.form === 'typed') throw new Error('No pick Round in play');
  await app.game.answer({ form: 'pick', option: rightOption(round) });
}

describe('the Level curve', () => {
  it('starts at level 0 with 50 XP to level 1', async () => {
    const { app } = await run();
    expect(app.xpLog.state.level).toEqual({ level: 0, name: 'Seed', progress: 0, toNext: 50 });
  });

  it('reaches level 1 at 50 XP, and level 2 costs 10% more', async () => {
    expect(await levelAt(49)).toEqual({ level: 0, name: 'Seed', progress: 49, toNext: 50 });
    expect(await levelAt(50)).toEqual({ level: 1, name: 'Seed', progress: 0, toNext: 55 });
    expect(await levelAt(104)).toMatchObject({ level: 1, progress: 54 });
    expect(await levelAt(105)).toEqual({ level: 2, name: 'Seed', progress: 0, toNext: 61 });
  });

  it('reaches level 5 at 306 XP and level 10 at 798 XP, each level rounded to whole XP', async () => {
    expect(await levelAt(305)).toMatchObject({ level: 4, progress: 72, toNext: 73 });
    expect(await levelAt(306)).toEqual({ level: 5, name: 'Sprout', progress: 0, toNext: 81 });
    expect(await levelAt(797)).toMatchObject({ level: 9, progress: 117, toNext: 118 });
    expect(await levelAt(798)).toEqual({ level: 10, name: 'Sapling', progress: 0, toNext: 120 });
  });

  it('costs 120 XP for every level after 10, with no top', async () => {
    expect(await levelAt(917)).toMatchObject({ level: 10, progress: 119, toNext: 120 });
    expect(await levelAt(918)).toMatchObject({ level: 11, progress: 0, toNext: 120 });
    expect(await levelAt(1998)).toEqual({ level: 20, name: 'Grove', progress: 0, toNext: 120 });
    expect(await levelAt(100_000)).toMatchObject({ level: 836, progress: 82, toNext: 120 });
  });

  it('names one name per five levels and keeps the last name above them', async () => {
    expect((await levelAt(1478))?.name).toBe('Tree'); // level 15
    expect((await levelAt(100_000))?.name).toBe('Grove');
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

  it('has no Level while the levels Feature Switch is off, or the XP log is', async () => {
    const records = await readerWith(xp('2026-10-01', 400));
    expect((await run({ records, off: ['levels'] })).app.xpLog.state.level).toBeUndefined();
    expect((await run({ records, off: ['xpLog'] })).app.xpLog.state.level).toBeUndefined();
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

  it('shows each milestone once: not on a later day, nor below its level', async () => {
    const records = await readerWith(xp('2026-10-13', 300), xp('2026-10-14', 6));

    expect(await milestonesIn((await run({ records, on: '2026-10-15' })).app)).toEqual([]);
    expect(await milestonesIn((await run({ records, on: '2026-10-13' })).app)).toEqual([]);
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
    expect(await milestonesIn((await run({ records: at11 })).app)).toEqual([]);
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
