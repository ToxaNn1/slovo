import type { Entry } from '@slovo/contracts';

import type { EligibleOfKind } from '../entries/entries';
import type { AnswerSheet, GameMode, RoundContent, RoundOption, TextRange } from './game-mode';
import { GAME_ROUNDS, type PlannedRound, type RoundPlanner } from './round-plan';

/** How many Lives a Game starts with, in every Game Mode. */
export const GAME_LIVES = 5;

/** The answer given to a Round. */
export interface RoundAnswer {
  /** The place of the option the reader chose. */
  readonly chosen: number;
  /** The place of the right option. */
  readonly correct: number;
  readonly sheet: AnswerSheet;
}

/** A Round as the reader plays it. */
export interface Round {
  /** Which Round of the Game it is, from 1 to `GAME_ROUNDS`. */
  readonly number: number;
  readonly prompt: string;
  /** The part of the prompt to mark, which the shell draws and VoiceOver names; none to mark. */
  readonly highlight: TextRange | undefined;
  readonly options: readonly RoundOption[];
  /** The answer, once given; a Round is answered once. */
  readonly answer: RoundAnswer | undefined;
}

/** A Round the reader answered: what the Game Review lists. */
export interface PlayedRound extends Round {
  /** The Entry the Round asked about. */
  readonly entry: Entry;
  readonly answer: RoundAnswer;
  /** Whether the reader chose the right option. */
  readonly right: boolean;
}

/**
 * Where a Game stands: a Round to answer, a Round answered and waiting for
 * «Далі», or over, won or lost.
 */
export type GameStatus = 'playing' | 'answered' | 'won' | 'lost';

/** The Game in play, or just over. */
export interface CurrentGame {
  readonly modeId: string;
  /** The current Round; the last one played once the Game is over. */
  readonly round: Round;
  /**
   * The Rounds answered, right or wrong, but for the one that cost the last
   * Life; it moves up on «Далі». A won Game passed all `GAME_ROUNDS`.
   */
  readonly roundsPassed: number;
  /** The Lives left, from `GAME_LIVES` to 0. */
  readonly lives: number;
  /**
   * Every Round answered so far, in order, the one that cost the last Life
   * included; kept in memory only, until the Game is left.
   */
  readonly played: readonly PlayedRound[];
  readonly status: GameStatus;
}

/**
 * The Game in play, for `openGame`, which keeps the Game's state and its
 * async work: the Game Mode and the Rounds, built when the Game starts, and
 * the moves of a `CurrentGame` through them. A move never edits the Game it
 * takes: it makes a new one, and leaves showing it to `openGame`.
 */
export interface GameInPlay {
  readonly mode: GameMode;
  /** The Game at its first Round, with every Life. */
  readonly first: CurrentGame;
  /**
   * The Game with its Round answered with the option at that place: a wrong
   * answer costs a Life. Nothing unless a Round waits for an answer and has
   * that option.
   */
  answer(game: CurrentGame, option: number): CurrentGame | undefined;
  /**
   * The Game after «Далі»: lost at 0 Lives, won after the last Round, else
   * at the next Round. Nothing before an answer.
   */
  next(game: CurrentGame): CurrentGame | undefined;
  /**
   * Builds the Rounds after the ones the Game has shown anew from the
   * eligible Entries of the mode's kind, while the Game is not over. When the
   * mode can't make the rest, they stay as they were.
   */
  replan(game: CurrentGame, eligible: EligibleOfKind): void;
}

const roundOf = ({ prompt, highlight, options }: RoundContent, number: number): Round => ({
  number,
  prompt,
  highlight,
  options,
  answer: undefined,
});

/**
 * Starts a Game in the mode over its planned Rounds, which `planRounds`
 * builds anew on `replan`; nothing without a Round.
 */
export function createGameInPlay(
  mode: GameMode,
  planned: readonly PlannedRound[],
  planRounds: RoundPlanner,
): GameInPlay | undefined {
  const first = planned[0];
  if (first === undefined) return undefined;
  let rounds = planned;
  return {
    mode,
    first: {
      modeId: mode.id,
      round: roundOf(first.content, 1),
      roundsPassed: 0,
      lives: GAME_LIVES,
      played: [],
      status: 'playing',
    },
    answer(game, option) {
      if (game.status !== 'playing') return undefined;
      const planned = rounds[game.round.number - 1];
      if (planned?.content.options[option] === undefined) return undefined;
      const { correct, sheet } = planned.content;
      const answer = { chosen: option, correct, sheet };
      return {
        ...game,
        round: { ...game.round, answer },
        played: [
          ...game.played,
          { ...game.round, answer, entry: planned.entry, right: option === correct },
        ],
        lives: option === correct ? game.lives : game.lives - 1,
        status: 'answered',
      };
    },
    next(game) {
      if (game.status !== 'answered') return undefined;
      if (game.lives === 0) return { ...game, status: 'lost' };
      const roundsPassed = game.roundsPassed + 1;
      const upcoming = roundsPassed < GAME_ROUNDS ? rounds[roundsPassed]?.content : undefined;
      if (upcoming === undefined) return { ...game, roundsPassed, status: 'won' };
      return {
        ...game,
        roundsPassed,
        round: roundOf(upcoming, roundsPassed + 1),
        status: 'playing',
      };
    },
    replan(game, eligible) {
      if (game.status !== 'playing' && game.status !== 'answered') return;
      const shown = rounds.slice(0, game.roundsPassed + 1);
      const rest = planRounds(
        mode,
        eligible,
        GAME_ROUNDS - shown.length,
        new Set(shown.map(({ entry }) => entry.id)),
      );
      if ('rounds' in rest) rounds = [...shown, ...rest.rounds];
    },
  };
}
