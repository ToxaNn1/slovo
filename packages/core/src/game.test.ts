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
  userStateRecords,
  type Category,
  type Clock,
  type Composition,
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

/** The Core composition of one app run over the records. */
async function run({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  seed = 7,
  game = true,
  gameModes,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  seed?: number;
  game?: boolean;
  gameModes?: readonly GameMode[];
} = {}): Promise<Composition> {
  return openComposition({
    content,
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
    clock,
    random: seededRandom(seed),
    ...(gameModes === undefined ? {} : { gameModes }),
  });
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
      modes: [{ modeId: 'guess-word', canStart: true }],
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
    expect(app.game.state.modes).toEqual([{ modeId: 'guess-word', canStart: true }]);

    await app.hide({ kind: 'entry', entryId: 'w_nnoun03' });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', canStart: false, refusal: 'too-few-entries' },
    ]);
    await app.game.start('guess-word');
    expect(app.game.state.current).toBeUndefined();

    await app.unhide({ kind: 'entry', entryId: 'w_nnoun03' });

    expect(app.game.state.modes).toEqual([{ modeId: 'guess-word', canStart: true }]);
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
      modes: [{ modeId: 'guess-word', canStart: false, refusal: 'too-few-entries' }],
      current: undefined,
    });
  });

  it('goes back to the mode screen when the reader leaves a finished Game', async () => {
    const app = await run();
    await playGame(app);

    app.game.leave();

    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual([{ modeId: 'guess-word', canStart: true }]);
  });

  it('drops a Game left midway, in a Round or after an answer, and shows the mode screen', async () => {
    const app = await run();
    await app.game.start('guess-word');
    await play(app, false);

    app.game.leave();
    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual([{ modeId: 'guess-word', canStart: true }]);

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

  it('tells its subscribers once when a Game is left, and not when there is none', async () => {
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

  it('writes no Seen, no History and no Active Day while it is played', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);
    const app = await run({ port });
    writes.length = 0;

    await playGame(app, [3, 4]);
    await playGame(app, [1, 2, 3, 4, 5]);

    expect(writes).toEqual([]);
    expect(app.history.list).toEqual([]);
  });
});

describe('the Game Mode Extension Point', () => {
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

  it('plays a full Game in a Game Mode registered through it, after the Core modes', async () => {
    const app = await run({ gameModes: [lemmaMode] });
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', canStart: true },
      { modeId: 'test-lemma', canStart: true },
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

    expect(app.game.state.modes).toEqual([{ modeId: 'guess-word', canStart: true }]);
  });

  it("says a Game Mode that can't make its Rounds can't start", async () => {
    const app = await run({ gameModes: [{ ...lemmaMode, buildRound: () => undefined }] });

    await app.game.start('test-lemma');

    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', canStart: true },
      { modeId: 'test-lemma', canStart: false, refusal: 'too-few-entries' },
    ]);
  });

  it('refuses two Game Modes with one id', async () => {
    await expect(run({ gameModes: [{ ...lemmaMode, id: 'guess-word' }] })).rejects.toThrow(
      'guess-word',
    );
  });
});
