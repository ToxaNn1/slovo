import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import type { AskableEntry, EligibleOfKind } from '../entries/entries';
import { word } from '../test-support';
import { LIFE_LOST_DELAY } from './game-haptics';
import {
  createGameInPlay,
  GAME_LIVES,
  type CurrentGame,
  type GameInPlay,
  type GivenAnswer,
  type Round,
} from './game-in-play';
import type { GameMode, RoundContent, RoundOption } from './game-mode';
import { buildGameReview } from './game-review';
import { GAME_ROUNDS, type PlannedRound, type RoundPlanner } from './round-plan';

// The internal seam of the Game in play (ADR 0052): the Rounds planned, the
// moves through them and what each leaves to show, with no composition, no
// clock and no user state around them. `game.test.ts` keeps what `openGame`
// adds: the offers, the Knowledge Marks, the Best result and the play time.

const option = (text: string): RoundOption => ({ text, stressedVowels: [] });
const sheetOf = (text: string) => ({ answer: option(text), example: undefined });

/** Forty Words, `w_word01` to `w_word40`, more than two Games ask about. */
const words = Array.from({ length: 40 }, (_, index) =>
  word(`w_word${String(index + 1).padStart(2, '0')}`),
);
const eligible: EligibleOfKind<AskableEntry> = { entries: words };

/** The Word at the place among them; fails the test past the last. */
function wordAt(index: number): Word {
  const found = words[index];
  if (found === undefined) throw new Error(`No Word at ${String(index)}`);
  return found;
}

/** Where the right option of every pick Round built here stands. */
const RIGHT = 1;
const WRONG = 2;

/** A pick Round about the Word: its Definition, the Lemma among three others at `RIGHT`. */
function pick(answer: Word, others: readonly Word[]): PlannedRound {
  const options = others.slice(0, 3).map(({ lemma }) => option(lemma));
  options.splice(RIGHT, 0, option(answer.lemma));
  return {
    entry: answer,
    content: {
      form: 'pick',
      prompt: answer.primaryDefinition,
      options,
      correct: RIGHT,
      sheet: sheetOf(answer.lemma),
    },
  };
}

/** `count` pick Rounds, each about the next Word of `from`, the three after it its Distractors. */
const picks = (count: number, from: readonly Word[] = words): PlannedRound[] =>
  Array.from({ length: count }, (_, index) => {
    const answer = from[index];
    if (answer === undefined) throw new Error(`No Word at ${String(index)}`);
    return pick(answer, [...from.slice(index + 1), ...from.slice(0, index)]);
  });

/** A Round in the form built from the Word, in a mode of one form. */
const roundOf = (answer: Word, content: RoundContent): PlannedRound => ({ entry: answer, content });

const mode = (rest: Partial<GameMode> = {}): GameMode => ({
  id: 'test',
  entryKind: 'word',
  isOn: () => true,
  buildRound: () => undefined,
  ...rest,
});

/** A planner that can make no Round: the Game has only the Rounds it started with. */
const noMore: RoundPlanner = () => ({ refusal: 'too-few-entries' });

/** The Game started over the Rounds; fails the test when none starts. */
function start(
  rounds: readonly PlannedRound[],
  rest: Partial<GameMode> = {},
  planRounds: RoundPlanner = noMore,
): GameInPlay {
  const play = createGameInPlay({ mode: mode(rest), rounds, planRounds, eligible });
  if (play === undefined) throw new Error('No Game started');
  return play;
}

/** The Game a move made; fails the test when the move was none. */
function must(game: CurrentGame | undefined): CurrentGame {
  if (game === undefined) throw new Error('The move changed nothing');
  return game;
}

/** The answer to a pick Round built here, right or wrong. */
const pickAnswer = (right: boolean): GivenAnswer => ({
  form: 'pick',
  option: right ? RIGHT : WRONG,
});

/** The Game after an answer and «Далі». */
const play = (game: GameInPlay, current: CurrentGame, right: boolean) =>
  must(game.next(must(game.answer(current, pickAnswer(right)))));

/** The Game played to its end, wrong only in the Rounds listed (from 1), and every Round shown. */
function playOut(
  game: GameInPlay,
  wrongIn: readonly number[] = [],
): { over: CurrentGame; rounds: Round[] } {
  let current = game.first;
  const rounds: Round[] = [];
  while (current.status === 'playing') {
    rounds.push(current.round);
    current = play(game, current, !wrongIn.includes(current.round.number));
  }
  return { over: current, rounds };
}

describe('the Rounds of a Game in play', () => {
  it('starts at the first Round with every Life, nothing played and no answer yet', () => {
    const game = start(picks(GAME_ROUNDS));

    expect(game.first).toMatchObject({
      modeId: 'test',
      roundsPassed: 0,
      roundLimit: GAME_ROUNDS,
      lives: GAME_LIVES,
      livesAtStart: GAME_LIVES,
      played: [],
      status: 'playing',
    });
    expect(game.first.round).toMatchObject({
      number: 1,
      entryKind: 'word',
      prompt: wordAt(0).primaryDefinition,
      form: 'pick',
      answer: undefined,
      lifeLostAfter: LIFE_LOST_DELAY,
    });
  });

  it('starts no Game without a Round', () => {
    expect(createGameInPlay({ mode: mode(), rounds: [], planRounds: noMore, eligible })).toBe(
      undefined,
    );
  });

  it('answers a Round once: a second answer is no move', () => {
    const game = start(picks(GAME_ROUNDS));
    const answered = must(game.answer(game.first, pickAnswer(true)));

    expect(game.answer(answered, pickAnswer(false))).toBeUndefined();
    expect(answered).toMatchObject({ lives: GAME_LIVES, status: 'answered' });
  });

  it('takes a Life for a wrong answer at once, before «Далі»', () => {
    const game = start(picks(GAME_ROUNDS));

    const answered = must(game.answer(game.first, pickAnswer(false)));

    expect(answered).toMatchObject({ lives: GAME_LIVES - 1, roundsPassed: 0, status: 'answered' });
    expect(answered.round.answer).toMatchObject({ chosen: WRONG, correct: RIGHT, right: false });
  });

  it('counts a Round passed on «Далі», right or wrong, and moves to the next Round', () => {
    const game = start(picks(GAME_ROUNDS));

    const second = play(game, game.first, true);
    expect(second).toMatchObject({ roundsPassed: 1, lives: GAME_LIVES, status: 'playing' });
    expect(second.round).toMatchObject({ number: 2, answer: undefined });

    const third = play(game, second, false);
    expect(third).toMatchObject({ roundsPassed: 2, lives: GAME_LIVES - 1, status: 'playing' });
    expect(third.round.number).toBe(3);
  });

  it('is no move on «Далі» before the Round is answered', () => {
    const game = start(picks(GAME_ROUNDS));

    expect(game.next(game.first)).toBeUndefined();
  });

  it('is won after the 15th Round, with 15 Rounds passed and every Life', () => {
    const { over, rounds } = playOut(start(picks(GAME_ROUNDS)));

    expect(rounds).toHaveLength(GAME_ROUNDS);
    expect(over).toMatchObject({ roundsPassed: 15, lives: GAME_LIVES, status: 'won' });
  });

  it('is won after the 15th Round with mistakes, as long as a Life is left', () => {
    const { over } = playOut(start(picks(GAME_ROUNDS)), [2, 6, 7, 15]);

    expect(over).toMatchObject({ roundsPassed: 15, lives: 1, status: 'won' });
  });

  it.each([5, 9, 15])(
    'is lost when the fifth Life goes in Round %i, which is not counted as passed',
    (lastRound) => {
      const wrong = [4, 3, 2, 1, 0].map((before) => lastRound - before);

      const { over, rounds } = playOut(start(picks(GAME_ROUNDS)), wrong);

      expect(rounds).toHaveLength(lastRound);
      expect(over).toMatchObject({ roundsPassed: lastRound - 1, lives: 0, status: 'lost' });
    },
  );

  it('ends a Game that lost its fifth Life only on «Далі»: the answered Round stays until then', () => {
    const game = start(picks(GAME_ROUNDS));
    let current = game.first;
    for (let round = 1; round <= 4; round += 1) current = play(game, current, false);

    const answered = must(game.answer(current, pickAnswer(false)));

    expect(answered).toMatchObject({ lives: 0, roundsPassed: 4, status: 'answered' });
    expect(must(game.next(answered))).toMatchObject({ lives: 0, roundsPassed: 4, status: 'lost' });
  });

  it('takes no answer and no «Далі» once the Game is over', () => {
    const game = start(picks(GAME_ROUNDS));
    const { over } = playOut(game, [1, 2, 3, 4, 5]);

    expect(over.status).toBe('lost');
    expect(game.answer(over, pickAnswer(true))).toBeUndefined();
    expect(game.next(over)).toBeUndefined();
  });

  it("lists every played Round in order with its Entry, the reader's pick and whether it was right", () => {
    const { over, rounds } = playOut(start(picks(GAME_ROUNDS)), [2, 5]);

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

  it('lists the Round that cost the last Life as the last played Round of a lost Game', () => {
    const { over } = playOut(start(picks(GAME_ROUNDS)), [1, 2, 3, 4, 5]);

    expect(over.status).toBe('lost');
    expect(over.played.map(({ number, right }) => [number, right])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, false],
      [5, false],
    ]);
  });

  it('lists the Rounds answered so far while the Game is in play, and none before the first answer', () => {
    const game = start(picks(GAME_ROUNDS));
    expect(game.first.played).toEqual([]);

    const second = play(game, game.first, true);
    const answered = must(game.answer(second, pickAnswer(false)));

    expect(answered.played.map(({ number, right }) => [number, right])).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it('takes no answer that names an option the Round has not', () => {
    const game = start(picks(GAME_ROUNDS));

    expect(game.answer(game.first, { form: 'pick', option: 4 })).toBeUndefined();
    expect(game.answer(game.first, { form: 'pick', option: -1 })).toBeUndefined();
  });
});

describe('the Lives and the Round limit a Game Mode sets', () => {
  it('starts with the Lives the mode sets, and is lost on the mistake that takes the last one', () => {
    const game = start(picks(GAME_ROUNDS), { lives: 3 });
    expect(game.first).toMatchObject({ lives: 3, livesAtStart: 3, status: 'playing' });

    let current = play(game, game.first, false);
    current = play(game, current, true);
    current = play(game, current, false);
    expect(current).toMatchObject({ roundsPassed: 3, lives: 1, status: 'playing' });

    current = play(game, current, false);
    expect(current).toMatchObject({ roundsPassed: 3, lives: 0, status: 'lost' });
    expect(current.played).toHaveLength(4);
  });

  it('never ends on mistakes in a mode with no Lives, and shows none', () => {
    const game = start(picks(GAME_ROUNDS), { lives: 'none' });
    expect(game.first.lives).toBeUndefined();
    expect(game.first.livesAtStart).toBeUndefined();

    const { over } = playOut(
      game,
      Array.from({ length: GAME_ROUNDS }, (_, index) => index + 1),
    );

    expect(over).toMatchObject({ roundsPassed: 15, lives: undefined, status: 'won' });
    expect(over.played.every(({ right }) => !right)).toBe(true);
  });

  it('is won after the Rounds of the limit the mode sets', () => {
    const game = start(picks(10), { roundLimit: 10 });
    expect(game.first.roundLimit).toBe(10);

    const { over, rounds } = playOut(game);

    expect(rounds).toHaveLength(10);
    expect(over).toMatchObject({ roundsPassed: 10, lives: GAME_LIVES, status: 'won' });
  });

  it('plans 15 more Rounds about Entries not asked yet when a mode with no Round limit runs out, and is won once it can plan no more', () => {
    const calls: { count: number | undefined; asked: string[]; from: number | undefined }[] = [];
    const planRounds: RoundPlanner = (_mode, _eligible, count, asked, from) => {
      calls.push({ count, asked: [...(asked ?? [])].sort(), from });
      // Rounds about the Words not asked yet, up to 15 at a time, until there are none left.
      const left = words.filter(({ id }) => !asked?.has(id));
      return left.length === 0
        ? { refusal: 'too-few-entries' }
        : { rounds: picks(Math.min(GAME_ROUNDS, left.length), left) };
    };
    const game = start(picks(GAME_ROUNDS), { roundLimit: 'none' }, planRounds);
    expect(game.first.roundLimit).toBeUndefined();

    const { over, rounds } = playOut(game);

    expect(rounds).toHaveLength(40);
    expect(new Set(rounds.map(({ prompt }) => prompt)).size).toBe(40);
    expect(over).toMatchObject({ roundsPassed: 40, lives: GAME_LIVES, status: 'won' });
    expect(calls.map(({ count, from, asked }) => [count, from, asked.length])).toEqual([
      [GAME_ROUNDS, 16, 15],
      [GAME_ROUNDS, 31, 30],
      [GAME_ROUNDS, 41, 40],
    ]);
    expect(calls[0]?.asked).toEqual(words.slice(0, 15).map(({ id }) => id));
  });

  it('is won after the last Round planned when the mode planned fewer than its limit', () => {
    const { over } = playOut(start(picks(10)));

    expect(over).toMatchObject({ roundsPassed: 10, status: 'won' });
  });

  it('moves on at once in a mode that moves on: the answer counts and the next Round comes with no «Далі»', () => {
    const game = start(picks(GAME_ROUNDS), { lives: 'none', movesOn: true });

    const second = must(game.answer(game.first, pickAnswer(false)));

    expect(second).toMatchObject({ roundsPassed: 1, status: 'playing' });
    expect(second.round).toMatchObject({ number: 2, answer: undefined });
    expect(second.played.map(({ number, right }) => [number, right])).toEqual([[1, false]]);
    expect(game.next(second)).toBeUndefined();
  });
});

describe('the answer forms of a Round', () => {
  const answer = wordAt(0);
  const second = wordAt(1);
  const third = wordAt(2);

  /** «Наголос» in short: the vowels at the places 0 and 2, the one at 2 stressed. */
  const vowel = (of: Word): PlannedRound =>
    roundOf(of, {
      form: 'vowel',
      prompt: of.lemma,
      vowels: [0, 2],
      stressed: [2],
      sheet: sheetOf(of.lemma),
    });

  /** «Анаграми» in short: three chips shown as c, a, b, right in the order a, b, c. */
  const chips = (of: Word): PlannedRound =>
    roundOf(of, {
      form: 'chips',
      prompt: of.lemma,
      chips: ['c', 'a', 'b'],
      expected: ['a', 'b', 'c'],
      sheet: sheetOf(of.lemma),
    });

  /** «Впиши слово» in short: type the Lemma. */
  const typed = (of: Word): PlannedRound =>
    roundOf(of, { form: 'typed', prompt: of.lemma, expected: of.lemma, sheet: sheetOf(of.lemma) });

  /**
   * «Пари» in short: a grid of the four Words, their Definitions shown in the
   * reverse order; a Word shows by its id, which tells homonyms apart.
   */
  const grid = (of: readonly Word[]): PlannedRound => {
    const [first] = of;
    if (first === undefined) throw new Error('A grid needs a Word');
    return roundOf(first, {
      form: 'pairs',
      prompt: '',
      pairs: of.map((entry) => ({
        entry,
        word: option(entry.id.slice(2)),
        definition: entry.primaryDefinition,
        sheet: sheetOf(entry.primaryDefinition),
      })),
      wordOrder: [0, 1, 2, 3],
      definitionOrder: [3, 2, 1, 0],
    });
  };

  it('judges a vowel tap: a stressed vowel is right, another vowel costs a Life, a tap elsewhere is no answer', () => {
    const game = start([vowel(answer), vowel(second)]);
    expect(game.first.round).toMatchObject({ form: 'vowel', vowels: [0, 2], answer: undefined });

    expect(game.answer(game.first, { form: 'vowel', position: 1 })).toBeUndefined();

    const right = must(game.answer(game.first, { form: 'vowel', position: 2 }));
    expect(right).toMatchObject({ status: 'answered', lives: GAME_LIVES });
    expect(right.round.answer).toMatchObject({
      form: 'vowel',
      chosen: 2,
      stressed: [2],
      right: true,
    });

    const wrong = must(game.answer(must(game.next(right)), { form: 'vowel', position: 0 }));
    expect(wrong).toMatchObject({ status: 'answered', lives: GAME_LIVES - 1 });
    expect(wrong.round.answer).toMatchObject({ form: 'vowel', chosen: 0, right: false });
    expect(wrong.played.map(({ right: was }) => was)).toEqual([true, false]);
  });

  it('judges chips tapped in order: the right order is right, another or a part of it costs a Life', () => {
    const game = start([chips(answer), chips(second), chips(third)]);
    expect(game.first.round).toMatchObject({ form: 'chips', chips: ['c', 'a', 'b'], fixed: [] });

    const right = must(game.answer(game.first, { form: 'chips', chips: [1, 2, 0] }));
    expect(right).toMatchObject({ status: 'answered', lives: GAME_LIVES });
    expect(right.round.answer).toMatchObject({
      form: 'chips',
      chosen: [1, 2, 0],
      expected: ['a', 'b', 'c'],
      right: true,
    });

    const wrong = must(game.answer(must(game.next(right)), { form: 'chips', chips: [1, 0, 2] }));
    expect(wrong).toMatchObject({ status: 'answered', lives: GAME_LIVES - 1 });

    const part = must(game.answer(must(game.next(wrong)), { form: 'chips', chips: [1, 2] }));
    expect(part).toMatchObject({ status: 'answered', lives: GAME_LIVES - 2 });
    expect(part.round.answer).toMatchObject({ form: 'chips', chosen: [1, 2], right: false });
  });

  it('takes no chips the Round has not', () => {
    const game = start([chips(answer)]);

    expect(game.answer(game.first, { form: 'chips', chips: [1, 2, 3] })).toBeUndefined();
  });

  it('judges typed text the way spec #772 compares it: case set aside, other text costs a Life', () => {
    const game = start([typed(answer), typed(second)]);
    expect(game.first.round).toMatchObject({
      form: 'typed',
      answer: undefined,
      blanks: undefined,
      canOpenLetter: false,
    });

    const right = must(
      game.answer(game.first, { form: 'typed', text: ` ${answer.lemma.toUpperCase()}` }),
    );
    expect(right).toMatchObject({ status: 'answered', lives: GAME_LIVES });
    expect(right.round.answer).toMatchObject({
      form: 'typed',
      expected: answer.lemma,
      right: true,
    });

    const wrong = must(
      game.answer(must(game.next(right)), { form: 'typed', text: 'something else' }),
    );
    expect(wrong).toMatchObject({ status: 'answered', lives: GAME_LIVES - 1 });
    expect(wrong.round.answer).toMatchObject({
      form: 'typed',
      typed: 'something else',
      right: false,
    });
  });

  it('plays the four pairs of a pairs grid as four Rounds, a wrong pair costing a Life, then the next grid', () => {
    const game = start([grid(words.slice(0, 4)), grid(words.slice(4, 8))], { roundLimit: 8 });
    const first = game.first.round;
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
    const one = must(game.answer(game.first, { form: 'pairs', word: 0, definition: 3 }));
    expect(one).toMatchObject({ status: 'answered', lives: GAME_LIVES });
    expect(one.round.answer).toMatchObject({ form: 'pairs', right: true, correct: 3 });
    expect(one.played[0]?.entry).toBe(wordAt(0));
    const two = must(game.next(one));
    expect(two).toMatchObject({ roundsPassed: 1, status: 'playing' });
    expect(two.round.number).toBe(2);
    if (two.round.form !== 'pairs') throw new Error('Not a pairs grid');
    expect(two.round.words.map(({ gone }) => gone)).toEqual([true, false, false, false]);
    expect(two.round.definitions.map(({ gone }) => gone)).toEqual([false, false, false, true]);

    // A pair already gone takes no answer; the second Word matched to the wrong Definition.
    expect(game.answer(two, { form: 'pairs', word: 0, definition: 2 })).toBeUndefined();
    expect(game.answer(two, { form: 'pairs', word: 1, definition: 3 })).toBeUndefined();
    const wrong = must(game.answer(two, { form: 'pairs', word: 1, definition: 1 }));
    expect(wrong).toMatchObject({ status: 'answered', lives: GAME_LIVES - 1 });
    expect(wrong.round.answer).toMatchObject({
      form: 'pairs',
      word: 1,
      definition: 1,
      correct: 2,
      right: false,
    });
    expect(wrong.played[1]?.entry).toBe(wordAt(1));
    const three = must(game.next(wrong));
    if (three.round.form !== 'pairs') throw new Error('Not a pairs grid');
    expect(three.round.words.map(({ gone }) => gone)).toEqual([true, true, false, false]);
    expect(three.round.definitions.map(({ gone }) => gone)).toEqual([false, false, true, true]);

    const four = must(
      game.next(must(game.answer(three, { form: 'pairs', word: 2, definition: 1 }))),
    );
    const next = must(
      game.next(must(game.answer(four, { form: 'pairs', word: 3, definition: 0 }))),
    );
    expect(next).toMatchObject({ roundsPassed: 4, lives: GAME_LIVES - 1, status: 'playing' });
    if (next.round.form !== 'pairs') throw new Error('Not a pairs grid');
    expect(next.round.number).toBe(5);
    expect(next.round.words.every(({ gone }) => !gone)).toBe(true);
    expect(next.round.words.map(({ shown }) => shown.text)).toEqual([
      'word05',
      'word06',
      'word07',
      'word08',
    ]);

    let current = next;
    for (let pair = 0; pair < 4; pair += 1) {
      current = must(
        game.next(must(game.answer(current, { form: 'pairs', word: pair, definition: 3 - pair }))),
      );
    }
    expect(current).toMatchObject({ roundsPassed: 8, status: 'won' });
    expect(current.played).toHaveLength(8);
  });

  it('takes no answer of another form than the Round has', () => {
    const game = start([typed(answer)]);

    expect(game.answer(game.first, { form: 'pick', option: 0 })).toBeUndefined();
    expect(game.answer(game.first, { form: 'chips', chips: [0] })).toBeUndefined();
    expect(game.answer(game.first, { form: 'vowel', position: 0 })).toBeUndefined();
    expect(game.answer(game.first, { form: 'pairs', word: 0, definition: 0 })).toBeUndefined();
  });

  /** The reader's answer each Game Review row shows, in the order played: nothing on a right answer. */
  const answersReviewed = (game: CurrentGame) =>
    buildGameReview(game.played).map(({ picked }) => picked);

  it('lists a vowel Round in the Game Review with the stressed form, and the vowel tapped on a mistake', () => {
    const game = start([vowel(answer), vowel(second)]);
    const right = must(game.answer(game.first, { form: 'vowel', position: 2 }));
    const wrong = must(game.answer(must(game.next(right)), { form: 'vowel', position: 0 }));
    const [tapped, ...rest] = Array.from(second.lemma);

    const items = buildGameReview(wrong.played);

    expect(items.map(({ title }) => title.text)).toEqual([answer.lemma, second.lemma]);
    expect(items.map(({ right: was }) => was)).toEqual([true, false]);
    expect(answersReviewed(wrong)).toEqual([
      undefined,
      { text: `${tapped ?? ''}́${rest.join('')}`, stressedVowels: [tapped], form: 'vowel' },
    ]);
  });

  it('lists a chips Round in the Game Review with the chips the reader tapped, in order, on a mistake', () => {
    const game = start([chips(answer), chips(second), chips(third)]);
    const right = must(game.answer(game.first, { form: 'chips', chips: [1, 2, 0] }));
    const wrong = must(game.answer(must(game.next(right)), { form: 'chips', chips: [1, 0, 2] }));
    const part = must(game.answer(must(game.next(wrong)), { form: 'chips', chips: [1, 2] }));

    expect(answersReviewed(part)).toEqual([
      undefined,
      { ...option('acb'), form: 'chips' },
      { ...option('ab'), form: 'chips' },
    ]);
  });

  it('joins word chips with a space in the Game Review, as «Склади вислів» has them', () => {
    const game = start([
      roundOf(answer, {
        form: 'chips',
        prompt: answer.lemma,
        chips: ['beans', 'spill', 'the'],
        expected: ['spill', 'the', 'beans'],
        sheet: sheetOf('spill the beans'),
      }),
    ]);

    const wrong = must(game.answer(game.first, { form: 'chips', chips: [2, 1] }));

    expect(answersReviewed(wrong)).toEqual([{ ...option('the spill'), form: 'chips' }]);
  });

  it("lists a typed Round in the Game Review with the reader's text on a mistake", () => {
    const game = start([typed(answer), typed(second)]);
    const right = must(game.answer(game.first, { form: 'typed', text: answer.lemma }));
    const wrong = must(
      game.answer(must(game.next(right)), { form: 'typed', text: ' something else ' }),
    );

    expect(buildGameReview(wrong.played).map(({ right: was }) => was)).toEqual([true, false]);
    expect(answersReviewed(wrong)).toEqual([
      undefined,
      { ...option('something else'), form: 'typed' },
    ]);
  });

  it('lists each pair of a pairs grid as one Game Review row, with the Definition matched on a mistake', () => {
    const game = start([grid(words.slice(0, 4))], { roundLimit: 4 });
    const one = must(
      game.next(must(game.answer(game.first, { form: 'pairs', word: 0, definition: 3 }))),
    );
    const two = must(game.next(must(game.answer(one, { form: 'pairs', word: 1, definition: 2 }))));
    const wrong = must(game.answer(two, { form: 'pairs', word: 2, definition: 0 }));

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
  const answer = word('w_word', { lemma: "ab'c" });
  /** The Lemma as blanks, its apostrophe in place from the start. */
  const blanks: PlannedRound = {
    entry: answer,
    content: {
      form: 'typed',
      prompt: answer.primaryDefinition,
      expected: answer.lemma,
      blanks: { inPlace: [2] },
      sheet: sheetOf(answer.lemma),
    },
  };

  /** The blanks of a typed Round and whether a letter may be opened; fails the test in another form. */
  function blanksOf({ round }: CurrentGame) {
    if (round.form !== 'typed') throw new Error('Not a typed Round');
    return { blanks: round.blanks, canOpenLetter: round.canOpenLetter };
  }

  it('shows the text as blanks, the marks in place, and opens the first blank at a time until one is left', () => {
    const game = start([blanks]);
    expect(blanksOf(game.first)).toEqual({
      blanks: [{}, {}, { mark: "'" }, {}],
      canOpenLetter: true,
    });

    const one = must(game.openLetter(game.first));
    expect(blanksOf(one)).toEqual({
      blanks: [{ letter: 'a' }, {}, { mark: "'" }, {}],
      canOpenLetter: true,
    });
    expect(one).toMatchObject({ lives: GAME_LIVES, status: 'playing' });

    const two = must(game.openLetter(one));
    expect(blanksOf(two)).toEqual({
      blanks: [{ letter: 'a' }, { letter: 'b' }, { mark: "'" }, {}],
      canOpenLetter: false,
    });
    expect(game.openLetter(two)).toBeUndefined();

    const right = must(game.answer(two, { form: 'typed', text: "AB'C" }));
    expect(right.round.answer).toMatchObject({ form: 'typed', right: true });
  });

  it('opens no letter in a Round without blanks, in another form or once the Round is answered', () => {
    const noBlanks = start([
      {
        entry: answer,
        content: {
          form: 'typed',
          prompt: '',
          expected: answer.lemma,
          sheet: sheetOf(answer.lemma),
        },
      },
    ]);
    expect(noBlanks.openLetter(noBlanks.first)).toBeUndefined();

    const picked = start(picks(1));
    expect(picked.openLetter(picked.first)).toBeUndefined();

    const game = start([blanks]);
    const answered = must(game.answer(game.first, { form: 'typed', text: 'wrong' }));
    expect(game.openLetter(answered)).toBeUndefined();
  });
});

describe('the Rounds built anew while the Game is in play', () => {
  /** The eligible Words once the first twenty are gone, say hidden. */
  const left = words.slice(20);

  /** A planner that makes its Rounds about the Words left, and records what it was asked. */
  function planner() {
    const calls: { count: number | undefined; asked: string[]; from: number | undefined }[] = [];
    const planRounds: RoundPlanner = (_mode, ofKind, count, asked, from) => {
      calls.push({ count, asked: [...(asked ?? [])], from });
      if (!('entries' in ofKind)) return { refusal: ofKind.refusal };
      return {
        rounds: picks(
          count ?? GAME_ROUNDS,
          ofKind.entries.filter((entry): entry is Word => entry.kind === 'word'),
        ),
      };
    };
    return { calls, planRounds };
  }

  it('builds the Rounds after the one shown anew from the eligible Entries, keeping the Rounds shown', () => {
    const { calls, planRounds } = planner();
    const game = start(picks(GAME_ROUNDS), {}, planRounds);
    const second = play(game, game.first, true);
    const third = play(game, second, true);

    game.replan(third, { entries: left });

    expect(calls).toEqual([{ count: 12, asked: words.slice(0, 3).map(({ id }) => id), from: 4 }]);
    const rounds = [game.first.round, second.round];
    let current = third;
    while (current.status === 'playing') {
      rounds.push(current.round);
      current = play(game, current, true);
    }
    expect(rounds.map(({ prompt }) => prompt)).toEqual(
      [...words.slice(0, 3), ...left.slice(0, 12)].map(
        ({ primaryDefinition }) => primaryDefinition,
      ),
    );
    expect(current).toMatchObject({ roundsPassed: 15, status: 'won' });
  });

  it('keeps the Rounds as they were when the mode can make no more', () => {
    const game = start(picks(GAME_ROUNDS), {}, noMore);
    const second = play(game, game.first, true);

    game.replan(second, { entries: left });

    const third = play(game, second, true);
    expect(third.round.prompt).toBe(wordAt(2).primaryDefinition);
  });

  it('builds the Rounds anew after an answer too, from the one after the Round answered', () => {
    const { calls, planRounds } = planner();
    const game = start(picks(GAME_ROUNDS), {}, planRounds);
    const answered = must(game.answer(game.first, pickAnswer(true)));

    game.replan(answered, { entries: left });

    expect(calls).toEqual([{ count: 14, asked: [wordAt(0).id], from: 2 }]);
    expect(must(game.next(answered)).round.prompt).toBe(wordAt(20).primaryDefinition);
  });

  it('builds nothing anew once the Game is over', () => {
    const { calls, planRounds } = planner();
    const game = start(picks(GAME_ROUNDS), {}, planRounds);
    const { over } = playOut(game);

    game.replan(over, { entries: left });

    expect(calls).toEqual([]);
  });
});
