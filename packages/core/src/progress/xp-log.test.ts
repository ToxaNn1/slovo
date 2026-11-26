import { describe, expect, it } from 'vitest';
import type { XpTable } from '@slovo/contracts';

import {
  createMemorySessionStore,
  openAccount,
  openComposition,
  openSync,
  type AnalyticsPort,
  type Composition,
  type CurrentGame,
  type Edition,
  type FeatureSwitch,
  type Round,
  type UserStatePort,
} from '../index';
import { renderStress } from '../entries/stress';
import { SEEN_DWELL_MS } from '../feed/feed';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  createMemoryContentPort,
} from '../testing';
import {
  correction,
  fakeClock,
  optionsOf,
  randomOf,
  seededRandom,
  settle,
  testEdition,
  testSchedule,
  word,
  analyticsInto,
} from '../test-support';
import { createMemoryUserStatePort, openUserState, type UserState } from '../user-state/user-state';
import { signInByCode } from '../fakes/fake-backend';
import { trackChanges } from '../user-state/tracked-user-state';
import { userStateRecords } from '../user-state-schema';

// Spec #1358, ticket #1366, ADR 0066: the XP log and the XP the Game's learning actions earn.
// Ticket #1372: the XP log syncs through the Account as a union by id.

const words = Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`));
const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words,
  corrections: [correction('c_00')],
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
  port = createMemoryUserStatePort(records),
  badges,
  userState,
}: {
  /** The user state the composition opens over, a new one over `port` unless given. */
  userState?: UserState;
  /** The Edition's Badges, none unless given. */
  badges?: Edition['badges'];
  records?: Map<string, string>;
  off?: readonly FeatureSwitch[];
  time?: ReturnType<typeof fakeClock>;
  xp?: XpTable;
  /** Feature Switches on beside the Game and the XP log. */
  on?: readonly FeatureSwitch[];
  analytics?: AnalyticsPort;
  /** The user state port, the memory port over the records unless given. */
  port?: UserStatePort;
} = {}) {
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) =>
        !off.includes(feature) && ['game', 'gameGuessWord', 'xpLog', ...on].includes(feature),
      ...(xp === undefined ? {} : { xp }),
      ...(badges === undefined ? {} : { badges }),
    }),
    userState: userState ?? (await openUserState({ port })),
    clock: time.clock,
    random: seededRandom(7),
    ...(analytics === undefined ? {} : { analytics: analyticsInto(analytics) }),
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
/** The kinds of the XP log records written, in the order written. */
const kindsOf = (records: Map<string, string>) =>
  [...records]
    .filter(([key]) => key.startsWith('xp.'))
    .map(([, value]) => (JSON.parse(value) as { kind: string }).kind);

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
    // The wrong answer's record earns nothing.
    expect(heard).toEqual([1, 1, 2]);
    expect(kindsOf(records)).toEqual(['xp', 'wrong-answer', 'xp']);
  });

  it('keeps the Rarity of the Word a Round answered right asked about', async () => {
    const { app } = await run();
    await app.game.start('guess-word');
    const { rarity } = answerOf(current(app).round);

    await play(app, true);

    expect(app.xpLog.milestones.rightRarities).toEqual(new Set([rarity]));
  });

  it('adds 5 XP for a finished Game with half its answers right and 5 for its first Best result', async () => {
    const { app } = await run();

    const { right, played } = await playGame(app, [2, 4]);

    expect(right / played).toBeGreaterThanOrEqual(0.5);
    expect(app.xpLog.state).toMatchObject({ total: right + 5 + 5, today: right + 5 + 5 });
  });

  it('gives no bonus for a finished Game below half right, and none for a result that is not a new best', async () => {
    const { app } = await run();

    // Two right in five Rounds, so below half right; the first result is the Best result.
    const first = await playGame(app, [1, 2, 5]);
    expect(first.right / first.played).toBeLessThan(0.5);
    expect(app.xpLog.state.total).toBe(first.right + 5);

    // Fewer right than the Best result and below half: the Rounds alone.
    const second = await playGame(app, [1, 2, 3]);
    expect(second.right).toBeLessThan(first.right);
    expect(app.xpLog.state.total).toBe(first.right + 5 + second.right);
  });

  it('gives no Best-result bonus for a first Game with no right answer', async () => {
    const { app, records } = await run();

    const { right, played } = await playGame(
      app,
      Array.from({ length: 30 }, (_, i) => i + 1),
    );

    expect(right).toBe(0);
    expect(played).toBeGreaterThan(0);
    expect(app.xpLog.state).toMatchObject({ total: 0, today: 0 });
    expect(kindsOf(records)).toEqual(Array.from({ length: played }, () => 'wrong-answer'));
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
        seenWord: 0,
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
    expect(records.has('game.bestRight.guess-word')).toBe(true);
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
    on = [],
    badges,
  }: {
    time?: ReturnType<typeof fakeClock>;
    signedIn?: boolean;
    records?: Map<string, string>;
    /** Feature Switches on beside the Game and the XP log. */
    on?: readonly FeatureSwitch[];
    badges?: Edition['badges'];
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
    edition: { id: 'uk', isFeatureEnabled: () => false },
    googleSheet: createFakeGoogleSignInSheet(),
    appleSheet: createFakeAppleSignInSheet(),
    userState,
    sessions: createMemorySessionStore(signedIn ? await signInByCode(server, EMAIL) : undefined),
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
  const options = { records, time, on, ...(badges === undefined ? {} : { badges }) };
  const opened = await run(options);
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
      return (await run(options)).app;
    },
    /** Reopens the composition over the user state Sync tracks, so what it writes is pushed on the next sync. */
    async tracked(): Promise<Composition> {
      return (await run({ ...options, userState })).app;
    },
  };
}

const xpKept = (server: ReturnType<typeof createFakeBackend>) =>
  [...server.sync.recordsOf(EMAIL).keys()].filter((key) => key.startsWith('xp.'));

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
    const kept = [...server.sync.recordsOf(EMAIL).entries()];

    await tablet.syncNow();
    await phone.syncNow();

    expect([...server.sync.recordsOf(EMAIL).entries()]).toEqual(kept);
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
    await tablet.account.verifyCode(server.account.sentCodes.at(-1)?.code ?? '');
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
    // The onboarding, which opens on a fresh user state, has events of its own.
    track: (event, properties) => {
      if (!event.startsWith('onboarding')) events.push([event, properties]);
    },
    stop: () => undefined,
  };
  return { port, events };
}

// Spec #1358 stories 15-20, ticket #1369, ADR 0066: the Daily Goal, recorded per day in the XP log.
/** History records of Entries Seen at the instants given, as the Feed writes them. */
function seen(...entries: readonly [id: string, at: string][]) {
  return new Map(
    entries.map(([id, at]) => [
      `history.${id}`,
      JSON.stringify({ seenAt: at, wordOfTheDay: false }),
    ]),
  );
}

/** Shows the last Feed card for the dwell time and takes it off screen: one more Entry Seen. */
async function look(app: Composition, time: ReturnType<typeof fakeClock>): Promise<void> {
  await app.feed.show(app.feed.cards.length - 1);
  time.advance(SEEN_DWELL_MS);
  await app.feed.show(undefined);
}

const recordsOf = (records: Map<string, string>) =>
  xpKeys(records).map((key) => [key, JSON.parse(records.get(key) ?? '') as unknown]);

// Ticket #1554: the Daily Goal counts the Words Seen on a local day.
describe('the Daily Goal', () => {
  const dailyGoal: readonly FeatureSwitch[] = ['dailyGoal'];

  it('is none until the reader sets one, and records nothing', async () => {
    const { app, records } = await run({ on: dailyGoal });

    expect(app.xpLog.state.dailyGoal).toBeNull();
    expect(app.xpLog.dayOf('2026-10-14').dailyGoal).toBeNull();
    expect(xpKeys(records)).toEqual([]);
  });

  it('keeps today’s Words Seen when History is cleared, also after a restart', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app, records } = await run({
      on: dailyGoal,
      time,
      records: seen(['w_00', '2026-10-14T04:00:00.000Z'], ['w_01', '2026-10-13T20:00:00.000Z']),
    });
    await app.xpLog.setDailyGoal(3);
    await look(app, time);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 3, seen: 2, met: false });

    await app.history.clear();
    expect(app.history.list).toEqual([]);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 3, seen: 2, met: false });

    const again = await run({ on: dailyGoal, time, records });
    expect(again.app.xpLog.state.dailyGoal).toEqual({ goal: 3, seen: 2, met: false });
    // The first card is the Word of the Day again, Seen before the clear; the next one is new.
    await look(again.app, time);
    await look(again.app, time);
    expect(again.app.xpLog.state.dailyGoal).toEqual({ goal: 3, seen: 3, met: true });
    // A second clear the same day adds to the first.
    await again.app.history.clear();
    expect(again.app.xpLog.state.dailyGoal).toEqual({ goal: 3, seen: 3, met: true });
  });

  it('counts today’s Words Seen, is met once they reach it, records it and fires the celebration once', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app, records } = await run({
      on: dailyGoal,
      time,
      records: seen(['w_00', '2026-10-14T04:00:00.000Z'], ['w_01', '2026-10-13T20:00:00.000Z']),
    });
    let celebrations = 0;
    app.xpLog.subscribeGoalMet(() => (celebrations += 1));
    await app.xpLog.setDailyGoal(2);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 2, seen: 1, met: false });

    await look(app, time);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 2, seen: 2, met: true });
    await look(app, time);

    expect(celebrations).toBe(1);
    expect(recordsOf(records)).toContainEqual([
      'xp.goal-met-2026-10-14',
      { kind: 'goal-met', date: '2026-10-14', at: expect.any(String) as string },
    ]);
  });

  it('counts Words only: another Entry Seen counts for nothing', async () => {
    const { app } = await run({
      on: [...dailyGoal, 'corrections'],
      records: seen(['w_00', '2026-10-14T04:00:00.000Z'], ['c_00', '2026-10-14T04:30:00.000Z']),
    });
    await app.xpLog.setDailyGoal(2);

    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 2, seen: 1, met: false });
  });

  it('applies a change from the same local day: lowered to today’s Words Seen it is met at once, with no celebration, and a met day stays met', async () => {
    const { app, records } = await run({
      on: dailyGoal,
      records: seen(['w_00', '2026-10-14T04:00:00.000Z'], ['w_01', '2026-10-14T04:10:00.000Z']),
    });
    let celebrations = 0;
    app.xpLog.subscribeGoalMet(() => (celebrations += 1));

    await app.xpLog.setDailyGoal(10);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 10, seen: 2, met: false });
    await app.xpLog.setDailyGoal(2);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 2, seen: 2, met: true });
    expect(xpKeys(records)).toContain('xp.goal-met-2026-10-14');
    await app.xpLog.setDailyGoal(50);

    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 50, seen: 2, met: true });
    // Setting the goal is no learning action: nothing celebrates.
    expect(celebrations).toBe(0);
  });

  it('keeps today met after an app restart, with no second celebration', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const records = seen(['w_00', '2026-10-14T04:00:00.000Z']);
    const first = await run({ on: dailyGoal, records, time });
    await first.app.xpLog.setDailyGoal(1);
    await first.app.xpLog.setDailyGoal(25);

    const { app } = await run({ on: dailyGoal, records, time });
    let celebrations = 0;
    app.xpLog.subscribeGoalMet(() => (celebrations += 1));
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 25, seen: 1, met: true });
    await look(app, time);
    expect(celebrations).toBe(0);
  });

  it('leaves a past day the goal it had, and carries the last goal into the next days', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app } = await run({ on: dailyGoal, time });
    await app.xpLog.setDailyGoal(25);

    time.set('2026-10-16T08:00:00+03:00');
    await app.resume();
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 25, seen: 0, met: false });
    await app.xpLog.setDailyGoal(10);

    expect(app.xpLog.dayOf('2026-10-14').dailyGoal).toEqual({ goal: 25, met: false });
    expect(app.xpLog.dayOf('2026-10-15').dailyGoal).toEqual({ goal: 25, met: false });
    expect(app.xpLog.dayOf('2026-10-16').dailyGoal).toEqual({ goal: 10, met: false });
    expect(app.xpLog.dayOf('2026-10-13').dailyGoal).toBeNull();
  });

  it('turns off from the same local day: today and the next days have none, a past day keeps its goal', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app, records } = await run({ on: dailyGoal, time });
    await app.xpLog.setDailyGoal(25);

    time.set('2026-10-16T08:00:00+03:00');
    await app.resume();
    await app.xpLog.setDailyGoal(null);

    expect(app.xpLog.state.dailyGoal).toBeNull();
    expect(app.xpLog.dayOf('2026-10-16').dailyGoal).toBeNull();
    expect(app.xpLog.dayOf('2026-10-15').dailyGoal).toEqual({ goal: 25, met: false });
    expect(recordsOf(records).map(([, record]) => record)).toContainEqual({
      kind: 'word-goal',
      date: '2026-10-16',
      at: '2026-10-16T05:00:00.000Z',
      goal: null,
    });

    time.set('2026-10-17T08:00:00+03:00');
    await app.resume();
    expect(app.xpLog.dayOf('2026-10-17').dailyGoal).toBeNull();
    await app.xpLog.setDailyGoal(10);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 10, seen: 0, met: false });
  });

  it('records each goal set in the XP log, so it syncs with the log', async () => {
    const { app, records } = await run({ on: dailyGoal });
    await app.xpLog.setDailyGoal(50);

    expect(recordsOf(records).map(([, record]) => record)).toEqual([
      { kind: 'word-goal', date: '2026-10-14', at: '2026-10-14T05:00:00.000Z', goal: 50 },
    ]);
  });

  it('keeps a day met as an Active Day with the Daily Goal off', async () => {
    const { app } = await run({
      records: new Map([
        [
          'xp.goal-met-2026-10-12',
          JSON.stringify({ kind: 'goal-met', date: '2026-10-12', at: '2026-10-12T05:00:00.000Z' }),
        ],
      ]),
    });

    expect(app.xpLog.days.active.has('2026-10-12')).toBe(true);
  });

  it('reads a goal in XP set before Words counted as no goal', async () => {
    const { app } = await run({
      on: dailyGoal,
      records: new Map([
        [
          'xp.old',
          JSON.stringify({
            kind: 'daily-goal',
            date: '2026-10-10',
            at: '2026-10-10T05:00:00.000Z',
            goal: 20,
          }),
        ],
      ]),
    });

    expect(app.xpLog.state.dailyGoal).toBeNull();
  });

  it('reads a past day the same whichever order its records at one instant come in', async () => {
    const record = (id: string, value: object) => [`xp.${id}`, JSON.stringify(value)] as const;
    const before = record('old', {
      kind: 'daily-goal',
      date: '2026-10-10',
      at: '2026-10-10T05:00:00.000Z',
      goal: 20,
    });
    const earned = record('2026-10-12-crossword', {
      kind: 'xp',
      date: '2026-10-12',
      at: '2026-10-12T05:00:00.000Z',
      source: 'daily-crossword',
      amount: 25,
    });
    // Raised at the instant the 25 XP were earned: the record keys order the two.
    const raised = record('raised', {
      kind: 'daily-goal',
      date: '2026-10-12',
      at: '2026-10-12T05:00:00.000Z',
      goal: 30,
    });
    const metIn = async (order: (typeof earned)[]) => {
      const { app } = await run({
        on: dailyGoal,
        records: new Map([before, ...order]),
        time: fakeClock('2026-10-15T08:00:00+03:00'),
      });
      return app.xpLog.dayOf('2026-10-12').dailyGoal?.met;
    };

    expect(await metIn([earned, raised])).toBe(true);
    expect(await metIn([raised, earned])).toBe(true);
  });

  it('keeps a past day met under a goal in XP set before Words counted', async () => {
    const record = (id: string, value: object) => [`xp.${id}`, JSON.stringify(value)] as const;
    const xp = (date: string, at: string, amount: number) =>
      record(`${date}-${at}`, { kind: 'xp', date, at, source: 'daily-crossword', amount });
    const { app } = await run({
      on: dailyGoal,
      records: new Map([
        record('old', {
          kind: 'daily-goal',
          date: '2026-10-10',
          at: '2026-10-10T05:00:00.000Z',
          goal: 20,
        }),
        xp('2026-10-11', '2026-10-11T05:00:00.000Z', 25),
        xp('2026-10-12', '2026-10-12T05:00:00.000Z', 10),
        // Lowered once the day's 10 XP were earned: met at that moment.
        record('lowered', {
          kind: 'daily-goal',
          date: '2026-10-12',
          at: '2026-10-12T06:00:00.000Z',
          goal: 10,
        }),
        record('raised', {
          kind: 'daily-goal',
          date: '2026-10-12',
          at: '2026-10-12T07:00:00.000Z',
          goal: 30,
        }),
        xp('2026-10-13', '2026-10-13T05:00:00.000Z', 20),
        // «Без цілі» from 10-14: no day from then on reads the goal in XP.
        record('off', {
          kind: 'word-goal',
          date: '2026-10-14',
          at: '2026-10-14T04:00:00.000Z',
          goal: null,
        }),
      ]),
      time: fakeClock('2026-10-15T08:00:00+03:00'),
    });

    expect(app.xpLog.dayOf('2026-10-09').dailyGoal).toBeNull();
    expect(app.xpLog.dayOf('2026-10-11').dailyGoal?.met).toBe(true);
    expect(app.xpLog.dayOf('2026-10-12').dailyGoal?.met).toBe(true);
    expect(app.xpLog.dayOf('2026-10-13').dailyGoal?.met).toBe(false);
    expect(app.xpLog.dayOf('2026-10-14').dailyGoal).toBeNull();
    expect(app.xpLog.dayOf('2026-10-15').dailyGoal).toBeNull();
  });

  it('has no goal and records none with its Feature Switch off', async () => {
    const { app, records } = await run();
    await app.xpLog.setDailyGoal(50);

    expect(app.xpLog.state.dailyGoal).toBeNull();
    expect(xpKeys(records)).toEqual([]);
  });

  it('emits «goal changed» and «goal met» through the analytics port, and none with sharing off', async () => {
    const today = seen(['w_00', '2026-10-14T04:00:00.000Z']);
    const shared = fakeAnalytics();
    const { app } = await run({
      on: [...dailyGoal, 'analytics'],
      analytics: shared.port,
      records: today,
    });
    await app.xpLog.setDailyGoal(1);
    await settle();
    expect(shared.events).toEqual([
      ['dailyGoalMet', { goal: 1 }],
      ['dailyGoalChanged', { goal: 1 }],
    ]);
    await app.xpLog.setDailyGoal(null);
    await settle();
    expect(shared.events.at(-1)).toEqual(['dailyGoalChanged', { goal: null }]);

    const silent = fakeAnalytics();
    const off = await run({
      on: [...dailyGoal, 'analytics'],
      analytics: silent.port,
      records: new Map([...today, ['settings.shareCounters', 'false']]),
    });
    await off.app.xpLog.setDailyGoal(1);
    await settle();
    expect(off.app.xpLog.state.dailyGoal).toEqual({ goal: 1, seen: 1, met: true });
    expect(silent.events).toEqual([]);
  });
});

describe('the Active Day with a Daily Goal', () => {
  const on: readonly FeatureSwitch[] = ['dailyGoal'];
  const fiveXp = earned(['a', '2026-10-14', '2026-10-14T04:00:00.000Z', 5]);

  it('is a day without a goal with at least 5 XP', async () => {
    const { app } = await run({ on, records: fiveXp });

    expect(app.xpLog.days.active).toEqual(new Set(['2026-10-14']));
  });

  it('is a day with a goal only once the goal is met, whatever the XP earned under it', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app } = await run({ on, time });
    await app.xpLog.setDailyGoal(1);
    await app.game.start('guess-word');
    for (let round = 0; round < 5; round += 1) await play(app, true);
    expect(app.xpLog.state.today).toBeGreaterThanOrEqual(5);
    expect(app.xpLog.days.active).toEqual(new Set());
    expect(app.progress.state.streak).toBe(0);

    await look(app, time);
    expect(app.xpLog.days.active).toEqual(new Set(['2026-10-14']));
    expect(app.progress.state.streak).toBe(1);
  });

  // App pass 7a, item 46: a Streak Badge earned on a day the goal set later took back.
  it('keeps a day that reached 5 XP before its goal was set an Active Day', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app } = await run({ on, time, records: new Map(fiveXp) });
    await app.xpLog.setDailyGoal(10);

    expect(app.xpLog.days.active).toEqual(new Set(['2026-10-14']));
    expect(app.progress.state.streak).toBe(1);
  });

  it('is a day with the goal turned off by the 5 XP rule, and a day met before it is turned off stays one', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app } = await run({ on, time });
    await app.xpLog.setDailyGoal(10);
    await app.game.start('guess-word');
    for (let round = 0; round < 5; round += 1) await play(app, true);
    expect(app.xpLog.days.active).toEqual(new Set());

    await app.xpLog.setDailyGoal(null);
    expect(app.xpLog.days.active).toEqual(new Set(['2026-10-14']));

    time.set('2026-10-15T08:00:00+03:00');
    await app.resume();
    await app.xpLog.setDailyGoal(1);
    await look(app, time);
    await app.xpLog.setDailyGoal(null);
    expect(app.xpLog.days.active).toEqual(new Set(['2026-10-14', '2026-10-15']));
  });

  it('keeps the past days as they were counted when a goal is set', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app } = await run({
      on,
      time,
      records: new Map([
        ...earned(['a', '2026-10-12', '2026-10-12T04:00:00.000Z', 5]),
        ...earned(['b', '2026-10-13', '2026-10-13T04:00:00.000Z', 5]),
      ]),
    });
    await app.xpLog.setDailyGoal(10);

    expect(app.xpLog.days.active).toEqual(new Set(['2026-10-12', '2026-10-13']));
  });

  it('keeps a Streak of 24 days counted by 5 XP once today’s goal, set today, is met', async () => {
    // The owner's phone, 14.11: 6 XP on each of 24 local days up to today, across the change of the clocks.
    const time = fakeClock('2026-11-14T18:00:00+02:00');
    const now = time.clock.now().getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const daysAgo = Array.from({ length: 24 }, (_, days) => days);
    const records = new Map(
      daysAgo.flatMap((days) =>
        [1, 2, 3].map((n) => {
          const date = new Date(Date.UTC(2026, 10, 14 - days)).toISOString().slice(0, 10);
          const at = new Date(now - days * dayMs).toISOString();
          return [
            `xp.dev-${date}-${String(n)}`,
            JSON.stringify({ kind: 'xp', date, at, source: 'quick-question', amount: 2 }),
          ] as const;
        }),
      ),
    );
    const { app } = await run({ on: [...on, 'seenWordXp', 'streakFreezes'], time, records });
    expect(app.progress.state.streak).toBe(24);

    time.advance(60_000);
    await app.xpLog.setDailyGoal(10);
    // Today reached 5 XP before its goal was set: it stays an Active Day.
    expect(app.progress.state.streak).toBe(24);
    for (let looks = 0; looks < 30 && app.xpLog.state.dailyGoal?.met !== true; looks += 1) {
      await look(app, time);
    }

    expect(app.xpLog.state.dailyGoal).toMatchObject({ goal: 10, met: true });
    expect(app.progress.state.streak).toBe(24);
    expect(
      (await run({ on: [...on, 'seenWordXp', 'streakFreezes'], time, records })).app.progress.state
        .streak,
    ).toBe(24);
  });
});

// Ticket #1555: 1 XP for every Word Seen for the first time, up to the Daily Goal.
describe('the Seen-Word XP', () => {
  const on: readonly FeatureSwitch[] = ['dailyGoal', 'seenWordXp'];

  /** An XP log record a device appended for a Word Seen for the first time. */
  const seenWord = (id: string, date: string, at: string, amount = 1) =>
    [
      `xp.seen-word-${id}`,
      JSON.stringify({ kind: 'xp', date, at, source: 'seen-word', amount }),
    ] as const;
  const goalSet = (goal: number, at: string) =>
    [`xp.goal-${at}`, JSON.stringify({ kind: 'word-goal', date: '2026-10-14', at, goal })] as const;

  it('earns 1 XP for each Word Seen for the first time while the day has a goal', async () => {
    const { app, time, records } = await run({ on });
    await app.xpLog.setDailyGoal(10);

    await look(app, time);
    await look(app, time);

    expect(app.xpLog.state.today).toBe(2);
    expect(app.xpLog.state.total).toBe(2);
    expect(xpKeys(records).filter((key) => key.startsWith('xp.seen-word-'))).toHaveLength(2);
  });

  // Ticket #2062, ADR 0202: the first Word of the onboarding is Seen before the Daily Goal step.
  it('earns the XP of the Words Seen earlier today with no goal once the goal is set, each once', async () => {
    const { app, time, records } = await run({ on });
    await look(app, time);
    await look(app, time);
    expect(app.xpLog.state.today).toBe(0);

    await app.xpLog.setDailyGoal(10);

    expect(app.xpLog.state.today).toBe(2);
    expect(xpKeys(records).filter((key) => key.startsWith('xp.seen-word-'))).toHaveLength(2);

    await app.xpLog.setDailyGoal(25);
    await app.xpLog.setDailyGoal(null);
    await app.xpLog.setDailyGoal(10);

    expect(app.xpLog.state.total).toBe(2);
    await look(app, time);
    expect(app.xpLog.state.total).toBe(3);
  });

  it('earns it after an app restart too, for today’s Words only', async () => {
    const { app } = await run({
      on,
      records: seen(['w_00', '2026-10-14T04:00:00.000Z'], ['w_01', '2026-10-13T20:00:00.000Z']),
    });

    await app.xpLog.setDailyGoal(10);

    expect(app.xpLog.state.today).toBe(1);
  });

  it('earns it up to the goal set, and nothing for a Word Seen past a goal in force', async () => {
    const { app, time } = await run({ on });
    for (let card = 0; card < 3; card += 1) await look(app, time);

    await app.xpLog.setDailyGoal(2);
    expect(app.xpLog.state.today).toBe(2);

    // Seen past the goal of 2, with a goal in force: a later goal earns nothing for it.
    await look(app, time);
    await app.xpLog.setDailyGoal(3);
    expect(app.xpLog.state.today).toBe(3);
    await app.xpLog.setDailyGoal(10);
    expect(app.xpLog.state.today).toBe(3);
  });

  it('earns nothing for the Words Seen earlier when the goal is turned off or the Seen-Word XP is off', async () => {
    const { app, time } = await run({ on });
    await look(app, time);
    await app.xpLog.setDailyGoal(null);
    expect(app.xpLog.state.today).toBe(0);

    const off = await run({ on: ['dailyGoal'] });
    await look(off.app, off.time);
    await off.app.xpLog.setDailyGoal(10);
    expect(off.app.xpLog.state.today).toBe(0);
  });

  it('earns the amount the Edition’s XP table holds', async () => {
    const { app, time } = await run({ on, xp: { ...testEdition().xp, seenWord: 3 } });
    await app.xpLog.setDailyGoal(10);

    await look(app, time);

    expect(app.xpLog.state.today).toBe(3);
  });

  it('stops at the goal in Words, not in XP, when a Word earns more than 1 XP', async () => {
    const { app, time } = await run({ on, xp: { ...testEdition().xp, seenWord: 3 } });
    await app.xpLog.setDailyGoal(2);

    for (let card = 0; card < 4; card += 1) await look(app, time);

    expect(app.xpLog.state.today).toBe(6);
  });

  it('counts merged Words up to the goal in Words, whatever XP each earned', async () => {
    const { app } = await run({
      on,
      records: new Map([
        goalSet(2, '2026-10-14T03:00:00.000Z'),
        seenWord('w_00', '2026-10-14', '2026-10-14T04:00:00.000Z', 3),
        seenWord('w_01', '2026-10-14', '2026-10-14T04:01:00.000Z', 3),
        seenWord('w_02', '2026-10-14', '2026-10-14T04:02:00.000Z', 3),
      ]),
    });

    expect(app.xpLog.dayOf('2026-10-14').xp).toBe(6);
  });

  it('writes no Seen-Word record past the goal in Words, counting the ones already kept today', async () => {
    const { app, time, records } = await run({
      on,
      records: new Map([
        goalSet(3, '2026-10-14T03:00:00.000Z'),
        seenWord('x_00', '2026-10-14', '2026-10-14T04:00:00.000Z'),
      ]),
    });
    const told: string[] = [];
    app.xpLog.subscribe((change) => told.push(change));

    for (let card = 0; card < 4; card += 1) await look(app, time);

    expect(xpKeys(records).filter((key) => key.startsWith('xp.seen-word-'))).toHaveLength(3);
    expect(app.xpLog.state.today).toBe(3);
    expect(told.length).toBeGreaterThan(0);
    expect(new Set(told)).toEqual(new Set(['other']));
  });

  // Ticket #2115: a Word Seen and its XP are one write, so no restart finds one without the other.
  it('keeps no Word Seen without its XP when the write fails and the app restarts', async () => {
    const records = new Map<string, string>();
    const memory = createMemoryUserStatePort(records);
    let failures = 1;
    const port: UserStatePort = {
      ...memory,
      write(changes) {
        const seenWordXp = [...changes.keys()].some((key) => key.startsWith('xp.seen-word-'));
        if (seenWordXp && failures > 0) {
          failures -= 1;
          return Promise.reject(new Error('disk full'));
        }
        return memory.write(changes);
      },
    };
    const { app, time } = await run({ on, records, port });
    await app.xpLog.setDailyGoal(10);
    await look(app, time).catch(() => undefined);
    // The write that failed kept nothing: the Word is not Seen and nothing is earned.
    expect([...records.keys()].filter((key) => key.startsWith('history.'))).toEqual([]);
    expect(app.xpLog.state).toMatchObject({ today: 0, dailyGoal: { seen: 0 } });

    const again = await run({ on, records, time });
    await look(again.app, time);

    const inHistory = [...records.keys()].filter((key) => key.startsWith('history.'));
    expect(inHistory.length).toBeGreaterThan(0);
    expect(xpKeys(records).filter((key) => key.startsWith('xp.seen-word-'))).toHaveLength(
      inHistory.length,
    );
    expect(again.app.xpLog.state.today).toBe(again.app.xpLog.state.dailyGoal?.seen);
  });

  it('earns nothing for an Entry that is not a Word', async () => {
    const { app, time } = await run({ on: [...on, 'corrections'] });
    await app.xpLog.setDailyGoal(50);

    for (let card = 0; card <= words.length; card += 1) await look(app, time);

    expect(app.xpLog.state.dailyGoal?.seen).toBe(words.length);
    expect(app.xpLog.state.today).toBe(words.length);
  });

  it('earns nothing for a Word already in History', async () => {
    const { app, time } = await run({
      on,
      records: seen(...words.map((w): [string, string] => [w.id, '2026-10-13T04:00:00.000Z'])),
    });
    await app.xpLog.setDailyGoal(10);

    await look(app, time);

    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 10, seen: 1, met: false });
    expect(app.xpLog.state.today).toBe(0);
  });

  it('earns nothing for a Word Seen in an earlier Cycle', async () => {
    const { app, time } = await run({
      on,
      records: new Map([['feed.cycle', '{"id":2,"seed":7}']]),
    });
    await app.xpLog.setDailyGoal(10);

    await look(app, time);

    expect(app.xpLog.state.dailyGoal?.seen).toBe(1);
    expect(app.xpLog.state.today).toBe(0);
  });

  it('earns nothing once today’s Seen-Word XP reaches the goal, while the Game still earns', async () => {
    const { app, time } = await run({ on });
    await app.xpLog.setDailyGoal(2);

    for (let card = 0; card < 4; card += 1) await look(app, time);
    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 2, seen: 4, met: true });
    expect(app.xpLog.state.today).toBe(2);

    await app.game.start('guess-word');
    for (let round = 0; round < 3; round += 1) await play(app, true);

    expect(app.xpLog.state.today).toBe(5);
  });

  it('earns nothing without a goal', async () => {
    const { app, time, records } = await run({ on });

    await look(app, time);

    expect(app.xpLog.state.total).toBe(0);
    expect(xpKeys(records)).toEqual([]);
  });

  it('earns nothing while its Feature Switch is off, and the goal still counts the Words Seen', async () => {
    const { app, time } = await run({ on: ['dailyGoal'] });
    await app.xpLog.setDailyGoal(1);

    await look(app, time);

    expect(app.xpLog.state.dailyGoal).toEqual({ goal: 1, seen: 1, met: true });
    expect(app.xpLog.state.total).toBe(0);
  });

  it('counts a Word Seen on two devices once when their XP logs merge', async () => {
    const phone = await run({ on });
    const tablet = await run({ on });
    for (const device of [phone, tablet]) {
      await device.app.xpLog.setDailyGoal(10);
      await look(device.app, device.time);
    }

    // Sync merges the XP logs as a union by record id.
    const merged = await run({ on, records: new Map([...phone.records, ...tablet.records]) });

    expect(phone.app.xpLog.state.today).toBe(1);
    expect(merged.app.xpLog.state.today).toBe(1);
  });

  it('counts up to the goal when two devices’ Words merge past it', async () => {
    const { app } = await run({
      on,
      records: new Map([
        goalSet(2, '2026-10-14T03:00:00.000Z'),
        seenWord('w_00', '2026-10-14', '2026-10-14T04:00:00.000Z'),
        seenWord('w_01', '2026-10-14', '2026-10-14T04:01:00.000Z'),
        seenWord('w_02', '2026-10-14', '2026-10-14T04:02:00.000Z'),
        seenWord('w_03', '2026-10-14', '2026-10-14T04:03:00.000Z'),
      ]),
    });

    expect(app.xpLog.state.today).toBe(2);
    expect(app.xpLog.state.total).toBe(2);
    expect(app.xpLog.dayOf('2026-10-14').xp).toBe(2);
  });
});

describe('the Daily Crossword solve in the XP log', () => {
  const solve = (date: string, extra: object = {}) =>
    [
      `xp.daily-crossword-${date}`,
      JSON.stringify({
        kind: 'xp',
        date,
        at: `${date}T05:00:00.000Z`,
        source: 'daily-crossword',
        amount: 15,
        ...extra,
      }),
    ] as const;

  it('reads a solve recorded before the Solve time as no time and no hint', async () => {
    const { app } = await run({ records: new Map([solve('2026-10-13')]) });

    expect(app.xpLog.crosswordSolveOn('2026-10-13')).toEqual({
      solveSeconds: undefined,
      hinted: false,
    });
    expect(app.xpLog.crosswordSolveOn('2026-10-14')).toBeUndefined();
  });

  it('reads the Solve time and the hint a synced record carries', async () => {
    const records = new Map([solve('2026-10-13', { solveSeconds: 95, hinted: true })]);
    const { app } = await run({ records });

    expect(app.xpLog.crosswordSolveOn('2026-10-13')).toEqual({ solveSeconds: 95, hinted: true });
  });

  it('keeps the Solve time and the hint of a solve it awards, still 15 XP', async () => {
    const { app } = await run();
    const award = app.xpLog.award({
      source: 'daily-crossword',
      date: '2026-10-14',
      solveSeconds: 222,
      hinted: false,
    });
    award.commit();

    expect(award.amount).toBe(15);
    expect(app.xpLog.crosswordSolveOn('2026-10-14')).toEqual({ solveSeconds: 222, hinted: false });
  });

  // Audit 1.4: a crossword opened before midnight and solved after is still that date's crossword.
  it('counts a Daily Crossword solved after midnight toward the run of its own date', async () => {
    const time = fakeClock('2026-10-13T23:50:00+03:00');
    const run2: Edition['badges'] = [
      {
        id: 'crosswords-2',
        name: 'Two in a row',
        symbol: '2',
        family: 'f',
        conditionText: 'A condition',
        condition: { kind: 'dailyCrosswordRun', days: 2 },
      },
    ];
    const { app } = await run({ time, on: ['badges', 'dailyCrossword'], badges: run2 });
    const solve = async (date: string) => {
      app.xpLog.award({ source: 'daily-crossword', date }).commit();
      await settle();
    };
    await solve('2026-10-13');
    time.advance((24 * 60 + 13) * 60_000);

    await solve('2026-10-14');

    expect(app.badges.state.filter((badge) => badge.earned).map(({ id }) => id)).toEqual([
      'crosswords-2',
    ]);
    // The XP is the day's it was earned on.
    expect(app.xpLog.dayOf('2026-10-15').xp).toBe(15);
    expect(app.xpLog.dayOf('2026-10-14').xp).toBe(0);
  });
});

// Ticket #1876: a Progress reset is a reset marker in the XP log.
const RESET_ON: readonly FeatureSwitch[] = [
  'progressReset',
  'levels',
  'dailyGoal',
  'badges',
  'streakFreezes',
  'streakBreak',
];
const FIRST_WIN: Edition['badges'] = [
  {
    id: 'win-words',
    name: 'First win',
    symbol: '1',
    family: 'f',
    conditionText: 'A condition',
    condition: { kind: 'gameWin', modes: ['guess-word'] },
  },
];
const DAY = 24 * 60 * 60 * 1000;

/** What a fresh install reads: no XP, no Streak, the 2 freezes of a new reader, no Badge, no Best result. */
function expectFresh(app: Composition): void {
  expect(app.xpLog.state).toMatchObject({ total: 0, today: 0, level: { level: 0, progress: 0 } });
  expect(app.progress.state).toMatchObject({
    streak: 0,
    bestStreak: 0,
    freezesHeld: 2,
    freezesUsed: 0,
    bestResult: undefined,
  });
  expect(app.badges.state.filter((badge) => badge.earned)).toEqual([]);
  expect(app.streakBreak.state.kind).toBe('available');
}

describe('the Progress reset', () => {
  it('reads as a fresh install after a reset and keeps everything that is not progress', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const server = createFakeBackend({ clock: time.clock });
    const phone = await device(server, { time, on: RESET_ON, badges: FIRST_WIN });
    await playGame(phone.app);
    time.advance(DAY);
    await phone.earn(6);
    const before = await phone.reopened();
    await before.xpLog.setDailyGoal(10);
    expect(before.xpLog.state.total).toBeGreaterThan(0);
    expect(before.progress.state.streak).toBeGreaterThan(0);
    expect(before.badges.state.some((badge) => badge.earned)).toBe(true);
    expect(before.progress.state.bestResult).toBeGreaterThan(0);
    const kept = new Map([...phone.records].filter(([key]) => !key.startsWith('xp.')));

    time.advance(60_000);
    await before.xpLog.reset();
    await settle();

    expectFresh(before);
    expectFresh(await phone.reopened());
    expect(before.xpLog.state.dailyGoal?.goal).toBe(10);
    expect(new Map([...phone.records].filter(([key]) => !key.startsWith('xp.')))).toEqual(kept);
  });

  it('counts the XP earned after a reset from zero and earns a Badge again', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app } = await run({ time, on: RESET_ON, badges: FIRST_WIN });
    await playGame(app);
    time.advance(60_000);
    await app.xpLog.reset();
    await settle();
    time.advance(60_000);

    await playGame(app);

    expect(app.xpLog.state.total).toBeGreaterThan(0);
    expect(app.progress.state.bestResult).toBeGreaterThan(0);
    expect(app.badges.state.filter((badge) => badge.earned).map(({ id }) => id)).toEqual([
      'win-words',
    ]);
  });

  // Audit 1.5: the id of a day's Review answer is made anew after a reset, as a met day's is.
  it('earns the XP of a Review answer again after a reset the same day', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app } = await run({ time, on: RESET_ON });
    const answer = () => {
      const award = app.xpLog.award({ source: 'review-answer', entryId: 'word-1' });
      award.commit();
      return award.amount;
    };
    const first = answer();
    expect(first).toBeGreaterThan(0);
    expect(answer()).toBe(0);
    time.advance(60_000);
    await app.xpLog.reset();
    await settle();
    time.advance(60_000);

    expect(answer()).toBe(first);
    expect(answer()).toBe(0);
    expect(app.xpLog.state.total).toBe(first);
  });

  // Audit 1121 a1.16: an award reads the clock once, so its id and its record name one local date.
  it('gives a Review answer earned as the day turns one local date, in its id and in its record', async () => {
    const time = fakeClock('2026-10-14T23:59:59.999+03:00');
    let ticking = false;
    /** A clock that moves a millisecond on with every reading, once ticking. */
    const clock = {
      now() {
        const now = time.clock.now();
        if (ticking) time.advance(1);
        return now;
      },
      timeZone: () => time.clock.timeZone(),
    };
    const { app } = await run({ time: { ...time, clock } });
    ticking = true;

    const award = app.xpLog.award({ source: 'review-answer', entryId: 'word-1' });
    ticking = false;

    const [[key, text] = []] = [...award.changes];
    const date = /review-answer-(\d{4}-\d{2}-\d{2})-word-1$/.exec(key ?? '')?.[1];
    expect(date).toBeDefined();
    expect(JSON.parse(text ?? '{}')).toMatchObject({ kind: 'xp', date });
  });

  it('counts only the Entries confirmed after a reset toward a Badge, and keeps the confirmed Entries', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const confirmedOne: Edition['badges'] = [
      {
        id: 'known-1',
        name: 'One',
        symbol: '1',
        family: 'f',
        conditionText: 'A condition',
        condition: { kind: 'confirmedEntries', entries: 1 },
      },
    ];
    const { app } = await run({
      time,
      on: [...RESET_ON, 'knowledge', 'confirmedEntries'],
      badges: confirmedOne,
    });
    await app.game.start('guess-word');
    await play(app, true);
    await settle();
    const confirmed = app.knowledge.state.confirmed.total;
    expect(confirmed).toBeGreaterThan(0);
    expect(app.badges.state[0]).toMatchObject({ earned: true });
    time.advance(60_000);

    await app.xpLog.reset();
    await settle();

    expect(app.badges.state[0]).toMatchObject({ earned: false, progress: { current: 0 } });
    expect(app.knowledge.state.confirmed.total).toBe(confirmed);
  });

  it('changes nothing with the progressReset switch off', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app, records } = await run({ time, on: ['levels'] });
    await app.game.start('guess-word');
    await play(app, true);
    const written = new Map(records);

    await app.xpLog.reset();

    expect(app.xpLog.state.total).toBe(1);
    expect(records).toEqual(written);
  });

  it.each(['the resetting device', 'the other device'])(
    'holds a reset made offline after both devices sync, %s first',
    async (first) => {
      const time = fakeClock('2026-10-14T08:00:00+03:00');
      const server = createFakeBackend({ clock: time.clock });
      const phone = await device(server, { time, on: RESET_ON });
      const tablet = await device(server, { time, on: RESET_ON });
      await phone.earn(3);
      await tablet.earn(2);
      await phone.syncNow();
      await tablet.syncNow();

      time.advance(60_000);
      await (await phone.tracked()).xpLog.reset();
      time.advance(60_000);
      const later = await tablet.tracked();
      await later.game.start('guess-word');
      await play(later, true);
      const order =
        first === 'the resetting device' ? [phone, tablet, phone] : [tablet, phone, tablet];
      for (const one of order) await one.syncNow();

      expect((await phone.reopened()).xpLog.state).toMatchObject({ total: 1, today: 1 });
      expect((await tablet.reopened()).xpLog.state).toMatchObject({ total: 1, today: 1 });
    },
  );
});
