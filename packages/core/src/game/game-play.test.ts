import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import type { AskableEntry, AskableKind, EligibleOfKind, ShownKind } from '../entries/entries';
import type { Random } from '../ports';
import { createSubject } from '../subject';
import { fakeClock, testEdition, testSchedule, word } from '../test-support';
import { buildGameReview } from './game-review';
import { LIFE_LOST_DELAY } from './game-haptics';
import { GAME_LIVES, openGame, type CurrentGame, type Game, type GivenAnswer } from './game';
import type { GameMode, RoundContent, RoundInput, RoundOption } from './game-mode';
import { GAME_ROUNDS } from './round-plan';

// The play of a Game through `openGame` (ADR 0052): the Rounds a Game Mode
// builds, the moves through them and what each leaves to show, over stub
// Game Modes and fakes. `game.test.ts` keeps the Game in the Core
// composition: the offers, the Knowledge Marks, the Best result and the play time.

const option = (text: string): RoundOption => ({ text, stressedVowels: [] });
const sheetOf = (text: string) => ({ answer: option(text), example: undefined });

/** Forty Words, `w_word01` to `w_word40`, more than two Games ask about. */
const words = Array.from({ length: 40 }, (_, index) =>
  word(`w_word${String(index + 1).padStart(2, '0')}`),
);

/** The Word at the place among them; fails the test past the last. */
function wordAt(index: number): Word {
  const found = words[index];
  if (found === undefined) throw new Error(`No Word at ${String(index)}`);
  return found;
}

const definitionsOf = (some: readonly Word[]) =>
  some.map(({ primaryDefinition }) => primaryDefinition);

/**
 * A random source whose every shuffle keeps the order, so the Rounds ask
 * about the eligible Words in the order they come.
 */
const inOrder: Random = { next: () => 0.99 };

/** Where the right option of every pick Round built here stands. */
const RIGHT = 1;
const WRONG = 2;

/** How a stub Game Mode builds a Round about a Word. */
type Build = (answer: Word, input: RoundInput) => RoundContent | undefined;

/** A pick Round about the Word: its Definition, its Lemma among three other eligible Words at `RIGHT`. */
const pick: Build = (answer, { eligible }) => {
  const options = eligible
    .filter(({ id }) => id !== answer.id)
    .slice(0, 3)
    .map(({ id }) => option(id.slice(2)));
  options.splice(RIGHT, 0, option(answer.lemma));
  return {
    form: 'pick',
    prompt: answer.primaryDefinition,
    options,
    correct: RIGHT,
    sheet: sheetOf(answer.lemma),
  };
};

/** A stub Game Mode of Words that builds its Rounds of each Word so. */
const mode = (build: Build, rest: Partial<GameMode> = {}): GameMode => ({
  id: 'test',
  entryKind: 'word',
  group: 'words',
  isOn: () => true,
  buildRound: (input) => (input.answer.kind === 'word' ? build(input.answer, input) : undefined),
  ...rest,
});

const never = { subscribe: () => () => undefined };

/**
 * The Game opened over the mode and the eligible Words, with `eligibleNow`
 * to change them as a hide, a restore or a Mix change does.
 */
async function open(gameMode: GameMode, eligibleAtStart: readonly Word[] = words) {
  let eligible: EligibleOfKind<AskableEntry> = { entries: eligibleAtStart };
  const eligibility = createSubject<undefined>();
  const time = fakeClock();
  function eligibleOfKind<Also extends AskableKind = never>(
    kind: ShownKind,
    alsoOf: readonly Also[] = [],
  ): Promise<EligibleOfKind<Extract<AskableEntry, { kind: ShownKind | Also }>>> {
    if ('refusal' in eligible) return Promise.resolve(eligible);
    return Promise.resolve({
      entries: eligible.entries.filter(
        (entry): entry is Extract<AskableEntry, { kind: ShownKind | Also }> =>
          entry.kind === kind || alsoOf.some((also) => also === entry.kind),
      ),
    });
  }
  const game = await openGame({
    edition: testEdition(),
    entries: { eligibleOfKind },
    history: { list: [] },
    knowledge: {
      weak: () => [],
      answer: () => Promise.resolve(),
      confirm: () => Promise.resolve(),
    },
    xp: { award: () => ({ changes: new Map(), amount: 0, commit: () => undefined }) },
    userState: { read: () => Promise.resolve(undefined), write: () => Promise.resolve() },
    clock: time.clock,
    random: inOrder,
    schedule: testSchedule(time).schedule,
    modes: [gameMode],
    eligibility,
    dayTurned: never,
    returned: never,
  });
  return {
    game,
    eligibleNow: async (now: EligibleOfKind<AskableEntry>) => {
      eligible = now;
      await eligibility.publish(undefined);
    },
  };
}

/** The Game in play or just over; fails the test on the mode screen. */
function now(game: Game): CurrentGame {
  const { current } = game.state;
  if (current === undefined) throw new Error('No Game in play');
  return current;
}

/** The Game started in the mode; fails the test when none starts. */
async function start(build: Build, rest: Partial<GameMode> = {}, eligible?: readonly Word[]) {
  const opened = await open(mode(build, rest), eligible);
  await opened.game.start('test');
  now(opened.game);
  return opened;
}

/** Checks that the move changes nothing: the Game stays the very same. */
async function noMove(game: Game, move: () => unknown): Promise<void> {
  const before = now(game);
  await move();
  expect(game.state.current).toBe(before);
}

/** The Game after the answer. */
async function answer(game: Game, given: GivenAnswer): Promise<CurrentGame> {
  await game.answer(given);
  return now(game);
}

/** The Game after «Далі». */
async function next(game: Game): Promise<CurrentGame> {
  await game.next();
  return now(game);
}

/** The answer to a pick Round built here, right or wrong. */
const pickAnswer = (right: boolean): GivenAnswer => ({
  form: 'pick',
  option: right ? RIGHT : WRONG,
});

/** The Game after an answer and «Далі». */
async function play(game: Game, right: boolean): Promise<CurrentGame> {
  await game.answer(pickAnswer(right));
  return next(game);
}

/** The Game played to its end, wrong only in the Rounds listed (from 1), and every Round shown. */
async function playOut(game: Game, wrongIn: readonly number[] = []) {
  let current = now(game);
  const rounds: CurrentGame['round'][] = [];
  while (current.status === 'playing') {
    rounds.push(current.round);
    current = await play(game, !wrongIn.includes(current.round.number));
  }
  return { over: current, rounds };
}

describe('the Rounds of a Game in play', () => {
  it('starts at the first Round with every Life, nothing played and no answer yet', async () => {
    const { game } = await start(pick);

    expect(now(game)).toMatchObject({
      modeId: 'test',
      roundsPassed: 0,
      roundLimit: GAME_ROUNDS,
      lives: GAME_LIVES,
      livesAtStart: GAME_LIVES,
      played: [],
      status: 'playing',
    });
    expect(now(game).round).toMatchObject({
      number: 1,
      entryKind: 'word',
      prompt: wordAt(0).primaryDefinition,
      form: 'pick',
      answer: undefined,
      lifeLostAfter: LIFE_LOST_DELAY,
    });
  });

  it('starts no Game when the mode makes fewer Rounds than a Game has, and its offer says why', async () => {
    const { game } = await open(mode(pick), words.slice(0, GAME_ROUNDS - 1));

    await game.start('test');

    expect(game.state.current).toBeUndefined();
    expect(game.state.modes).toMatchObject([
      { modeId: 'test', canStart: false, refusal: 'too-few-entries' },
    ]);
  });

  it('answers a Round once: a second answer is no move', async () => {
    const { game } = await start(pick);
    const answered = await answer(game, pickAnswer(true));

    await noMove(game, () => game.answer(pickAnswer(false)));
    expect(answered).toMatchObject({ lives: GAME_LIVES, status: 'answered' });
  });

  it('takes a Life for a wrong answer at once, before «Далі»', async () => {
    const { game } = await start(pick);

    const answered = await answer(game, pickAnswer(false));

    expect(answered).toMatchObject({ lives: GAME_LIVES - 1, roundsPassed: 0, status: 'answered' });
    expect(answered.round.answer).toMatchObject({ chosen: WRONG, correct: RIGHT, right: false });
  });

  it('counts a Round passed on «Далі», right or wrong, and moves to the next Round', async () => {
    const { game } = await start(pick);

    const second = await play(game, true);
    expect(second).toMatchObject({ roundsPassed: 1, lives: GAME_LIVES, status: 'playing' });
    expect(second.round).toMatchObject({ number: 2, answer: undefined });

    const third = await play(game, false);
    expect(third).toMatchObject({ roundsPassed: 2, lives: GAME_LIVES - 1, status: 'playing' });
    expect(third.round.number).toBe(3);
  });

  it('is no move on «Далі» before the Round is answered', async () => {
    const { game } = await start(pick);

    await noMove(game, () => game.next());
  });

  it('is won after the 15th Round, with 15 Rounds passed and every Life', async () => {
    const { game } = await start(pick);
    const { over, rounds } = await playOut(game);

    expect(rounds).toHaveLength(GAME_ROUNDS);
    expect(over).toMatchObject({ roundsPassed: 15, lives: GAME_LIVES, status: 'won' });
  });

  it('is won after the 15th Round with mistakes, as long as a Life is left', async () => {
    const { game } = await start(pick);
    const { over } = await playOut(game, [2, 6, 7, 15]);

    expect(over).toMatchObject({ roundsPassed: 15, lives: 1, status: 'won' });
  });

  it.each([5, 9, 15])(
    'is lost when the fifth Life goes in Round %i, which is not counted as passed',
    async (lastRound) => {
      const wrong = [4, 3, 2, 1, 0].map((before) => lastRound - before);
      const { game } = await start(pick);

      const { over, rounds } = await playOut(game, wrong);

      expect(rounds).toHaveLength(lastRound);
      expect(over).toMatchObject({ roundsPassed: lastRound - 1, lives: 0, status: 'lost' });
    },
  );

  it('ends a Game that lost its fifth Life only on «Далі»: the answered Round stays until then', async () => {
    const { game } = await start(pick);
    for (let round = 1; round <= 4; round += 1) await play(game, false);

    const answered = await answer(game, pickAnswer(false));

    expect(answered).toMatchObject({ lives: 0, roundsPassed: 4, status: 'answered' });
    expect(await next(game)).toMatchObject({ lives: 0, roundsPassed: 4, status: 'lost' });
  });

  it('takes no answer and no «Далі» once the Game is over', async () => {
    const { game } = await start(pick);
    const { over } = await playOut(game, [1, 2, 3, 4, 5]);

    expect(over.status).toBe('lost');
    await noMove(game, () => game.answer(pickAnswer(true)));
    await noMove(game, () => game.next());
  });

  it("lists every played Round in order with its Entry, the reader's pick and whether it was right", async () => {
    const { game } = await start(pick);
    const { over, rounds } = await playOut(game, [2, 5]);

    expect(over.played).toHaveLength(GAME_ROUNDS);
    expect(over.played.map(({ number }) => number)).toEqual(rounds.map(({ number }) => number));
    over.played.forEach((played, index) => {
      const wrong = [2, 5].includes(played.number);
      expect(played.entry).toBe(wordAt(index));
      expect(played.right).toBe(!wrong);
      expect(played.answer).toMatchObject({ correct: RIGHT, chosen: wrong ? WRONG : RIGHT });
      expect(played.prompt).toBe(rounds[index]?.prompt);
    });
  });

  it('lists the Round that cost the last Life as the last played Round of a lost Game', async () => {
    const { game } = await start(pick);
    const { over } = await playOut(game, [1, 2, 3, 4, 5]);

    expect(over.status).toBe('lost');
    expect(over.played.map(({ number, right }) => [number, right])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, false],
      [5, false],
    ]);
  });

  it('lists the Rounds answered so far while the Game is in play, and none before the first answer', async () => {
    const { game } = await start(pick);
    expect(now(game).played).toEqual([]);

    await play(game, true);
    const answered = await answer(game, pickAnswer(false));

    expect(answered.played.map(({ number, right }) => [number, right])).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it('takes no answer that names an option the Round has not', async () => {
    const { game } = await start(pick);

    await noMove(game, () => game.answer({ form: 'pick', option: 4 }));
    await noMove(game, () => game.answer({ form: 'pick', option: -1 }));
  });
});

describe('the Lives and the Round limit a Game Mode sets', () => {
  it('starts with the Lives the mode sets, and is lost on the mistake that takes the last one', async () => {
    const { game } = await start(pick, { lives: 3 });
    expect(now(game)).toMatchObject({ lives: 3, livesAtStart: 3, status: 'playing' });

    await play(game, false);
    await play(game, true);
    const third = await play(game, false);
    expect(third).toMatchObject({ roundsPassed: 3, lives: 1, status: 'playing' });

    const over = await play(game, false);
    expect(over).toMatchObject({ roundsPassed: 3, lives: 0, status: 'lost' });
    expect(over.played).toHaveLength(4);
  });

  it('never ends on mistakes in a mode with no Lives, and shows none', async () => {
    const { game } = await start(pick, { lives: 'none' });
    expect(now(game).lives).toBeUndefined();
    expect(now(game).livesAtStart).toBeUndefined();

    const { over } = await playOut(
      game,
      Array.from({ length: GAME_ROUNDS }, (_, index) => index + 1),
    );

    expect(over).toMatchObject({ roundsPassed: 15, lives: undefined, status: 'won' });
    expect(over.played.every(({ right }) => !right)).toBe(true);
  });

  it('is won after the Rounds of the limit the mode sets', async () => {
    const { game } = await start(pick, { roundLimit: 10 });
    expect(now(game).roundLimit).toBe(10);

    const { over, rounds } = await playOut(game);

    expect(rounds).toHaveLength(10);
    expect(over).toMatchObject({ roundsPassed: 10, lives: GAME_LIVES, status: 'won' });
  });

  it('plans 15 more Rounds about Entries not asked yet each time a mode with no Round limit runs out, then asks about them again', async () => {
    const { game } = await start(pick, { roundLimit: 'none' });
    expect(now(game).roundLimit).toBeUndefined();

    const prompts: string[] = [];
    for (let round = 1; round <= 45; round += 1) {
      prompts.push(now(game).round.prompt);
      await play(game, true);
    }

    expect(prompts).toEqual(definitionsOf([...words, ...words.slice(0, 5)]));
    expect(now(game)).toMatchObject({ roundsPassed: 45, lives: GAME_LIVES, status: 'playing' });
  });

  it('is won once a mode with no Round limit runs out of Rounds and can plan no more from the few eligible Entries left', async () => {
    const { game, eligibleNow } = await start(pick, { roundLimit: 'none' });

    await eligibleNow({ entries: words.slice(0, 5) });
    const { over, rounds } = await playOut(game);

    expect(rounds).toHaveLength(GAME_ROUNDS);
    expect(over).toMatchObject({ roundsPassed: 15, status: 'won' });
  });

  it('moves on at once in a mode that moves on: the answer counts and the next Round comes with no «Далі»', async () => {
    const { game } = await start(pick, { lives: 'none', movesOn: true });

    const second = await answer(game, pickAnswer(false));

    expect(second).toMatchObject({ roundsPassed: 1, status: 'playing' });
    expect(second.round).toMatchObject({ number: 2, answer: undefined });
    expect(second.played.map(({ number, right }) => [number, right])).toEqual([[1, false]]);
    await noMove(game, () => game.next());
  });
});

describe('the answer forms of a Round', () => {
  const answerWord = wordAt(0);
  const second = wordAt(1);

  /** «Наголос» in short: the vowels at the places 0 and 2, the one at 2 stressed. */
  const vowel: Build = (of) => ({
    form: 'vowel',
    prompt: of.lemma,
    vowels: [0, 2],
    stressed: [2],
    sheet: sheetOf(of.lemma),
  });

  /** «Анаграми» in short: three letter chips shown as c, a, b, right in the order a, b, c. */
  const chips: Build = (of) => ({
    form: 'chips',
    chipKind: 'letter',
    prompt: of.lemma,
    chips: ['c', 'a', 'b'],
    expected: ['a', 'b', 'c'],
    sheet: sheetOf(of.lemma),
  });

  /** «Впиши слово» in short: type the Lemma. */
  const typed: Build = (of) => ({
    form: 'typed',
    prompt: of.lemma,
    expected: of.lemma,
    sheet: sheetOf(of.lemma),
  });

  /**
   * «Пари» in short: a grid of the Word and the three after it, their
   * Definitions shown in the reverse order; a Word shows by its id, which
   * tells homonyms apart.
   */
  const grid: Build = (of, { next: after }) => {
    const pairs = [of, ...after.slice(0, 3)].map((entry) => ({
      entry,
      word: option(entry.id.slice(2)),
      definition: `The meaning of ${entry.id.slice(2)}.`,
      sheet: sheetOf(entry.id),
    }));
    const places = pairs.map((_, place) => place);
    return {
      form: 'pairs',
      prompt: '',
      pairs,
      wordOrder: places,
      definitionOrder: [...places].reverse(),
    };
  };

  it('judges a vowel tap: a stressed vowel is right, another vowel costs a Life, a tap elsewhere is no answer', async () => {
    const { game } = await start(vowel, { roundLimit: 2 });
    expect(now(game).round).toMatchObject({ form: 'vowel', vowels: [0, 2], answer: undefined });

    await noMove(game, () => game.answer({ form: 'vowel', position: 1 }));

    const right = await answer(game, { form: 'vowel', position: 2 });
    expect(right).toMatchObject({ status: 'answered', lives: GAME_LIVES });
    expect(right.round.answer).toMatchObject({
      form: 'vowel',
      chosen: 2,
      stressed: [2],
      right: true,
    });

    await game.next();
    const wrong = await answer(game, { form: 'vowel', position: 0 });
    expect(wrong).toMatchObject({ status: 'answered', lives: GAME_LIVES - 1 });
    expect(wrong.round.answer).toMatchObject({ form: 'vowel', chosen: 0, right: false });
    expect(wrong.played.map(({ right: was }) => was)).toEqual([true, false]);
  });

  it('judges chips tapped in order: the right order is right, another or a part of it costs a Life', async () => {
    const { game } = await start(chips, { roundLimit: 3 });
    expect(now(game).round).toMatchObject({
      form: 'chips',
      chipKind: 'letter',
      chips: ['c', 'a', 'b'],
      fixed: [],
    });

    const right = await answer(game, { form: 'chips', chips: [1, 2, 0] });
    expect(right).toMatchObject({ status: 'answered', lives: GAME_LIVES });
    expect(right.round.answer).toMatchObject({
      form: 'chips',
      chosen: [1, 2, 0],
      expected: ['a', 'b', 'c'],
      right: true,
    });

    await game.next();
    const wrong = await answer(game, { form: 'chips', chips: [1, 0, 2] });
    expect(wrong).toMatchObject({ status: 'answered', lives: GAME_LIVES - 1 });

    await game.next();
    const part = await answer(game, { form: 'chips', chips: [1, 2] });
    expect(part).toMatchObject({ status: 'answered', lives: GAME_LIVES - 2 });
    expect(part.round.answer).toMatchObject({ form: 'chips', chosen: [1, 2], right: false });
  });

  it('takes no chips the Round has not', async () => {
    const { game } = await start(chips, { roundLimit: 1 });

    await noMove(game, () => game.answer({ form: 'chips', chips: [1, 2, 3] }));
  });

  it('judges typed text the way spec #772 compares it: case set aside, other text costs a Life', async () => {
    const { game } = await start(typed, { roundLimit: 2 });
    expect(now(game).round).toMatchObject({
      form: 'typed',
      answer: undefined,
      blanks: undefined,
      canOpenLetter: false,
    });

    const right = await answer(game, { form: 'typed', text: ` ${answerWord.lemma.toUpperCase()}` });
    expect(right).toMatchObject({ status: 'answered', lives: GAME_LIVES });
    expect(right.round.answer).toMatchObject({
      form: 'typed',
      expected: answerWord.lemma,
      right: true,
    });

    await game.next();
    const wrong = await answer(game, { form: 'typed', text: 'something else' });
    expect(wrong).toMatchObject({ status: 'answered', lives: GAME_LIVES - 1 });
    expect(wrong.round.answer).toMatchObject({
      form: 'typed',
      typed: 'something else',
      right: false,
    });
  });

  it('plays the four pairs of a pairs grid as four Rounds, a wrong pair costing a Life, then the next grid', async () => {
    const { game } = await start(grid, { roundLimit: 8 });
    const first = now(game).round;
    if (first.form !== 'pairs') throw new Error('Not a pairs grid');
    expect(first.words.map(({ shown }) => shown.text)).toEqual([
      'word01',
      'word02',
      'word03',
      'word04',
    ]);
    expect(first.definitions.map(({ shown }) => shown)).toEqual(
      [...first.words].reverse().map(({ shown }) => `The meaning of ${shown.text}.`),
    );

    // The first Word matched to its Definition, the last one shown.
    const one = await answer(game, { form: 'pairs', word: 0, definition: 3 });
    expect(one).toMatchObject({ status: 'answered', lives: GAME_LIVES });
    expect(one.round.answer).toMatchObject({ form: 'pairs', right: true, correct: 3 });
    expect(one.played[0]?.entry).toBe(wordAt(0));
    const two = await next(game);
    expect(two).toMatchObject({ roundsPassed: 1, status: 'playing' });
    expect(two.round.number).toBe(2);
    if (two.round.form !== 'pairs') throw new Error('Not a pairs grid');
    expect(two.round.words.map(({ gone }) => gone)).toEqual([true, false, false, false]);
    expect(two.round.definitions.map(({ gone }) => gone)).toEqual([false, false, false, true]);

    // A pair already gone takes no answer; the second Word matched to the wrong Definition.
    await noMove(game, () => game.answer({ form: 'pairs', word: 0, definition: 2 }));
    await noMove(game, () => game.answer({ form: 'pairs', word: 1, definition: 3 }));
    const wrong = await answer(game, { form: 'pairs', word: 1, definition: 1 });
    expect(wrong).toMatchObject({ status: 'answered', lives: GAME_LIVES - 1 });
    expect(wrong.round.answer).toMatchObject({
      form: 'pairs',
      word: 1,
      definition: 1,
      correct: 2,
      right: false,
    });
    expect(wrong.played[1]?.entry).toBe(wordAt(1));
    const three = await next(game);
    if (three.round.form !== 'pairs') throw new Error('Not a pairs grid');
    expect(three.round.words.map(({ gone }) => gone)).toEqual([true, true, false, false]);
    expect(three.round.definitions.map(({ gone }) => gone)).toEqual([false, false, true, true]);

    await game.answer({ form: 'pairs', word: 2, definition: 1 });
    await game.next();
    await game.answer({ form: 'pairs', word: 3, definition: 0 });
    const nextGrid = await next(game);
    expect(nextGrid).toMatchObject({ roundsPassed: 4, lives: GAME_LIVES - 1, status: 'playing' });
    if (nextGrid.round.form !== 'pairs') throw new Error('Not a pairs grid');
    expect(nextGrid.round.number).toBe(5);
    expect(nextGrid.round.words.every(({ gone }) => !gone)).toBe(true);
    expect(nextGrid.round.words.map(({ shown }) => shown.text)).toEqual([
      'word05',
      'word06',
      'word07',
      'word08',
    ]);

    for (let pair = 0; pair < 4; pair += 1) {
      await game.answer({ form: 'pairs', word: pair, definition: 3 - pair });
      await game.next();
    }
    expect(now(game)).toMatchObject({ roundsPassed: 8, status: 'won' });
    expect(now(game).played).toHaveLength(8);
  });

  it('takes no answer of another form than the Round has', async () => {
    const { game } = await start(typed, { roundLimit: 1 });

    await noMove(game, () => game.answer({ form: 'pick', option: 0 }));
    await noMove(game, () => game.answer({ form: 'chips', chips: [0] }));
    await noMove(game, () => game.answer({ form: 'vowel', position: 0 }));
    await noMove(game, () => game.answer({ form: 'pairs', word: 0, definition: 0 }));
  });

  /** The reader's answer each Game Review row shows, in the order played: nothing on a right answer. */
  const answersReviewed = (game: CurrentGame) =>
    buildGameReview(game.played).map(({ picked }) => picked);

  it('lists a vowel Round in the Game Review with the stressed form, and the vowel tapped on a mistake', async () => {
    const { game } = await start(vowel, { roundLimit: 2 });
    await game.answer({ form: 'vowel', position: 2 });
    await game.next();
    const wrong = await answer(game, { form: 'vowel', position: 0 });
    const [tapped, ...rest] = Array.from(second.lemma);

    const items = buildGameReview(wrong.played);

    expect(items.map(({ title }) => title.text)).toEqual([answerWord.lemma, second.lemma]);
    expect(items.map(({ right: was }) => was)).toEqual([true, false]);
    expect(answersReviewed(wrong)).toEqual([
      undefined,
      { text: `${tapped ?? ''}́${rest.join('')}`, stressedVowels: [tapped], form: 'vowel' },
    ]);
  });

  it('lists a chips Round in the Game Review with the chips the reader tapped, in order, on a mistake', async () => {
    const { game } = await start(chips, { roundLimit: 3 });
    await game.answer({ form: 'chips', chips: [1, 2, 0] });
    await game.next();
    await game.answer({ form: 'chips', chips: [1, 0, 2] });
    await game.next();
    const part = await answer(game, { form: 'chips', chips: [1, 2] });

    expect(answersReviewed(part)).toEqual([
      undefined,
      { ...option('acb'), form: 'chips' },
      { ...option('ab'), form: 'chips' },
    ]);
  });

  it('joins word chips with a space in the Game Review, as «Склади вислів» has them', async () => {
    const { game } = await start(
      (of) => ({
        form: 'chips',
        chipKind: 'word',
        prompt: of.lemma,
        chips: ['beans', 'spill', 'the'],
        expected: ['spill', 'the', 'beans'],
        sheet: sheetOf('spill the beans'),
      }),
      { roundLimit: 1 },
    );

    const wrong = await answer(game, { form: 'chips', chips: [2, 1] });

    expect(answersReviewed(wrong)).toEqual([{ ...option('the spill'), form: 'chips' }]);
  });

  it("lists a typed Round in the Game Review with the reader's text on a mistake", async () => {
    const { game } = await start(typed, { roundLimit: 2 });
    await game.answer({ form: 'typed', text: answerWord.lemma });
    await game.next();
    const wrong = await answer(game, { form: 'typed', text: ' something else ' });

    expect(buildGameReview(wrong.played).map(({ right: was }) => was)).toEqual([true, false]);
    expect(answersReviewed(wrong)).toEqual([
      undefined,
      { ...option('something else'), form: 'typed' },
    ]);
  });

  it('lists each pair of a pairs grid as one Game Review row, with the Definition matched on a mistake', async () => {
    const { game } = await start(grid, { roundLimit: 4 });
    await game.answer({ form: 'pairs', word: 0, definition: 3 });
    await game.next();
    await game.answer({ form: 'pairs', word: 1, definition: 2 });
    await game.next();
    const wrong = await answer(game, { form: 'pairs', word: 2, definition: 0 });

    const items = buildGameReview(wrong.played);

    expect(items.map(({ number, entryId, right }) => ({ number, entryId, right }))).toEqual([
      { number: 1, entryId: 'w_word01', right: true },
      { number: 2, entryId: 'w_word02', right: true },
      { number: 3, entryId: 'w_word03', right: false },
    ]);
    expect(answersReviewed(wrong)).toEqual([
      undefined,
      undefined,
      { ...option(wordAt(3).primaryDefinition), form: 'pairs' },
    ]);
  });
});

describe('«Відкрити літеру» in a typed Round', () => {
  const answerWord = word('w_word', { lemma: "ab'c" });
  /** The Lemma as blanks, its apostrophe in place from the start. */
  const blanks: Build = (of) => ({
    form: 'typed',
    prompt: of.primaryDefinition,
    expected: of.lemma,
    blanks: { inPlace: [2] },
    sheet: sheetOf(of.lemma),
  });

  /** The blanks of a typed Round and whether a letter may be opened; fails the test in another form. */
  function blanksOf({ round }: CurrentGame) {
    if (round.form !== 'typed') throw new Error('Not a typed Round');
    return { blanks: round.blanks, canOpenLetter: round.canOpenLetter };
  }

  it('shows the text as blanks, the marks in place, and opens the first blank at a time until one is left', async () => {
    const { game } = await start(blanks, { roundLimit: 1 }, [answerWord]);
    expect(blanksOf(now(game))).toEqual({
      blanks: [{}, {}, { mark: "'" }, {}],
      canOpenLetter: true,
    });

    game.openLetter();
    expect(blanksOf(now(game))).toEqual({
      blanks: [{ letter: 'a' }, {}, { mark: "'" }, {}],
      canOpenLetter: true,
    });
    expect(now(game)).toMatchObject({ lives: GAME_LIVES, status: 'playing' });

    game.openLetter();
    expect(blanksOf(now(game))).toEqual({
      blanks: [{ letter: 'a' }, { letter: 'b' }, { mark: "'" }, {}],
      canOpenLetter: false,
    });
    await noMove(game, () => {
      game.openLetter();
    });

    const right = await answer(game, { form: 'typed', text: "AB'C" });
    expect(right.round.answer).toMatchObject({ form: 'typed', right: true });
  });

  it('opens no letter in a Round without blanks, in another form or once the Round is answered', async () => {
    const noBlanks = await start(
      (of) => ({ form: 'typed', prompt: '', expected: of.lemma, sheet: sheetOf(of.lemma) }),
      { roundLimit: 1 },
      [answerWord],
    );
    await noMove(noBlanks.game, () => {
      noBlanks.game.openLetter();
    });

    const picked = await start(pick, { roundLimit: 1 });
    await noMove(picked.game, () => {
      picked.game.openLetter();
    });

    const { game } = await start(blanks, { roundLimit: 1 }, [answerWord]);
    await game.answer({ form: 'typed', text: 'wrong' });
    await noMove(game, () => {
      game.openLetter();
    });
  });
});

describe('the Rounds built anew while the Game is in play', () => {
  /** The eligible Words once the first twenty are gone, say hidden. */
  const left = words.slice(20);

  it('builds the Rounds after the one shown anew from the eligible Entries, keeping the Rounds shown', async () => {
    const { game, eligibleNow } = await start(pick);
    const prompts = [now(game).round.prompt];
    prompts.push((await play(game, true)).round.prompt);
    await play(game, true);

    await eligibleNow({ entries: left });

    let current = now(game);
    while (current.status === 'playing') {
      prompts.push(current.round.prompt);
      current = await play(game, true);
    }
    expect(prompts).toEqual(definitionsOf([...words.slice(0, 3), ...left.slice(0, 12)]));
    expect(current).toMatchObject({ roundsPassed: 15, status: 'won' });
  });

  it('keeps the Rounds as they were when the mode can make no more', async () => {
    const { game, eligibleNow } = await start(pick);
    await play(game, true);

    await eligibleNow({ entries: left.slice(0, 5) });

    const third = await play(game, true);
    expect(third.round.prompt).toBe(wordAt(2).primaryDefinition);
  });

  it('builds the Rounds anew after an answer too, from the one after the Round answered', async () => {
    const { game, eligibleNow } = await start(pick);
    await game.answer(pickAnswer(true));

    await eligibleNow({ entries: left });

    expect((await next(game)).round.prompt).toBe(wordAt(20).primaryDefinition);
  });
});

describe('the Rounds a Game Mode builds', () => {
  const gridOf = (of: readonly Word[], definitionOrder: readonly number[]): RoundContent => ({
    form: 'pairs',
    prompt: '',
    pairs: of.map((entry) => ({
      entry,
      word: option(entry.lemma),
      definition: entry.primaryDefinition,
      sheet: sheetOf(entry.lemma),
    })),
    wordOrder: of.map((_, place) => place),
    definitionOrder,
  });
  const sheet = sheetOf('');

  it.each<{ form: string; flaw: string; round: RoundContent }>([
    {
      form: 'pick',
      flaw: 'of three options',
      round: {
        form: 'pick',
        prompt: '',
        options: [option('a'), option('b'), option('c')],
        correct: 0,
        sheet,
      },
    },
    {
      form: 'pick',
      flaw: 'whose right option it has not',
      round: {
        form: 'pick',
        prompt: '',
        options: [option('a'), option('b'), option('c'), option('d')],
        correct: 4,
        sheet,
      },
    },
    {
      form: 'vowel',
      flaw: 'with no vowel stressed',
      round: { form: 'vowel', prompt: '', vowels: [0, 2], stressed: [], sheet },
    },
    {
      form: 'vowel',
      flaw: 'stressed on no vowel it shows',
      round: { form: 'vowel', prompt: '', vowels: [0, 2], stressed: [1], sheet },
    },
    {
      form: 'pairs',
      flaw: 'with a Definition shown twice',
      round: gridOf(words.slice(0, 4), [0, 0, 1, 2]),
    },
    {
      form: 'pairs',
      flaw: 'of five pairs',
      round: gridOf(words.slice(0, 5), [4, 3, 2, 1, 0]),
    },
    {
      form: 'chips',
      flaw: 'with no chips',
      round: { form: 'chips', chipKind: 'letter', prompt: '', chips: [], expected: [], sheet },
    },
    {
      form: 'chips',
      flaw: 'whose chips make another text',
      round: {
        form: 'chips',
        chipKind: 'letter',
        prompt: '',
        chips: ['a', 'b'],
        expected: ['a', 'c'],
        sheet,
      },
    },
    {
      form: 'typed',
      flaw: 'with no text to type',
      round: { form: 'typed', prompt: '', expected: '', sheet },
    },
  ])('starts no Game when the mode builds a «$form» Round $flaw', async ({ form, round }) => {
    const { game } = await open(mode(() => round));

    await expect(game.start('test')).rejects.toThrow(
      `The Game Mode «test» built a «${form}» Round without one right answer`,
    );
    expect(game.state.current).toBeUndefined();
  });

  it('starts no Game when the mode builds a pairs grid of more Rounds than are left', async () => {
    const { game } = await open(
      mode(() => gridOf(words.slice(0, 4), [3, 2, 1, 0]), { roundLimit: 2 }),
    );

    await expect(game.start('test')).rejects.toThrow(
      'The Game Mode «test» built more than the 2 Rounds left',
    );
    expect(game.state.current).toBeUndefined();
  });
});
