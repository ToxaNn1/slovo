import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import { openComposition, type Composition, type CurrentGame, type Round } from '../index';
import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  seedUserState,
} from '../testing';
import { fakeClock, optionsOf, testEdition, word } from '../test-support';
import { createMemoryUserStatePort } from '../user-state/user-state';

// Spec #1778, ticket #1789: the current Game is in play, or over with how it ended.

const words: readonly Word[] = Array.from({ length: 24 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

const at = '2026-10-12T10:00:00.000Z';

/** Game records and an XP log entry kept before. */
const stored = {
  'game.best.timed': '2',
  'game.best.guess-word': '9',
  'game.widgetHintOffered': 'true',
  'xp.finished-before': `{"kind":"xp","date":"2026-10-12","at":"${at}","source":"game-finished","amount":10,"mode":"timed","right":2,"played":4}`,
};

/** The Core composition over the stored records, its clock moved by hand. */
async function open() {
  const records = new Map<string, string>(Object.entries(stored));
  const time = fakeClock('2026-10-14T08:00:00+03:00');
  let waiting: { at: number; run: () => void }[] = [];
  const app = await openComposition({
    content: createMemoryContentPort({ words: [...words] }),
    edition: testEdition({ isFeatureEnabled: () => true }),
    userState: await seedUserState({}, { port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    schedule: (run, delay) => {
      const timer = { at: time.clock.now().getTime() + delay, run };
      waiting.push(timer);
      return () => {
        waiting = waiting.filter((other) => other !== timer);
      };
    },
    random: { next: () => 0.25 },
    scheduling: {
      scheduler: createFakeNotificationScheduler(),
      ellipsis: '…',
      titles: ['{word}'],
      farewell: 'Farewell',
      streakWarning: 'Streak warning',
      goalNotMet: 'Goal not met',
    },
  });
  /** Moves the clock on, runs what is due by then and waits for the Game to settle. */
  async function pass(ms: number) {
    time.advance(ms);
    const now = time.clock.now().getTime();
    const due = waiting.filter((timer) => timer.at <= now);
    waiting = waiting.filter((timer) => !due.includes(timer));
    for (const { run } of due) run();
    await app.game.next();
  }
  return { app, records, pass };
}

function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

/** The option of the Round that names the Word it asks about. */
function rightOf(round: Round): number {
  const asked = words.find((each) => each.primaryDefinition === round.prompt);
  if (asked === undefined) throw new Error(`No Word asks «${round.prompt}»`);
  return optionsOf(round).findIndex(({ text }) => text.replace('́', '') === asked.lemma);
}

async function pick(app: Composition, right: boolean) {
  const { round } = current(app);
  const option = rightOf(round);
  await app.game.answer({
    form: 'pick',
    option: right ? option : (option + 1) % optionsOf(round).length,
  });
}

/** The XP log entries written since the stored ones. */
const written = (records: ReadonlyMap<string, string>) =>
  [...records].filter(([key]) => key.startsWith('xp.') && !(key in stored)).map(([, raw]) => raw);

describe('the current Game over the Game records kept before', () => {
  it('ends a timed Game as time up, with its end, and keeps its records in their format', async () => {
    const { app, records, pass } = await open();
    expect(app.game.state.bestResults).toEqual({ timed: 2, 'guess-word': 9 });
    await app.game.start('timed');
    for (const right of [true, true, false, true]) await pick(app, right);

    expect(current(app)).toMatchObject({ status: 'playing' });
    expect(current(app)).not.toHaveProperty('end');

    await pass(60_000);

    expect(current(app)).toMatchObject({
      status: 'time-up',
      time: { left: 0, endsAt: undefined },
      end: { kind: 'time-up', played: 4, right: 3, onTarget: true, newBest: true },
    });
    expect(records.get('game.best.timed')).toBe('3');
    expect(records.get('game.best.guess-word')).toBe('9');
    expect(records.get('game.widgetHintOffered')).toBe('true');
    expect(records.get('xp.finished-before')).toBe(stored['xp.finished-before']);
    expect(written(records).filter((raw) => raw.includes('"game-finished"'))).toEqual([
      expect.stringMatching(
        /^\{"kind":"xp","date":"2026-10-14","at":"[^"]+","source":"game-finished","amount":\d+,"mode":"timed","right":3,"played":4\}$/,
      ),
    ]);
  });

  it('ends a Game whose last Life is lost as Lives over, its Best result kept as it was', async () => {
    const { app, records } = await open();
    await app.game.start('guess-word');
    while (current(app).status !== 'lost') {
      await pick(app, false);
      await app.game.next();
    }

    expect(current(app)).toMatchObject({
      status: 'lost',
      lives: 0,
      end: { kind: 'lives-over', right: 0, newBest: false },
    });
    expect(current(app).end).not.toHaveProperty('onTarget');
    expect(records.get('game.best.guess-word')).toBe('9');
  });
});
