import { describe, expect, it } from 'vitest';
import type { XpTable } from '@slovo/contracts';

import {
  createMemorySessionStore,
  createMemoryUserStatePort,
  openAccount,
  openComposition,
  openSync,
  openUserState,
  renderStress,
  trackChanges,
  userStateRecords,
  type AnalyticsPort,
  type Composition,
  type CurrentGame,
  type FeatureSwitch,
  type Round,
} from '../index';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  createMemoryContentPort,
} from '../testing';
import {
  fakeClock,
  optionsOf,
  randomOf,
  seededRandom,
  settle,
  testEdition,
  testSchedule,
  word,
} from '../test-support';

// Spec #1358, ticket #1366, ADR 0066: the XP log and the XP the Game's learning actions earn.
// Ticket #1372: the XP log syncs through the Account as a union by id.

const words = Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`));
const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test' }],
  words,
});
const byDefinition = new Map(words.map((w) => [w.primaryDefinition, w]));

/** The Word a Round asks about, by its Definition in the prompt. */
function answerOf(round: Round) {
  const answer = byDefinition.get(round.prompt);
  if (answer === undefined) throw new Error(`No Word has the Definition «${round.prompt}»`);
  return answer;
}

const rightOf = (round: Round) =>
  optionsOf(round).findIndex(({ text }) => text === renderStress(answerOf(round)));

/** The Core composition of one app run over the records, with the Game and the XP log on. */
async function run({
  records = new Map<string, string>(),
  off = [],
  time = fakeClock('2026-10-14T08:00:00+03:00'),
  xp,
  on = [],
  analytics,
}: {
  records?: Map<string, string>;
  off?: readonly FeatureSwitch[];
  time?: ReturnType<typeof fakeClock>;
  xp?: XpTable;
  /** Feature Switches on beside the Game and the XP log. */
  on?: readonly FeatureSwitch[];
  analytics?: AnalyticsPort;
} = {}) {
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) =>
        !off.includes(feature) && ['game', 'gameGuessWord', 'xpLog', ...on].includes(feature),
      ...(xp === undefined ? {} : { xp }),
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: seededRandom(7),
    ...(analytics === undefined ? {} : { analytics }),
  });
  const planning = () => app.game.state.modes.some((offer) => 'planning' in offer);
  if (planning()) {
    await new Promise<void>((resolve) => {
      const stop = app.game.subscribe(() => {
        if (planning()) return;
        stop();
        resolve();
      });
    });
  }
  return { app, records, time };
}

function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

/** Answers the current Round right or wrong and taps «Далі». */
async function play(app: Composition, right: boolean): Promise<void> {
  const { round } = current(app);
  if (round.form === 'typed') {
    await app.game.answer({ form: 'typed', text: right ? answerOf(round).lemma : 'no such word' });
  } else {
    const option = rightOf(round);
    await app.game.answer({
      form: 'pick',
      option: right ? option : (option + 1) % optionsOf(round).length,
    });
  }
  await app.game.next();
}

/**
 * Starts «Вгадай слово» and plays it to its end, wrong in the Rounds listed
 * (from 1): the right answers and the answers given, out of which the Game
 * ends by its Lives or its Round limit.
 */
async function playGame(
  app: Composition,
  wrongIn: readonly number[] = [],
): Promise<{ right: number; played: number }> {
  await app.game.start('guess-word');
  while (current(app).status === 'playing') {
    await play(app, !wrongIn.includes(current(app).round.number));
  }
  const { played } = current(app);
  return { right: played.filter(({ right }) => right).length, played: played.length };
}

const xpKeys = (records: Map<string, string>) =>
  [...records.keys()].filter((key) => key.startsWith('xp.'));

describe('the XP log and the Game', () => {
  it('starts at 0 XP and earns 1 XP for each Round answered right, none for a wrong one', async () => {
    const { app, records } = await run();
    expect(app.xpLog.state).toMatchObject({ total: 0, today: 0 });
    const heard: number[] = [];
    app.xpLog.subscribe(() => heard.push(app.xpLog.state.today));

    await app.game.start('guess-word');
    await play(app, true);
    await play(app, false);
    await play(app, true);

    expect(app.xpLog.state).toMatchObject({ total: 2, today: 2 });
    expect(heard).toEqual([1, 2]);
    expect(xpKeys(records)).toHaveLength(2);
  });

  it('adds 5 XP for a finished Game with half its answers right and 5 for its first Best result', async () => {
    const { app } = await run();

    const { right, played } = await playGame(app, [2, 4]);

    expect(right / played).toBeGreaterThanOrEqual(0.5);
    expect(app.xpLog.state).toMatchObject({ total: right + 5 + 5, today: right + 5 + 5 });
  });

  it('gives no bonus for a finished Game below half right, and none for a result that is not a new best', async () => {
    const { app } = await run();

    // Wrong in every second Round, so below half right; the first result is the Best result.
    const first = await playGame(app, [1, 2, 3, 5, 7, 9, 11, 13, 15]);
    expect(first.right / first.played).toBeLessThan(0.5);
    expect(app.xpLog.state.total).toBe(first.right + 5);

    // Fewer right than the Best result and below half: the Rounds alone.
    const second = await playGame(app, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15]);
    expect(second.right).toBeLessThan(first.right);
    expect(app.xpLog.state.total).toBe(first.right + 5 + second.right);
  });

  it('appends nothing for an action the Edition sets at 0 XP', async () => {
    const { app, records } = await run({
      xp: {
        round: 0,
        finishedGame: 5,
        finishedGameShare: 0.5,
        bestResult: 0,
        dailyCrossword: 15,
        reviewAnswer: 1,
        reviewDailyCap: 10,
        quickQuestion: 0,
      },
    });

    await playGame(app);

    expect(app.xpLog.state).toMatchObject({ total: 5, today: 5 });
    expect(xpKeys(records)).toHaveLength(1);
  });

  it('keeps 0.9 behaviour with the xpLog switch off: 0 XP and no record', async () => {
    const { app, records } = await run({ off: ['xpLog'] });

    await playGame(app);

    expect(app.xpLog.state).toMatchObject({ total: 0, today: 0 });
    expect(xpKeys(records)).toEqual([]);
    expect(records.has('game.best.guess-word')).toBe(true);
  });

  it('counts today in the clock’s time zone: yesterday’s XP leaves today on the day change', async () => {
    const time = fakeClock('2026-10-14T23:50:00+03:00');
    const { app } = await run({ time });
    await app.game.start('guess-word');
    await play(app, true);
    expect(app.xpLog.state).toMatchObject({ total: 1, today: 1 });

    time.set('2026-10-15T00:10:00+03:00');
    await app.resume();

    expect(app.xpLog.state).toMatchObject({ total: 1, today: 0 });
  });

  it('merges the logs of two devices by id, so no XP doubles', async () => {
    const one = await run();
    await one.app.game.start('guess-word');
    await play(one.app, true);
    await play(one.app, true);
    const other = await run({ time: fakeClock('2026-10-14T09:00:00+03:00') });
    await other.app.game.start('guess-word');
    await play(other.app, true);

    const merged = new Map([...one.records, ...other.records, ...one.records]);
    const { app } = await run({ records: merged });

    expect(app.xpLog.state).toMatchObject({ total: 3, today: 3 });
  });
});

// Ticket #1372, ADR 0066: XP log records merge as a set union by id across devices.

const EMAIL = 'anna@mail.com';

/**
 * One device of the Account on the fake backend: the Core composition over
 * its own records, with Sync beside it as the app shell opens it. It starts
 * signed in with a Session unless the test says otherwise.
 */
async function device(
  server: ReturnType<typeof createFakeBackend>,
  {
    time = fakeClock('2026-10-14T08:00:00+03:00'),
    signedIn = true,
    records = new Map<string, string>(),
  }: {
    time?: ReturnType<typeof fakeClock>;
    signedIn?: boolean;
    records?: Map<string, string>;
  } = {},
) {
  const timers = testSchedule(time);
  const userState = trackChanges({
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
  });
  // This install has run before, so the Account keeps the Session it finds.
  await userState.write(userStateRecords.installed.change(true));
  const account = await openAccount({
    backend: server.backend,
    edition: { id: 'uk' },
    googleSheet: createFakeGoogleSignInSheet(),
    appleSheet: createFakeAppleSignInSheet(),
    userState,
    sessions: createMemorySessionStore(
      signedIn
        ? { token: `session-of-${time.clock.now().toISOString()}`, email: EMAIL }
        : undefined,
    ),
    clock: time.clock,
    schedule: timers.schedule,
    random: randomOf(0.5),
  });
  const sync = await openSync({
    userState,
    backend: server.backend,
    account,
    edition: { id: 'uk', isFeatureEnabled: () => true },
    clock: time.clock,
    schedule: timers.schedule,
    random: randomOf(0.5),
  });
  const opened = await run({ records, time });
  return {
    app: opened.app,
    account,
    records,
    /** Earns XP in the Game: one Round answered right per XP. */
    async earn(xp: number): Promise<void> {
      await opened.app.game.start('guess-word');
      for (let round = 0; round < xp; round += 1) await play(opened.app, true);
    },
    /** Brings the app to the foreground, so Sync runs, and lets the sync end. */
    async syncNow(): Promise<void> {
      sync.foreground();
      await timers.advance(0);
    },
    /** Reopens the composition over the records, as the shell does after a sync wrote. */
    async reopened(): Promise<Composition> {
      return (await run({ records, time })).app;
    },
  };
}

const xpKept = (server: ReturnType<typeof createFakeBackend>) =>
  [...server.sync.records.keys()].filter((key) => key.startsWith('xp.'));

describe('the XP log and Sync', () => {
  it('sums the XP of two devices on one Account, with no record doubled', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const server = createFakeBackend({ clock: time.clock });
    const phone = await device(server, { time });
    const tablet = await device(server, { time: fakeClock('2026-10-14T09:00:00+03:00') });
    await phone.earn(2);
    await tablet.earn(1);

    await phone.syncNow();
    await tablet.syncNow();
    await phone.syncNow();

    expect((await phone.reopened()).xpLog.state).toMatchObject({ total: 3, today: 3 });
    expect((await tablet.reopened()).xpLog.state).toMatchObject({ total: 3, today: 3 });
    expect(xpKept(server)).toHaveLength(3);
    expect(xpKeys(phone.records).sort()).toEqual(xpKeys(tablet.records).sort());
  });

  it('keeps the sum once every device has synced again: a record pulled is never pushed back as new', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const server = createFakeBackend({ clock: time.clock });
    const phone = await device(server, { time });
    const tablet = await device(server, { time: fakeClock('2026-10-14T09:00:00+03:00') });
    await phone.earn(2);
    await tablet.earn(1);
    await phone.syncNow();
    await tablet.syncNow();
    await phone.syncNow();
    const kept = [...server.sync.records.entries()];

    await tablet.syncNow();
    await phone.syncNow();

    expect([...server.sync.records.entries()]).toEqual(kept);
    expect((await phone.reopened()).xpLog.state.total).toBe(3);
    expect((await tablet.reopened()).xpLog.state.total).toBe(3);
  });

  it('merges the XP earned before the first sign-in into the Account, beside what it holds', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const server = createFakeBackend({ clock: time.clock });
    const phone = await device(server, { time });
    await phone.earn(2);
    await phone.syncNow();
    const tablet = await device(server, {
      time: fakeClock('2026-10-14T09:00:00+03:00'),
      signedIn: false,
    });
    await tablet.earn(1);
    await tablet.syncNow();
    expect(xpKept(server)).toHaveLength(2);

    await tablet.account.requestCode(EMAIL);
    await tablet.account.verifyCode('100001');
    await tablet.syncNow();

    expect(xpKept(server)).toHaveLength(3);
    expect((await tablet.reopened()).xpLog.state).toMatchObject({ total: 3, today: 3 });
  });
});

/** Records of XP earned before the run: an amount on a local date at an instant, each under its own id. */
function earned(...xp: readonly [id: string, date: string, at: string, amount: number][]) {
  return new Map(
    xp.map(([id, date, at, amount]) => [
      `xp.${id}`,
      JSON.stringify({ kind: 'xp', date, at, source: 'game-round', amount }),
    ]),
  );
}

/** A port that keeps the events that reached it. */
function fakeAnalytics() {
  const events: [string, unknown][] = [];
  const port: AnalyticsPort = {
    track: (event, properties) => void events.push([event, properties]),
    stop: () => undefined,
  };
  return { port, events };
}

// Spec #1358 stories 15-20, ticket #1369, ADR 0066: the Daily Goal, recorded per day in the XP log.
describe('the Daily Goal', () => {
  const dailyGoal: readonly FeatureSwitch[] = ['dailyGoal'];

  it('starts at the Edition default of 20, met once today’s XP reaches it, and fires the celebration once', async () => {
    const { app } = await run({
      on: dailyGoal,
      records: earned(['a', '2026-10-14', '2026-10-14T04:00:00.000Z', 19]),
    });
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 20, met: false });
    let celebrations = 0;
    app.xpLog.subscribeGoalMet(() => (celebrations += 1));

    await app.game.start('guess-word');
    await play(app, true);
    expect(app.xpLog.state).toMatchObject({ today: 20, dailyGoal: { goal: 20, met: true } });
    await play(app, true);

    expect(celebrations).toBe(1);
  });

  it('applies a change from the same local day, and a day already met stays met', async () => {
    const { app } = await run({
      on: dailyGoal,
      records: earned(['a', '2026-10-14', '2026-10-14T04:00:00.000Z', 12]),
    });
    let celebrations = 0;
    app.xpLog.subscribeGoalMet(() => (celebrations += 1));

    await app.xpLog.setDailyGoal(10);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 10, met: true });
    expect(celebrations).toBe(1);

    await app.xpLog.setDailyGoal(50);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 50, met: true });
    expect(celebrations).toBe(1);
  });

  it('keeps today met after an app restart, with no second celebration', async () => {
    const records = earned(['a', '2026-10-14', '2026-10-14T04:00:00.000Z', 12]);
    const first = await run({ on: dailyGoal, records });
    await first.app.xpLog.setDailyGoal(10);
    await first.app.xpLog.setDailyGoal(30);

    const { app } = await run({ on: dailyGoal, records });
    let celebrations = 0;
    app.xpLog.subscribeGoalMet(() => (celebrations += 1));
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 30, met: true });
    await app.game.start('guess-word');
    await play(app, true);
    expect(celebrations).toBe(0);
  });

  it('leaves a past day the goal it had, and carries the last goal into the next days', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const records = earned(['a', '2026-10-14', '2026-10-14T04:00:00.000Z', 25]);
    const { app } = await run({ on: dailyGoal, records, time });
    await app.xpLog.setDailyGoal(30);
    // Met at 25 XP under the goal of 20, the day stays met under 30.
    expect(app.xpLog.dayOf('2026-10-14').dailyGoal).toEqual({ goal: 30, met: true });

    time.set('2026-10-16T08:00:00+03:00');
    await app.resume();
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 30, met: false });
    await app.xpLog.setDailyGoal(10);

    expect(app.xpLog.dayOf('2026-10-14')).toEqual({ xp: 25, dailyGoal: { goal: 30, met: true } });
    expect(app.xpLog.dayOf('2026-10-15')).toEqual({ xp: 0, dailyGoal: { goal: 30, met: false } });
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 10, met: false });
    expect(app.xpLog.dayOf('2026-10-13').dailyGoal).toEqual({ goal: 20, met: false });
  });

  it('records each goal set in the XP log, so it syncs with the log', async () => {
    const { app, records } = await run({ on: dailyGoal });
    await app.xpLog.setDailyGoal(50);

    const goals = xpKeys(records).map((key) => JSON.parse(records.get(key) ?? '') as unknown);
    expect(goals).toEqual([
      { kind: 'daily-goal', date: '2026-10-14', at: '2026-10-14T05:00:00.000Z', goal: 50 },
    ]);
  });

  it('has no goal and records none with its Feature Switch off', async () => {
    const { app, records } = await run();
    await app.xpLog.setDailyGoal(50);

    expect(app.xpLog.state.dailyGoal).toBeNull();
    expect(xpKeys(records)).toEqual([]);
  });

  it('emits «goal changed» and «goal met» through the analytics port, and none with sharing off', async () => {
    const shared = fakeAnalytics();
    const { app } = await run({
      on: [...dailyGoal, 'analytics'],
      analytics: shared.port,
      records: earned(['a', '2026-10-14', '2026-10-14T04:00:00.000Z', 12]),
    });
    await app.xpLog.setDailyGoal(10);
    await settle();
    expect(shared.events).toEqual([
      ['dailyGoalMet', { goal: 10 }],
      ['dailyGoalChanged', { goal: 10 }],
    ]);

    const silent = fakeAnalytics();
    const off = await run({
      on: [...dailyGoal, 'analytics'],
      analytics: silent.port,
      records: new Map([
        ...earned(['a', '2026-10-14', '2026-10-14T04:00:00.000Z', 12]),
        ['settings.shareCounters', 'false'],
      ]),
    });
    await off.app.xpLog.setDailyGoal(10);
    await settle();
    expect(off.app.xpLog.state.dailyGoal).toEqual({ goal: 10, met: true });
    expect(silent.events).toEqual([]);
  });
});
