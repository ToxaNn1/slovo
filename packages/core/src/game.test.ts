import { describe, expect, it } from 'vitest';

import type { Example, PartOfSpeech, Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  GAME_LIVES,
  GAME_ROUNDS,
  openComposition,
  openUserState,
  renderStress,
  SEEN_DWELL_MS,
  userStateRecords,
  type Category,
  type Clock,
  type Composition,
  type ContentReadPort,
  type CurrentGame,
  type GameMode,
  type Random,
  type Round,
  type UserStateChanges,
  type UserStatePort,
} from './index';

function word(
  id: string,
  categoryId: string,
  {
    partOfSpeech = 'noun',
    lemma = id.slice(2),
    stress = [0],
    examples = [{ text: `An example of ${id.slice(2)}.`, author: 'An author' }],
    retired = false,
  }: {
    partOfSpeech?: PartOfSpeech;
    lemma?: string;
    stress?: number[];
    examples?: Example[];
    retired?: boolean;
  } = {},
): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress,
    partOfSpeech,
    primaryDefinition: `The meaning of ${id.slice(2)}.`,
    extraDefinitions: [],
    examples,
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId,
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired,
  };
}

/** The Edition's Categories, in its order. */
const nature: Category = { id: 'nature', displayName: 'Nature' };
const speech: Category = { id: 'speech', displayName: 'Speech' };
const crafts: Category = { id: 'crafts', displayName: 'Crafts' };
const categories = [nature, speech, crafts];

const numbered = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`);

/**
 * The pack: 14 nouns and 3 adjectives in Nature, 6 nouns, 2 verbs and two
 * homonyms (one Lemma, two Stresses) in Speech, 3 nouns in Crafts, and a
 * Retired noun. Two Words have no Example.
 */
const words = [
  ...numbered('w_nnoun', 14).map((id) => word(id, 'nature')),
  ...numbered('w_nadj', 3).map((id) => word(id, 'nature', { partOfSpeech: 'adjective' })),
  ...numbered('w_snoun', 6).map((id) =>
    word(id, 'speech', id === 'w_snoun01' || id === 'w_snoun02' ? { examples: [] } : {}),
  ),
  ...numbered('w_sverb', 2).map((id) => word(id, 'speech', { partOfSpeech: 'verb' })),
  word('w_kupyna1', 'speech', { lemma: 'kupyna', stress: [1] }),
  word('w_kupyna2', 'speech', { lemma: 'kupyna', stress: [4] }),
  ...numbered('w_cnoun', 3).map((id) => word(id, 'crafts')),
  word('w_retired', 'nature', { retired: true }),
];
const content = createMemoryContentPort({ words });

const byDefinition = new Map(words.map((w) => [w.primaryDefinition, w]));

/** The Word a Round asks about: the one whose primary Definition is its prompt. */
function answerOf(round: Round): Word {
  const answer = byDefinition.get(round.prompt);
  if (answer === undefined) throw new Error(`No Word has the Definition «${round.prompt}»`);
  return answer;
}

/** The Words a Round offers, in the order shown. */
const optionWordsOf = (round: Round) =>
  round.options.map(({ text }) => {
    const option = words.find((w) => renderStress(w) === text);
    if (option === undefined) throw new Error(`No Word reads «${text}»`);
    return option;
  });

/** The option that names the answer. */
const rightOf = (round: Round) =>
  round.options.findIndex(({ text }) => text === renderStress(answerOf(round)));

/** A seeded random port (a linear congruential generator), so every run draws the same. */
function seededRandom(seed: number): Random {
  let state = seed;
  return {
    next() {
      state = (state * 1_664_525 + 1_013_904_223) % 2 ** 32;
      return state / 2 ** 32;
    },
  };
}

const clock: Clock = {
  now: () => new Date('2026-10-11T09:00:00+03:00'),
  timeZone: () => 'Europe/Kyiv',
};

/** A user-state port over the records that keeps every write it is given. */
function recordingPort(records: Map<string, string>) {
  const port = createMemoryUserStatePort(records);
  const writes: UserStateChanges[] = [];
  return {
    writes,
    port: {
      ...port,
      write(changes) {
        writes.push(changes);
        return port.write(changes);
      },
    } satisfies UserStatePort,
  };
}

/** Waits until the Game has planned its offers, which it does once the composition is open. */
async function offersPlanned(app: Composition): Promise<Composition> {
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

/** The Core composition of one app run over the records. */
async function run({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  seed = 7,
  game = true,
  gameModes,
  time = clock,
  pack = content,
  planned = true,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  seed?: number;
  game?: boolean;
  gameModes?: readonly GameMode[];
  time?: Clock;
  pack?: ContentReadPort;
  /** Whether to wait for the Game to plan its offers. */
  planned?: boolean;
} = {}): Promise<Composition> {
  const app = await openComposition({
    content: pack,
    edition: {
      isFeatureEnabled: (feature) => feature === 'game' && game,
      categories,
      userSettingDefaults: {
        mix: { categoryIds: categories.map(({ id }) => id), corrections: false },
        notificationTimes: [],
      },
      languageTraits: { distractorRule: 'same-part-of-speech' },
    },
    userState: await openUserState({ port }),
    clock: time,
    random: seededRandom(seed),
    ...(gameModes === undefined ? {} : { gameModes }),
  });
  return planned ? offersPlanned(app) : app;
}

/** History records of the Words, as the Feed would have kept them. */
function historyOf(ids: readonly string[]): Map<string, string> {
  return new Map(
    ids.flatMap((id, index) => [
      ...userStateRecords.history.record(id).change({
        seenAt: new Date(Date.UTC(2026, 9, 1, 9, index)).toISOString(),
        wordOfTheDay: false,
      }),
    ]) as [string, string][],
  );
}

/** The Game in play; fails the test when there is none. */
function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

/** Answers the current Round right or wrong and taps «Далі». */
async function play(app: Composition, right: boolean, rightOption = rightOf): Promise<void> {
  const { round } = current(app);
  const option = rightOption(round);
  app.game.answer(right ? option : (option + 1) % round.options.length);
  await app.game.next();
}

/** Starts «Вгадай слово» and plays it to its end, wrong only in the Rounds listed (from 1). */
async function playGame(app: Composition, wrongIn: readonly number[] = []): Promise<Round[]> {
  await app.game.start('guess-word');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    rounds.push(current(app).round);
    await play(app, !wrongIn.includes(current(app).round.number));
  }
  return rounds;
}

describe('the Game Modes on offer', () => {
  it('offers «Вгадай слово», ready to start, and no Game in play', async () => {
    const app = await run();

    expect(app.game.state).toEqual({
      modes: [{ modeId: 'guess-word', entryKind: 'word', canStart: true }],
      current: undefined,
    });
  });

  it('offers no mode when the Edition turns the Game off', async () => {
    const app = await run({ game: false });

    expect(app.game.state.modes).toEqual([]);
  });

  it("says a mode can't start with fewer than 15 eligible Words, and can once there are again", async () => {
    const app = await run();
    // Nature alone has 17 Words; two hidden leave 15.
    await app.hide({ kind: 'category', categoryId: 'speech' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });
    await app.hide({ kind: 'entry', entryId: 'w_nnoun01' });
    await app.hide({ kind: 'entry', entryId: 'w_nnoun02' });
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);

    await app.hide({ kind: 'entry', entryId: 'w_nnoun03' });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ]);
    await app.game.start('guess-word');
    expect(app.game.state.current).toBeUndefined();

    await app.unhide({ kind: 'entry', entryId: 'w_nnoun03' });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);
  });
});

describe('a Round of «Вгадай слово»', () => {
  it("asks a Word's primary Definition, with four Lemmas with Stress, the answer among them", async () => {
    const app = await run();

    await app.game.start('guess-word');

    const game = current(app);
    expect(game).toMatchObject({
      modeId: 'guess-word',
      roundsPassed: 0,
      lives: GAME_LIVES,
      status: 'playing',
    });
    expect(game.round).toMatchObject({ number: 1, answer: undefined });
    expect(game.round.options).toHaveLength(4);
    const answer = answerOf(game.round);
    const options = optionWordsOf(game.round);
    expect(options).toContain(answer);
    expect(game.round.options.map((option) => option.stressedVowels)).toEqual(
      options.map((option) => [option.lemma[option.stress[0] ?? 0]]),
    );
  });

  it('shows the Lemma with its Stress and the first Example with its author once answered', async () => {
    const app = await run();
    await app.game.start('guess-word');
    const { round } = current(app);

    app.game.answer(rightOf(round));

    const answer = answerOf(round);
    expect(current(app).round.answer).toEqual({
      chosen: rightOf(round),
      correct: rightOf(round),
      sheet: {
        answer: { text: renderStress(answer), stressedVowels: [answer.lemma[0]] },
        example: { text: `An example of ${answer.id.slice(2)}.`, author: 'An author' },
      },
    });
  });

  it('shows the Lemma alone for a Word without an Example', async () => {
    const app = await run({ seed: 3 });
    const sheets = [];
    for (let game = 0; game < 4; game += 1) {
      await app.game.start('guess-word');
      while (current(app).status === 'playing') {
        const { round } = current(app);
        app.game.answer(rightOf(round));
        sheets.push({ answer: answerOf(round), sheet: current(app).round.answer?.sheet });
        await app.game.next();
      }
    }

    const withoutExample = sheets.filter(({ answer }) => answer.examples.length === 0);
    expect(withoutExample.length).toBeGreaterThan(0);
    for (const { answer, sheet } of withoutExample) {
      expect(sheet).toEqual({
        answer: { text: renderStress(answer), stressedVowels: [answer.lemma[0]] },
        example: undefined,
      });
    }
  });

  it("offers Distractors of the answer's part of speech first, then other Words", async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const app = await run({ seed });

      for (const round of await playGame(app)) {
        const answer = answerOf(round);
        const distractors = optionWordsOf(round).filter((option) => option !== answer);
        const samePartOfSpeech = words.filter(
          (w) => !w.retired && w.partOfSpeech === answer.partOfSpeech && w.lemma !== answer.lemma,
        );
        expect(distractors.filter((d) => d.partOfSpeech === answer.partOfSpeech)).toHaveLength(
          Math.min(3, samePartOfSpeech.length),
        );
      }
    }
  });

  it('tops the Distractors up with other Words when a narrow Mix has too few of the part of speech', async () => {
    const app = await run();
    await app.hide({ kind: 'category', categoryId: 'speech' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });

    const rounds = await playGame(app);

    // Nature has 14 nouns and 3 adjectives, so 15 Rounds ask about an adjective at least once.
    const adjectiveRounds = rounds.filter((round) => answerOf(round).partOfSpeech === 'adjective');
    expect(adjectiveRounds.length).toBeGreaterThan(0);
    for (const round of adjectiveRounds) {
      const partsOfSpeech = optionWordsOf(round).map((option) => option.partOfSpeech);
      expect(partsOfSpeech.toSorted()).toEqual(['adjective', 'adjective', 'adjective', 'noun']);
    }
  });

  it('never offers two options with the same Lemma, so homonyms never share a Round', async () => {
    let homonymRounds = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = await run({ seed });

      for (const round of await playGame(app)) {
        const lemmas = optionWordsOf(round).map((option) => option.lemma);
        expect(new Set(lemmas).size).toBe(4);
        if (answerOf(round).lemma === 'kupyna') homonymRounds += 1;
      }
    }
    expect(homonymRounds).toBeGreaterThan(0);
  });

  it('puts the answer in different places, as the random source has it', async () => {
    const app = await run();

    const places = (await playGame(app)).map(rightOf);

    expect(new Set(places).size).toBeGreaterThan(1);
  });
});

describe('the rules of a Game', () => {
  it('answers a Round once: a second answer changes nothing', async () => {
    const app = await run();
    await app.game.start('guess-word');
    const right = rightOf(current(app).round);
    app.game.answer(right);
    const answered = app.game.state;

    app.game.answer((right + 1) % 4);

    expect(app.game.state).toBe(answered);
    expect(current(app)).toMatchObject({ lives: 5, status: 'answered' });
  });

  it('takes a Life for a wrong answer at once, before «Далі»', async () => {
    const app = await run();
    await app.game.start('guess-word');
    const right = rightOf(current(app).round);

    app.game.answer((right + 1) % 4);

    expect(current(app)).toMatchObject({ lives: 4, roundsPassed: 0, status: 'answered' });
    expect(current(app).round.answer).toMatchObject({ chosen: (right + 1) % 4, correct: right });
  });

  it('counts a Round passed on «Далі», right or wrong, and moves to the next Round', async () => {
    const app = await run();
    await app.game.start('guess-word');

    await play(app, true);
    expect(current(app)).toMatchObject({ roundsPassed: 1, lives: 5, status: 'playing' });
    expect(current(app).round).toMatchObject({ number: 2, answer: undefined });

    await play(app, false);
    expect(current(app)).toMatchObject({ roundsPassed: 2, lives: 4, status: 'playing' });
    expect(current(app).round.number).toBe(3);
  });

  it('does nothing on «Далі» before the Round is answered', async () => {
    const app = await run();
    await app.game.start('guess-word');
    const playing = app.game.state;

    await app.game.next();

    expect(app.game.state).toBe(playing);
  });

  it('is won after the 15th Round, with 15 Rounds passed and every Life', async () => {
    const app = await run();

    const rounds = await playGame(app);

    expect(rounds).toHaveLength(GAME_ROUNDS);
    expect(current(app)).toMatchObject({ roundsPassed: 15, lives: 5, status: 'won' });
  });

  it('is won after the 15th Round with mistakes, as long as a Life is left', async () => {
    const app = await run();

    await playGame(app, [2, 6, 7, 15]);

    expect(current(app)).toMatchObject({ roundsPassed: 15, lives: 1, status: 'won' });
  });

  it.each([5, 9, 15])(
    'is lost when the fifth Life goes in Round %i, which is not counted as passed',
    async (lastRound) => {
      const app = await run();
      const wrong = [4, 3, 2, 1, 0].map((before) => lastRound - before);

      const rounds = await playGame(app, wrong);

      expect(rounds).toHaveLength(lastRound);
      expect(current(app)).toMatchObject({
        roundsPassed: lastRound - 1,
        lives: 0,
        status: 'lost',
      });
    },
  );

  it('ends a Game that lost its fifth Life only on «Далі»: the answered Round stays until then', async () => {
    const app = await run();
    await app.game.start('guess-word');
    for (let round = 1; round <= 4; round += 1) await play(app, false);
    const { round } = current(app);
    app.game.answer((rightOf(round) + 1) % 4);

    expect(current(app)).toMatchObject({ lives: 0, roundsPassed: 4, status: 'answered' });
    await app.game.next();
    expect(current(app)).toMatchObject({ lives: 0, roundsPassed: 4, status: 'lost' });
  });

  it('asks 15 different Words in one Game', async () => {
    for (const seed of [1, 2, 3]) {
      const app = await run({ seed });

      const answers = (await playGame(app)).map((round) => answerOf(round).id);

      expect(new Set(answers).size).toBe(GAME_ROUNDS);
    }
  });

  it('takes no answer and no «Далі» once the Game is over, and «Ще раз» starts a new one', async () => {
    const app = await run();
    await playGame(app);
    const over = app.game.state;

    app.game.answer(0);
    await app.game.next();
    expect(app.game.state).toBe(over);

    await app.game.start('guess-word');

    expect(current(app)).toMatchObject({ roundsPassed: 0, lives: 5, status: 'playing' });
    expect(current(app).round.number).toBe(1);
  });

  it("shows the mode screen, saying why, when «Ще раз» finds the mode can't start any more", async () => {
    const app = await run();
    await playGame(app);
    // Nature alone, with three of its Words hidden, leaves 14.
    await app.hide({ kind: 'category', categoryId: 'speech' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });
    for (const entryId of ['w_nnoun01', 'w_nnoun02', 'w_nnoun03']) {
      await app.hide({ kind: 'entry', entryId });
    }

    await app.game.start('guess-word');

    expect(app.game.state).toEqual({
      modes: [
        { modeId: 'guess-word', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
      ],
      current: undefined,
      bestResult: 15,
    });
  });

  it('goes back to the mode screen when the reader leaves a finished Game', async () => {
    const app = await run();
    await playGame(app);

    app.game.leave();

    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);
  });

  it('drops a Game left midway, in a Round or after an answer, and shows the mode screen', async () => {
    const app = await run();
    await app.game.start('guess-word');
    await play(app, false);

    app.game.leave();
    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);

    await app.game.start('guess-word');
    app.game.answer(0);
    expect(current(app).status).toBe('answered');

    app.game.leave();
    expect(app.game.state.current).toBeUndefined();
  });

  it('takes no answer and no «Далі» for a Game that was left', async () => {
    const app = await run();
    await app.game.start('guess-word');
    app.game.leave();
    const modeScreen = app.game.state;

    app.game.answer(0);
    await app.game.next();

    expect(app.game.state).toBe(modeScreen);
  });

  it('writes nothing to the user state when a Game is left, and allows a new Game from the start', async () => {
    const { port, writes } = recordingPort(new Map());
    const app = await run({ port });
    await app.game.start('guess-word');
    await play(app, false);
    await play(app, false);
    writes.length = 0;

    app.game.leave();
    await app.game.start('guess-word');

    expect(writes).toEqual([]);
    expect(current(app)).toMatchObject({
      roundsPassed: 0,
      lives: GAME_LIVES,
      status: 'playing',
      round: { number: 1, answer: undefined },
    });
  });

  it('tells its subscribers when a Game is left, and not when there is none', async () => {
    const app = await run();
    let changes = 0;
    app.game.subscribe(() => {
      changes += 1;
    });

    app.game.leave();
    expect(changes).toBe(0);

    await app.game.start('guess-word');
    app.game.leave();
    expect(changes).toBe(2);
  });

  it('tells its subscribers of every change', async () => {
    const app = await run();
    let changes = 0;
    app.game.subscribe(() => {
      changes += 1;
    });

    await app.game.start('guess-word');
    app.game.answer(0);
    await app.game.next();

    expect(changes).toBe(3);
  });
});

describe('the Words a Game asks about', () => {
  const met = numbered('w_nnoun', 14).concat('w_snoun03');

  it('asks only Words in History once 15 eligible ones are there, with Distractors from every eligible Word', async () => {
    const app = await run({ records: historyOf(met) });

    const rounds = await playGame(app);

    expect(rounds.map((round) => answerOf(round).id).toSorted()).toEqual(met.toSorted());
    const distractors = rounds.flatMap((round) =>
      optionWordsOf(round).filter((option) => option !== answerOf(round)),
    );
    expect(distractors.some((distractor) => !met.includes(distractor.id))).toBe(true);
  });

  it('keeps asking the Words in History in a new Cycle with nothing Seen yet', async () => {
    const records = new Map([
      ...historyOf(met),
      ...(userStateRecords.cycle.change({ id: 4, seed: 99 }) as Map<string, string>),
    ]);
    const app = await run({ records });

    const rounds = await playGame(app);

    expect(rounds.every((round) => met.includes(answerOf(round).id))).toBe(true);
  });

  it('asks every eligible Word while fewer than 15 eligible ones are in History', async () => {
    const app = await run({ records: historyOf(met) });
    // One of the 15 Hidden leaves 14 eligible Words in History.
    await app.hide({ kind: 'entry', entryId: 'w_snoun03' });

    const rounds = await playGame(app);

    expect(rounds.some((round) => !met.includes(answerOf(round).id))).toBe(true);
    expect(rounds.some((round) => answerOf(round).id === 'w_snoun03')).toBe(false);
  });

  it('never asks about or offers a Hidden Entry, a Word of a Hidden Category or a Retired Word', async () => {
    const left = ['w_nnoun01', 'w_cnoun01', 'w_cnoun02', 'w_cnoun03', 'w_retired'];
    for (const seed of [1, 2, 3, 4]) {
      const app = await run({ seed });
      await app.hide({ kind: 'entry', entryId: 'w_nnoun01' });
      await app.hide({ kind: 'category', categoryId: 'crafts' });

      for (const round of await playGame(app)) {
        const shown = optionWordsOf(round).map((option) => option.id);
        expect(shown.filter((id) => left.includes(id))).toEqual([]);
      }
    }
  });

  it('never asks about or offers an Entry hidden during the Game in the Rounds after', async () => {
    for (const seed of [1, 2, 3]) {
      const app = await run({ seed });
      await app.game.start('guess-word');
      await play(app, true);
      const hiddenWord = optionWordsOf(current(app).round)[0]?.id ?? '';
      await app.hide({ kind: 'category', categoryId: 'speech' });
      await app.hide({ kind: 'entry', entryId: hiddenWord });

      const later: Round[] = [];
      while (current(app).status === 'playing') {
        await play(app, true);
        if (current(app).status === 'playing') later.push(current(app).round);
      }

      expect(later).toHaveLength(GAME_ROUNDS - 2);
      for (const round of later) {
        const shown = optionWordsOf(round);
        expect(shown.filter((w) => w.categoryId === 'speech' || w.id === hiddenWord)).toEqual([]);
      }
    }
  });

  it('writes no Seen, no History and no Active Day while it is played, only its best result', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);
    const app = await run({ port });
    writes.length = 0;

    await playGame(app, [3, 4]);
    await playGame(app, [1, 2, 3, 4, 5]);

    expect(writes).toEqual([userStateRecords.gameBest.change(15)]);
    expect(app.history.list).toEqual([]);
  });
});

// Spec #215, "Best result": the most Rounds passed in one finished Game, in any Game Mode.
describe('the best result', () => {
  const { gameBest } = userStateRecords;

  it('is absent at first, on the Game and in the progress snapshot', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    expect(app.game.state.bestResult).toBeUndefined();
    expect(app.progress.state.bestResult).toBeUndefined();
    expect(records.has(gameBest.key)).toBe(false);
  });

  it('is written by the first finished Game, even the shortest loss', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    await playGame(app, [1, 2, 3, 4, 5]);

    expect(current(app)).toMatchObject({ roundsPassed: 4, status: 'lost' });
    expect(app.game.state.bestResult).toBe(4);
    expect(gameBest.decode(records.get(gameBest.key))).toBe(4);
  });

  it('is written by a finished Game that beats it, won or lost, and unchanged by one that does not', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);
    const app = await run({ port });
    writes.length = 0;

    // Lost in Round 8: 7 Rounds passed.
    await playGame(app, [3, 5, 6, 7, 8]);
    expect(app.game.state.bestResult).toBe(7);
    // Lost in Round 5: 4 Rounds passed, fewer than 7.
    await playGame(app, [1, 2, 3, 4, 5]);
    expect(app.game.state.bestResult).toBe(7);
    // Lost in Round 8 again: as many as 7, which doesn't beat it.
    await playGame(app, [1, 2, 3, 4, 8]);
    expect(app.game.state.bestResult).toBe(7);
    await playGame(app, [2]);
    expect(app.game.state.bestResult).toBe(15);

    expect(writes).toEqual([gameBest.change(7), gameBest.change(15)]);
    expect(gameBest.decode(records.get(gameBest.key))).toBe(15);
  });

  it('shows the Game just finished in the best result of the same snapshot', async () => {
    const app = await run({ records: gameBest.change(3) as Map<string, string> });
    const finished: { roundsPassed: number; bestResult: number | undefined }[] = [];
    app.game.subscribe(() => {
      const { current: game, bestResult } = app.game.state;
      if (game?.status === 'won' || game?.status === 'lost') {
        finished.push({ roundsPassed: game.roundsPassed, bestResult });
      }
    });

    await playGame(app, [9, 10, 11, 12, 13]);
    await playGame(app, [1, 2, 3, 4, 5]);

    expect(finished).toEqual([
      { roundsPassed: 12, bestResult: 12 },
      { roundsPassed: 4, bestResult: 12 },
    ]);
  });

  it('is never written by a Game left before its end', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);
    const app = await run({ port });
    writes.length = 0;
    await app.game.start('guess-word');
    for (let round = 1; round <= 10; round += 1) await play(app, true);
    // The fifth Life lost, but «Далі» not tapped: the Game isn't over yet.
    await app.game.start('guess-word');
    for (let round = 1; round <= 4; round += 1) await play(app, false);
    app.game.answer((rightOf(current(app).round) + 1) % 4);

    app.game.leave();

    expect(writes).toEqual([]);
    expect(app.game.state.bestResult).toBeUndefined();
  });

  it('keeps the Game as it was when the record fails to write, and finishes it on the next «Далі»', async () => {
    const records = new Map<string, string>();
    const memory = createMemoryUserStatePort(records);
    let failing = false;
    const app = await run({
      port: {
        ...memory,
        write: (changes) =>
          failing ? Promise.reject(new Error('The disk is full')) : memory.write(changes),
      },
    });
    await app.game.start('guess-word');
    for (let round = 1; round <= 4; round += 1) await play(app, false);
    app.game.answer((rightOf(current(app).round) + 1) % 4);
    const answered = app.game.state;

    failing = true;
    await expect(app.game.next()).rejects.toThrow('The disk is full');
    expect(app.game.state).toBe(answered);

    failing = false;
    await app.game.next();
    expect(current(app)).toMatchObject({ roundsPassed: 4, status: 'lost' });
    expect(app.game.state.bestResult).toBe(4);
    expect(gameBest.decode(records.get(gameBest.key))).toBe(4);
  });

  it('survives reopening, a new Cycle and a cleared History', async () => {
    const records = new Map<string, string>();
    await playGame(await run({ records }), [3, 5, 6, 7, 8]);
    let now = new Date('2026-10-12T09:00:00+03:00').getTime();
    const time: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
    const app = await run({ records, time });
    expect(app.game.state.bestResult).toBe(7);

    // Read every card, then the card after the end-of-Cycle card starts a new Cycle.
    while (app.feed.cards.at(-1)?.kind !== 'end-of-cycle') {
      await app.feed.show(app.feed.cards.length - 1);
      now += SEEN_DWELL_MS;
      await app.feed.show(undefined);
    }
    await app.feed.show(app.feed.cards.length - 1);
    await app.feed.show(undefined);
    await app.history.clear();

    expect(app.history.list).toEqual([]);
    expect(app.game.state.bestResult).toBe(7);
    expect(app.progress.state.bestResult).toBe(7);
    const reopened = await run({ records, time });
    expect(reopened.game.state.bestResult).toBe(7);
    expect(reopened.progress.state.bestResult).toBe(7);
  });

  it('shows in the progress snapshot, which tells its subscribers when it changes', async () => {
    const app = await run();
    const before = app.progress.state;
    let told = 0;
    app.progress.subscribe(() => {
      told += 1;
    });

    await playGame(app, [3, 5, 6, 7, 8]);

    expect(app.progress.state).toEqual({ ...before, bestResult: 7 });
    expect(told).toBe(1);
  });

  it('is absent on the Game and in the progress snapshot when the Edition turns the Game off', async () => {
    const app = await run({ records: gameBest.change(13) as Map<string, string>, game: false });

    expect(app.game.state.bestResult).toBeUndefined();
    expect(app.progress.state.bestResult).toBeUndefined();
  });
});

/** A Game Mode that asks for a Word's Lemma among three made-up ones, the answer always first. */
const lemmaMode: GameMode = {
  id: 'test-lemma',
  entryKind: 'word',
  isOn: () => true,
  buildRound: ({ answer }) => {
    if (answer.kind !== 'word') return undefined;
    const option = (text: string) => ({ text, stressedVowels: [] });
    return {
      prompt: answer.id,
      options: [option(answer.lemma), option('one'), option('two'), option('three')],
      correct: 0,
      sheet: { answer: option(answer.lemma), example: undefined },
    };
  },
};

describe('the Game Mode Extension Point', () => {
  it('plays a full Game in a Game Mode registered through it, after the Core modes', async () => {
    const app = await run({ gameModes: [lemmaMode] });
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      { modeId: 'test-lemma', entryKind: 'word', canStart: true },
    ]);

    await app.game.start('test-lemma');
    const prompts: string[] = [];
    while (current(app).status === 'playing') {
      prompts.push(current(app).round.prompt);
      await play(app, current(app).round.number !== 3, () => 0);
    }

    expect(current(app)).toMatchObject({
      modeId: 'test-lemma',
      roundsPassed: 15,
      lives: 4,
      status: 'won',
    });
    expect(new Set(prompts).size).toBe(GAME_ROUNDS);
  });

  it('leaves out a Game Mode the Edition turns off', async () => {
    const app = await run({ gameModes: [{ ...lemmaMode, isOn: () => false }] });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);
  });

  it("says a Game Mode that can't make its Rounds can't start, before a start and after it", async () => {
    const app = await run({ gameModes: [{ ...lemmaMode, buildRound: () => undefined }] });
    const offers = [
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      { modeId: 'test-lemma', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ];
    expect(app.game.state.modes).toEqual(offers);

    await app.game.start('test-lemma');

    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual(offers);
  });

  it('carries the Entry kind of a registered mode in its offer, with the refusal of that kind', async () => {
    const app = await run({
      gameModes: [{ ...lemmaMode, id: 'test-correction', entryKind: 'correction' }],
    });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      {
        modeId: 'test-correction',
        entryKind: 'correction',
        canStart: false,
        refusal: 'corrections-out-of-mix',
      },
    ]);
  });

  it("says a registered mode can't start with fewer than 15 eligible Entries of its kind", async () => {
    const app = await run({ gameModes: [lemmaMode] });
    await app.hide({ kind: 'category', categoryId: 'nature' });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
      { modeId: 'test-lemma', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ]);
  });

  it('refuses two Game Modes with one id', async () => {
    await expect(run({ gameModes: [{ ...lemmaMode, id: 'guess-word' }] })).rejects.toThrow(
      'guess-word',
    );
  });
});

describe('whether a Game Mode can start', () => {
  /**
   * A Game Mode that can make a fair Round only of a noun, so it may have 15
   * eligible Words and still too few Rounds.
   */
  const nounMode: GameMode = {
    ...lemmaMode,
    id: 'test-noun',
    buildRound: (input) =>
      input.answer.kind === 'word' && input.answer.partOfSpeech === 'noun'
        ? lemmaMode.buildRound(input)
        : undefined,
  };

  /** The mode's offer, and whether a start in it begins a Game; the Game is left after. */
  async function offerAndStart(app: Composition) {
    const offer = app.game.state.modes.find(({ modeId }) => modeId === 'test-noun');
    await app.game.start('test-noun');
    const started = app.game.state.current !== undefined;
    app.game.leave();
    return { offer, started };
  }

  it('says the offers are still planned just after the Game opens, and a start waits for them', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // The Game alone reads the Words in full, so only its planning waits.
    const pack: ContentReadPort = {
      ...content,
      async listWords() {
        await gate;
        return content.listWords();
      },
    };
    const app = await run({
      pack,
      planned: false,
      gameModes: [{ ...lemmaMode, buildRound: () => undefined }],
    });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: false, planning: true },
      { modeId: 'test-lemma', entryKind: 'word', canStart: false, planning: true },
    ]);
    const start = app.game.start('guess-word');
    release();
    await start;

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      { modeId: 'test-lemma', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ]);
    expect(current(app)).toMatchObject({ modeId: 'guess-word', status: 'playing' });
  });

  it("refuses a mode on its offer, before any start, when it can't make 15 fair Rounds", async () => {
    const app = await run({ gameModes: [nounMode] });
    // Nature alone: 17 eligible Words, of them 14 nouns.
    await app.hide({ kind: 'category', categoryId: 'speech' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });

    expect(await offerAndStart(app)).toEqual({
      offer: {
        modeId: 'test-noun',
        entryKind: 'word',
        canStart: false,
        refusal: 'too-few-entries',
      },
      started: false,
    });
  });

  it('offers what a start then does, after a hide, a restore and a Mix change', async () => {
    const app = await run({ gameModes: [nounMode] });
    const canStart = { modeId: 'test-noun', entryKind: 'word', canStart: true };
    const refused = { ...canStart, canStart: false, refusal: 'too-few-entries' };
    // Without Speech, the Mix holds 17 nouns among 20 Words.
    await app.mix.takeOut('speech');
    expect(await offerAndStart(app)).toEqual({ offer: canStart, started: true });

    // 14 nouns among 17 Words.
    for (const entryId of ['w_nnoun01', 'w_nnoun02', 'w_nnoun03']) {
      await app.hide({ kind: 'entry', entryId });
    }
    expect(await offerAndStart(app)).toEqual({ offer: refused, started: false });
    // A refused start changes nothing a later change reads differently.
    await app.hide({ kind: 'entry', entryId: 'w_nadj01' });
    expect(await offerAndStart(app)).toEqual({ offer: refused, started: false });

    // 15 nouns among 16 Words.
    await app.unhide({ kind: 'entry', entryId: 'w_nnoun01' });
    expect(await offerAndStart(app)).toEqual({ offer: canStart, started: true });

    await app.mix.takeOut('crafts');
    expect(await offerAndStart(app)).toEqual({ offer: refused, started: false });

    await app.mix.putBack('speech');
    expect(await offerAndStart(app)).toEqual({ offer: canStart, started: true });
  });

  /** The pack, keeping the name of each read in `reads`. */
  function countingPack(reads: string[]): ContentReadPort {
    return Object.fromEntries(
      Object.entries(content).map(([name, read]) => [
        name,
        (...args: never[]) => {
          reads.push(name);
          return (read as (...args: never[]) => unknown)(...args);
        },
      ]),
    ) as unknown as ContentReadPort;
  }

  it('reads the eligible Entries once for a start, whether it starts or not', async () => {
    const reads: string[] = [];
    const app = await run({
      pack: countingPack(reads),
      gameModes: [{ ...lemmaMode, buildRound: () => undefined }],
    });

    reads.length = 0;
    await app.game.start('guess-word');
    const started = [...reads];
    reads.length = 0;
    await app.game.start('test-lemma');

    // One read of the eligible ids, a query per Category in the Mix; the Words were read once already.
    expect(started).toEqual(['listWordIds', 'listWordIds', 'listWordIds']);
    expect(reads).toEqual(started);
  });

  it('reads the Words of the pack once a session, however often the offers are planned', async () => {
    const reads: string[] = [];
    const app = await run({ pack: countingPack(reads), gameModes: [lemmaMode] });

    await app.hide({ kind: 'entry', entryId: 'w_nnoun01' });
    await app.unhide({ kind: 'entry', entryId: 'w_nnoun01' });
    await app.mix.takeOut('speech');
    await app.game.start('guess-word');

    expect(reads.filter((name) => name === 'listWords')).toEqual(['listWords']);
  });
});
