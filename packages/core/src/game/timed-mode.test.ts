import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import {
  buildGameReview,
  openComposition,
  type Composition,
  type CurrentGame,
  type Round,
  type Schedule,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, optionsOf, seededRandom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** A Word with an Example that holds its Lemma, which «Вгадай слово» would ask with a gap in Rounds 6–10. */
const wordOf = (index: number, categoryId = 'test'): Word => {
  const lemma = `word${String(index).padStart(2, '0')}`;
  return word(`w_${lemma}`, { categoryId, examples: [{ text: `They said ${lemma} here.` }] });
};

const allWords = Array.from({ length: 24 }, (_, index) => wordOf(index + 1));

/**
 * The clock of the test and a schedule that runs what is due as the test
 * moves the clock on, each run in the order it is due.
 */
function handTime() {
  const time = fakeClock();
  let waiting: { at: number; run: () => void }[] = [];
  const schedule: Schedule = (run, delay) => {
    const timer = { at: time.clock.now().getTime() + delay, run };
    waiting.push(timer);
    return () => {
      waiting = waiting.filter((other) => other !== timer);
    };
  };
  return {
    clock: time.clock,
    schedule,
    /** Moves the clock on and runs what is due by then. */
    advance(ms: number): void {
      time.advance(ms);
      const now = time.clock.now().getTime();
      const due = waiting.filter(({ at }) => at <= now).sort((one, other) => one.at - other.at);
      waiting = waiting.filter((timer) => !due.includes(timer));
      for (const { run } of due) run();
    },
    /** Moves the clock on and runs nothing, as when the schedule is late. */
    moveClock: (ms: number) => {
      time.advance(ms);
    },
  };
}

/** The Core composition of one app run, every Feature Switch on but those turned off. */
async function run({
  seed = 7,
  off = [],
  words = allWords,
  categoryIds = ['test'],
  time = handTime(),
}: {
  seed?: number;
  off?: readonly string[];
  words?: readonly Word[];
  categoryIds?: readonly string[];
  time?: ReturnType<typeof handTime>;
} = {}): Promise<Composition> {
  const app = await openComposition({
    content: createMemoryContentPort({ words: [...words] }),
    edition: testEdition({
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: { mix: { categoryIds: [...categoryIds] } },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: time.clock,
    schedule: time.schedule,
    random: seededRandom(seed),
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
  return app;
}

function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

const timedOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'timed');

/** The Word the Round asks about, by its Definition. */
function askedOf({ prompt }: Round): Word {
  const asked = allWords.find((each) => each.primaryDefinition === prompt);
  if (asked === undefined) throw new Error(`No Word asks «${prompt}»`);
  return asked;
}

// A Word's option carries its Stress mark.
const rightOf = (round: Round) =>
  optionsOf(round).findIndex(({ text }) => text.replace('́', '') === askedOf(round).lemma);

const wrongOf = (round: Round) => (rightOf(round) + 1) % optionsOf(round).length;

/**
 * Lets the play time pass, then waits for the Game to settle: «Далі» does
 * nothing in a Game that moves on, but waits its turn behind its end.
 */
async function pass(app: Composition, time: ReturnType<typeof handTime>, ms: number) {
  time.advance(ms);
  await app.game.next();
}

/** Answers the Round in play, right or wrong. */
async function pick(app: Composition, right: boolean): Promise<void> {
  const { round } = current(app);
  await app.game.answer({ form: 'pick', option: right ? rightOf(round) : wrongOf(round) });
}

describe('«На час» on offer', () => {
  it('is offered when the Edition turns the mode on, a bare number its Best result', async () => {
    const app = await run();

    expect(timedOffer(app)).toEqual({
      modeId: 'timed',
      entryKind: 'word',
      group: 'challenge',
      canStart: true,
    });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gameTimed'] });

    expect(timedOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 eligible Words", async () => {
    const app = await run({ words: allWords.slice(0, 14) });

    expect(timedOffer(app)).toEqual({
      modeId: 'timed',
      entryKind: 'word',
      group: 'challenge',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('timed');

    expect(app.game.state.current).toBeUndefined();
  });

  it("can't start while the Words in the Mix are too few, and can once their Category is back", async () => {
    const words = [
      ...allWords.slice(0, 10),
      ...allWords.slice(10).map((_, at) => wordOf(at + 11, 'other')),
    ];
    const app = await run({ words, categoryIds: ['test'] });

    expect(timedOffer(app)).toMatchObject({ canStart: false, refusal: 'too-few-entries' });

    await app.mix.putBack('other');

    expect(timedOffer(app)).toMatchObject({ canStart: true });
  });
});

describe('a Game of «На час»', () => {
  it('lasts 60 seconds of play, with no Lives, and asks Definition picks of Words', async () => {
    const time = handTime();
    const app = await run({ time });
    await app.game.start('timed');

    expect(current(app)).toMatchObject({
      lives: undefined,
      status: 'playing',
      timeLimit: 60_000,
      time: { left: 60_000, endsAt: new Date(time.clock.now().getTime() + 60_000) },
    });
    for (let answered = 0; answered < 5; answered += 1) {
      const { round } = current(app);
      expect(round.form).toBe('pick');
      expect(round.highlight).toBeUndefined();
      expect(askedOf(round).kind).toBe('word');
      await pick(app, true);
    }

    await pass(app, time, 59_999);

    expect(current(app).status).toBe('playing');

    await pass(app, time, 1);

    expect(current(app)).toMatchObject({ status: 'won', time: { left: 0, endsAt: undefined } });
  });

  it('moves on at once after an answer, right or wrong, with no answer sheet to wait on', async () => {
    const app = await run();
    await app.game.start('timed');

    await pick(app, false);

    expect(current(app)).toMatchObject({
      status: 'playing',
      round: { number: 2, answer: undefined },
    });

    await pick(app, true);

    expect(current(app)).toMatchObject({
      status: 'playing',
      round: { number: 3, answer: undefined },
    });
    expect(current(app).played.map(({ right }) => right)).toEqual([false, true]);
  });

  it('never ends on mistakes, and asks every eligible Word again once it has asked them all', async () => {
    const app = await run();
    await app.game.start('timed');

    for (let answered = 0; answered < allWords.length + 5; answered += 1) await pick(app, false);

    expect(current(app)).toMatchObject({ status: 'playing', lives: undefined });
    const ids = current(app).played.map((round) => askedOf(round).id);
    expect(new Set(ids.slice(0, allWords.length)).size).toBe(allWords.length);
  });

  it('stops its clock while paused in the background and runs it again on resume', async () => {
    const time = handTime();
    const app = await run({ time });
    await app.game.start('timed');
    await pass(app, time, 20_000);

    await app.game.pause();

    expect(current(app).time).toEqual({ left: 40_000, endsAt: undefined });

    await pass(app, time, 5 * 60_000);

    expect(current(app)).toMatchObject({ status: 'playing', time: { left: 40_000 } });

    await app.game.resume();

    expect(current(app).time).toEqual({
      left: 40_000,
      endsAt: new Date(time.clock.now().getTime() + 40_000),
    });

    await pass(app, time, 39_999);

    expect(current(app).status).toBe('playing');

    await pass(app, time, 1);

    expect(current(app).status).toBe('won');
  });

  it('takes no answer once its time is up, even before the schedule ends it', async () => {
    const time = handTime();
    const app = await run({ time });
    await app.game.start('timed');
    await pick(app, true);
    time.moveClock(60_000);

    await pick(app, true);

    expect(current(app)).toMatchObject({ status: 'won' });
    expect(current(app).played).toHaveLength(1);
    expect(app.game.state.bestResults['timed']).toBe(1);
  });

  it('keeps the right answers as its Best result, a bare number on its offer', async () => {
    const time = handTime();
    const app = await run({ time });
    await app.game.start('timed');
    for (const right of [true, false, true, true, false, true]) await pick(app, right);
    await pass(app, time, 60_000);

    expect(app.game.state.bestResults['timed']).toBe(4);
    expect(timedOffer(app)).toEqual({
      modeId: 'timed',
      entryKind: 'word',
      group: 'challenge',
      best: { result: 4 },
      canStart: true,
    });

    await app.game.start('timed');
    await pick(app, true);
    await pass(app, time, 60_000);

    expect(app.game.state.bestResults['timed']).toBe(4);
  });

  it('never counts a Game left before its end', async () => {
    const time = handTime();
    const app = await run({ time });
    await app.game.start('timed');
    for (let answered = 0; answered < 3; answered += 1) await pick(app, true);

    app.game.leave();
    await pass(app, time, 60_000);

    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.bestResults['timed']).toBeUndefined();
    expect(timedOffer(app)).toEqual({
      modeId: 'timed',
      entryKind: 'word',
      group: 'challenge',
      canStart: true,
    });
  });

  it('asks first about the Words the reader marked «Не знаю»', async () => {
    const app = await run();
    const weak = ['w_word07', 'w_word19', 'w_word23'];
    for (const id of weak) await app.knowledge.tap(id, 'unknown');
    await app.game.start('timed');

    for (const _ of weak) await pick(app, true);

    expect(
      current(app)
        .played.map((round) => askedOf(round).id)
        .sort(),
    ).toEqual(weak);
  });

  it('marks the Word of a wrong pick «Не знаю», moves no Review and lists it in the Game Review', async () => {
    const app = await run();
    await app.game.start('timed');
    const asked = askedOf(current(app).round);

    await pick(app, false);

    expect(app.knowledge.state.shown.get(asked.id)).toBe('unknown');
    expect(app.knowledge.state.due).toEqual([]);
    expect(buildGameReview(current(app).played)).toMatchObject([
      { number: 1, entryId: asked.id, right: false },
    ]);
  });
});
