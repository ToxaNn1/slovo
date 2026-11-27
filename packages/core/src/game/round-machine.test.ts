import { describe, expect, it } from 'vitest';

import type { AskableEntry, EligibleOfKind } from '../entries/entries';
import { testComparison, word } from '../test-support';
import type { AnswerSheet } from './answer-form';
import type { GameMode, RoundContent } from './game-mode';
import {
  answerRound,
  firstGame,
  nextRound,
  openRoundLetter,
  replanRounds,
  type PlayingGame,
  type RoundMove,
  type RoundRules,
  type RoundsPlan,
} from './round-machine';
import type { PlannedRound, RoundPlan, RoundPlanner } from './round-plan';

const sheetOf = (text: string): AnswerSheet => ({
  answer: { text, stressedVowels: [] },
  example: undefined,
});

const option = (text: string) => ({ text, stressedVowels: [] });

/** A pick Round about the Word of that id, its right option the first. */
function pick(id: string): PlannedRound {
  const entry = word(id);
  return {
    entry,
    content: {
      form: 'pick',
      prompt: entry.primaryDefinition,
      options: [entry.lemma, 'one', 'two', 'three'].map(option),
      correct: 0,
      sheet: sheetOf(entry.lemma),
    },
  };
}

/** A typed Round about the Word of that id, its text shown as blanks. */
function typed(id: string): PlannedRound {
  const entry = word(id);
  return {
    entry,
    content: {
      form: 'typed',
      prompt: entry.primaryDefinition,
      expected: entry.lemma,
      blanks: { inPlace: [] },
      sheet: sheetOf(entry.lemma),
    },
  };
}

/** A pairs grid of the Words of those ids, shown in their order. */
function grid(ids: readonly string[]): PlannedRound {
  const entries = ids.map((id) => word(id));
  const [first] = entries;
  if (first === undefined) throw new Error('A grid needs a pair');
  const content: RoundContent = {
    form: 'pairs',
    prompt: '',
    pairs: entries.map((entry) => ({
      entry,
      word: option(entry.lemma),
      definition: entry.primaryDefinition,
      sheet: sheetOf(entry.lemma),
    })),
    wordOrder: ids.map((_, place) => place),
    definitionOrder: ids.map((_, place) => place),
  };
  return { entry: first, content };
}

const RIGHT = { form: 'pick', option: 0 } as const;
const WRONG = { form: 'pick', option: 1 } as const;

const eligible: EligibleOfKind<AskableEntry> = { entries: [] };

/** A planner that hands out the plans it is given, one per call, and keeps what it was asked. */
function planner(...plans: readonly RoundPlan[]) {
  const calls: { count: number | undefined; asked: string[]; from: number | undefined }[] = [];
  let call = 0;
  const planRounds: RoundPlanner = (_mode, _eligible, count, asked, from) => {
    calls.push({ count, asked: [...(asked ?? [])].sort(), from });
    const plan = plans[call];
    call += 1;
    return plan ?? { refusal: 'too-few-entries' };
  };
  return { planRounds, calls };
}

function rulesOf(
  mode: Partial<GameMode> = {},
  rest: Partial<Omit<RoundRules, 'mode'>> = {},
): RoundRules {
  return {
    mode: {
      id: 'test-mode',
      entryKind: 'word',
      group: 'meaning',
      isOn: () => true,
      buildRound: () => undefined,
      ...mode,
    },
    lives: 3,
    banner: false,
    planRounds: planner().planRounds,
    comparison: testComparison,
    ...rest,
  };
}

const planOf = (...rounds: readonly PlannedRound[]): RoundsPlan => ({ rounds, eligible });

/** The Game of a move that must be in play. */
function playing(move: RoundMove | undefined): PlayingGame {
  const game = move?.game;
  if (game === undefined || (game.status !== 'playing' && game.status !== 'answered')) {
    throw new Error(`The Game is ${game?.status ?? 'not moved'}`);
  }
  return game;
}

/** The Game at the first Round of the plan. */
function started(rules: RoundRules, plan: RoundsPlan): PlayingGame {
  const game = firstGame(rules, plan);
  if (game === undefined) throw new Error('No Game started');
  return game;
}

describe('the Round machine', () => {
  it('starts no Game without a Round planned', () => {
    expect(firstGame(rulesOf(), planOf())).toBeUndefined();
  });

  it('starts at the first Round with every Life', () => {
    const game = started(rulesOf({ roundLimit: 2 }, { lives: 2 }), planOf(pick('w-oko')));

    expect(game).toMatchObject({
      modeId: 'test-mode',
      status: 'playing',
      roundsPassed: 0,
      roundLimit: 2,
      lives: 2,
      livesAtStart: 2,
      played: [],
    });
    expect(game.round).toMatchObject({ number: 1, form: 'pick', answer: undefined });
  });

  it('makes a new Game on an answer and leaves the one it takes as it was', () => {
    const rules = rulesOf();
    const plan = planOf(pick('w-oko'), pick('w-lis'));
    const game = started(rules, plan);
    const before = { ...game, round: { ...game.round }, played: [...game.played] };

    const move = answerRound(rules, plan, game, RIGHT);

    expect(game).toEqual(before);
    expect(move?.plan).toBe(plan);
    expect(move?.game).toMatchObject({
      status: 'answered',
      lives: 3,
      answered: { kind: 'right', xp: undefined },
      played: [{ number: 1, right: true, entry: { id: 'w-oko' } }],
    });
  });

  it('takes a Life for a wrong answer and names the right one', () => {
    const rules = rulesOf();
    const plan = planOf(pick('w-oko'), pick('w-lis'));

    const move = answerRound(rules, plan, started(rules, plan), WRONG);

    expect(move?.game).toMatchObject({
      status: 'answered',
      lives: 2,
      answered: { kind: 'wrong', answer: 'oko', lastLife: false },
    });
  });

  it('takes no Life in a mode without Lives', () => {
    const rules = rulesOf({}, { lives: undefined });
    const plan = planOf(pick('w-oko'), pick('w-lis'));

    const move = answerRound(rules, plan, started(rules, plan), WRONG);

    expect(move?.game.lives).toBeUndefined();
  });

  it('answers a Round once, and only in its form', () => {
    const rules = rulesOf();
    const plan = planOf(pick('w-oko'), pick('w-lis'));
    const game = started(rules, plan);
    const answered = playing(answerRound(rules, plan, game, RIGHT));

    expect(answerRound(rules, plan, answered, RIGHT)).toBeUndefined();
    expect(answerRound(rules, plan, game, { form: 'typed', text: 'oko' })).toBeUndefined();
    expect(answerRound(rules, plan, game, { form: 'pick', option: 7 })).toBeUndefined();
  });

  it('moves on nowhere before an answer', () => {
    const rules = rulesOf();
    const plan = planOf(pick('w-oko'), pick('w-lis'));

    expect(nextRound(rules, plan, started(rules, plan))).toBeUndefined();
  });

  it('goes on to the next Round after «Далі», the banner left behind', () => {
    const rules = rulesOf({}, { banner: true });
    const plan = planOf(pick('w-oko'), pick('w-lis'));
    const answered = playing(answerRound(rules, plan, started(rules, plan), RIGHT));
    expect(answered).toMatchObject({ status: 'answered', banner: true });

    const after = playing(nextRound(rules, plan, answered));

    expect(after).toMatchObject({ status: 'playing', roundsPassed: 1 });
    expect(after.round).toMatchObject({ number: 2, prompt: 'The meaning of lis.' });
    expect(after).not.toHaveProperty('answered');
    expect(after).not.toHaveProperty('banner');
  });

  it('is lost after «Далі» with the last Life gone', () => {
    const rules = rulesOf({}, { lives: 1 });
    const plan = planOf(pick('w-oko'), pick('w-lis'));
    const answered = playing(answerRound(rules, plan, started(rules, plan), WRONG));
    expect(answered).toMatchObject({ lives: 0, answered: { kind: 'wrong', lastLife: true } });

    expect(nextRound(rules, plan, answered)?.game).toMatchObject({
      status: 'lost',
      roundsPassed: 0,
    });
  });

  it('is won after the last Round of the Round limit, though more are planned', () => {
    const rules = rulesOf({ roundLimit: 1 });
    const plan = planOf(pick('w-oko'), pick('w-lis'));
    const answered = playing(answerRound(rules, plan, started(rules, plan), RIGHT));

    expect(nextRound(rules, plan, answered)?.game).toMatchObject({
      status: 'won',
      roundsPassed: 1,
    });
  });

  it('goes on at once in a mode that moves on, unless a banner shows', () => {
    const plan = planOf(pick('w-oko'), pick('w-lis'));
    const atOnce = rulesOf({ movesOn: true });
    const withBanner = rulesOf({ movesOn: true }, { banner: true });

    expect(answerRound(atOnce, plan, started(atOnce, plan), RIGHT)?.game).toMatchObject({
      status: 'playing',
      roundsPassed: 1,
      round: { number: 2 },
    });
    expect(answerRound(withBanner, plan, started(withBanner, plan), RIGHT)?.game).toMatchObject({
      status: 'answered',
      roundsPassed: 0,
    });
  });

  it('plans more Rounds in a mode with no Round limit, in a new plan', () => {
    const { planRounds, calls } = planner({ rounds: [pick('w-lis')] });
    const rules = rulesOf({ roundLimit: 'none' }, { planRounds });
    const plan = planOf(pick('w-oko'));
    const answered = playing(answerRound(rules, plan, started(rules, plan), RIGHT));

    const move = nextRound(rules, plan, answered);

    expect(calls).toEqual([{ count: 15, asked: ['w-oko'], from: 2 }]);
    expect(plan.rounds).toHaveLength(1);
    expect(move?.plan.rounds.map(({ entry }) => entry.id)).toEqual(['w-oko', 'w-lis']);
    expect(move?.game).toMatchObject({ status: 'playing', round: { number: 2 } });
  });

  it('is won in a mode with no Round limit once no more Rounds can be planned', () => {
    const rules = rulesOf({ roundLimit: 'none' });
    const plan = planOf(pick('w-oko'));
    const answered = playing(answerRound(rules, plan, started(rules, plan), RIGHT));

    const move = nextRound(rules, plan, answered);

    expect(move?.game).toMatchObject({ status: 'won', roundsPassed: 1 });
    expect(move?.plan).toBe(plan);
  });

  it('plays each pair of a pairs grid as a Round of its own, with no banner', () => {
    const rules = rulesOf({}, { banner: true });
    const plan = planOf(grid(['w-oko', 'w-lis']), pick('w-dim'));
    const game = started(rules, plan);

    const first = playing(
      answerRound(rules, plan, game, { form: 'pairs', word: 1, definition: 0 }),
    );
    expect(first).toMatchObject({
      status: 'answered',
      banner: false,
      lives: 2,
      played: [{ right: false, entry: { id: 'w-lis' } }],
    });

    const second = playing(nextRound(rules, plan, first));
    expect(second.round).toMatchObject({
      number: 2,
      form: 'pairs',
      words: [{ state: 'open' }, { state: 'missed' }],
      definitions: [{ state: 'open' }, { state: 'missed' }],
    });
    // A pair answered takes no more taps.
    expect(
      answerRound(rules, plan, second, { form: 'pairs', word: 1, definition: 1 }),
    ).toBeUndefined();

    const last = playing(
      answerRound(rules, plan, second, { form: 'pairs', word: 0, definition: 0 }),
    );
    expect(playing(nextRound(rules, plan, last)).round).toMatchObject({ number: 3, form: 'pick' });
  });

  it('opens a letter of a typed Round, and none of a Round in another form', () => {
    const plan = planOf(typed('w-oko'), pick('w-lis'));
    const rules = rulesOf();
    const game = started(rules, plan);

    const opened = openRoundLetter(plan, game);

    expect(opened?.round).toMatchObject({
      form: 'typed',
      blanks: [{ letter: 'o' }, {}, {}],
      canOpenLetter: true,
    });
    expect(game.round).toMatchObject({ blanks: [{}, {}, {}] });

    const picking = planOf(pick('w-lis'));
    expect(openRoundLetter(picking, started(rules, picking))).toBeUndefined();
  });

  it('opens no letter once the Round is answered', () => {
    const plan = planOf(typed('w-oko'), pick('w-lis'));
    const rules = rulesOf();
    const answered = playing(
      answerRound(rules, plan, started(rules, plan), { form: 'typed', text: 'oko' }),
    );

    expect(answered.played).toMatchObject([{ right: true }]);
    expect(openRoundLetter(plan, answered)).toBeUndefined();
  });

  it('plans the Rounds after the ones shown anew, from the Entries eligible now', () => {
    const { planRounds, calls } = planner({ rounds: [pick('w-dim')] });
    const rules = rulesOf({ roundLimit: 3 }, { planRounds });
    const plan = planOf(pick('w-oko'), pick('w-lis'), pick('w-sad'));
    const answered = playing(answerRound(rules, plan, started(rules, plan), RIGHT));
    const second = playing(nextRound(rules, plan, answered));
    const now: EligibleOfKind<AskableEntry> = { entries: [word('w-dim')] };

    const replanned = replanRounds(rules, plan, second, now);

    expect(calls).toEqual([{ count: 1, asked: ['w-lis', 'w-oko'], from: 3 }]);
    expect(replanned.rounds.map(({ entry }) => entry.id)).toEqual(['w-oko', 'w-lis', 'w-dim']);
    expect(replanned.eligible).toBe(now);
    expect(plan.rounds.map(({ entry }) => entry.id)).toEqual(['w-oko', 'w-lis', 'w-sad']);
  });

  it('keeps the Rounds as they were when the mode cannot make the rest', () => {
    const rules = rulesOf({ roundLimit: 2 });
    const plan = planOf(pick('w-oko'), pick('w-lis'));
    const now: EligibleOfKind<AskableEntry> = { refusal: 'corrections-out-of-mix' };

    const replanned = replanRounds(rules, plan, started(rules, plan), now);

    expect(replanned.rounds).toBe(plan.rounds);
    expect(replanned.eligible).toBe(now);
  });

  it('labels a Round by its mode unless its content names another label', () => {
    const game = started(rulesOf(), planOf(pick('w-oko')));

    expect(game.round.labelKind).toBe('mode');
  });

  it('plans no more Rounds in a mode with no Round limit while planned ones remain', () => {
    const { planRounds, calls } = planner({ rounds: [pick('w-dim')] });
    const rules = rulesOf({ roundLimit: 'none' }, { planRounds });
    const plan = planOf(pick('w-oko'), pick('w-lis'));
    const answered = playing(answerRound(rules, plan, started(rules, plan), RIGHT));

    const move = nextRound(rules, plan, answered);

    expect(calls).toEqual([]);
    expect(move?.plan).toBe(plan);
    expect(move?.game).toMatchObject({ status: 'playing', round: { number: 2 } });
  });

  it.each([
    { limit: 4, count: 2 },
    { limit: 'none', count: 1 },
  ] as const)(
    'replans up to the Round limit $limit, or the Rounds planned without one',
    ({ limit, count }) => {
      const { planRounds, calls } = planner({ rounds: [pick('w-dim')] });
      const rules = rulesOf({ roundLimit: limit }, { planRounds });
      const plan = planOf(pick('w-oko'), pick('w-lis'), pick('w-sad'));
      const answered = playing(answerRound(rules, plan, started(rules, plan), RIGHT));
      const second = playing(nextRound(rules, plan, answered));

      replanRounds(rules, plan, second, eligible);

      expect(calls).toEqual([{ count, asked: ['w-lis', 'w-oko'], from: 3 }]);
    },
  );

  it('keeps the Rounds when the Game is at a Round the plan lacks', () => {
    const { planRounds, calls } = planner({ rounds: [pick('w-dim')] });
    const rules = rulesOf({ roundLimit: 3 }, { planRounds });
    const longer = planOf(pick('w-oko'), pick('w-lis'));
    const answered = playing(answerRound(rules, longer, started(rules, longer), RIGHT));
    const second = playing(nextRound(rules, longer, answered));
    const shorter = planOf(pick('w-oko'));
    const now: EligibleOfKind<AskableEntry> = { entries: [word('w-dim')] };

    const replanned = replanRounds(rules, shorter, second, now);

    expect(calls).toEqual([]);
    expect(replanned.rounds).toBe(shorter.rounds);
    expect(replanned.eligible).toBe(now);
  });
});
