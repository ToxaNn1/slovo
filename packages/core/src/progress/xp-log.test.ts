import { describe, expect, it } from 'vitest';
import type { XpTable } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  renderStress,
  type Composition,
  type CurrentGame,
  type FeatureSwitch,
  type Round,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, optionsOf, seededRandom, testEdition, word } from '../test-support';

// Spec #1358, ticket #1366, ADR 0066: the XP log and the XP the Game's learning actions earn.

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
}: {
  records?: Map<string, string>;
  off?: readonly FeatureSwitch[];
  time?: ReturnType<typeof fakeClock>;
  xp?: XpTable;
} = {}) {
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) =>
        !off.includes(feature) && ['game', 'gameGuessWord', 'xpLog'].includes(feature),
      ...(xp === undefined ? {} : { xp }),
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: seededRandom(7),
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
    expect(app.xpLog.state).toEqual({ total: 0, today: 0 });
    const heard: number[] = [];
    app.xpLog.subscribe(() => heard.push(app.xpLog.state.today));

    await app.game.start('guess-word');
    await play(app, true);
    await play(app, false);
    await play(app, true);

    expect(app.xpLog.state).toEqual({ total: 2, today: 2 });
    expect(heard).toEqual([1, 2]);
    expect(xpKeys(records)).toHaveLength(2);
  });

  it('adds 5 XP for a finished Game with half its answers right and 5 for its first Best result', async () => {
    const { app } = await run();

    const { right, played } = await playGame(app, [2, 4]);

    expect(right / played).toBeGreaterThanOrEqual(0.5);
    expect(app.xpLog.state).toEqual({ total: right + 5 + 5, today: right + 5 + 5 });
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
      xp: { round: 0, finishedGame: 5, finishedGameShare: 0.5, bestResult: 0 },
    });

    await playGame(app);

    expect(app.xpLog.state).toEqual({ total: 5, today: 5 });
    expect(xpKeys(records)).toHaveLength(1);
  });

  it('keeps 0.9 behaviour with the xpLog switch off: 0 XP and no record', async () => {
    const { app, records } = await run({ off: ['xpLog'] });

    await playGame(app);

    expect(app.xpLog.state).toEqual({ total: 0, today: 0 });
    expect(xpKeys(records)).toEqual([]);
    expect(records.has('game.best.guess-word')).toBe(true);
  });

  it('counts today in the clock’s time zone: yesterday’s XP leaves today on the day change', async () => {
    const time = fakeClock('2026-10-14T23:50:00+03:00');
    const { app } = await run({ time });
    await app.game.start('guess-word');
    await play(app, true);
    expect(app.xpLog.state).toEqual({ total: 1, today: 1 });

    time.set('2026-10-15T00:10:00+03:00');
    await app.resume();

    expect(app.xpLog.state).toEqual({ total: 1, today: 0 });
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

    expect(app.xpLog.state).toEqual({ total: 3, today: 3 });
  });
});
