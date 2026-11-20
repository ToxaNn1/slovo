import type { AskableEntry, AskableKind, EligibleOfKind } from '../entries/entries';
import type { TextComparison } from '../text/text-comparison';
import {
  entriesIn,
  judge,
  openLetter,
  roundsIn,
  showsBanner,
  shownRound,
  type GivenAnswer,
  type RoundAnswer,
  type ShownRound,
} from './answer-forms';
import { LIFE_LOST_DELAY } from './game-haptics';
import type { GameMode, RoundLabelKind, TextRange } from './game-mode';
import { GAME_ROUNDS, roundLimitOf, type PlannedRound, type RoundPlanner } from './round-plan';

/**
 * The Round machine: the moves of a Game through the Rounds planned for it,
 * as functions on values. A move takes the Game and its planned Rounds and
 * makes new ones; it edits neither, keeps nothing between calls and reads no
 * clock. `openGame` holds the values and wraps the moves with what the
 * Rounds know nothing of: the play time, the XP, the Best result, the
 * Knowledge Marks and the order of the Game's changes.
 */

/**
 * A Round as the reader plays it, in its answer form, the right answer kept
 * out, and resolved for the shell to draw: whether its prompt has a gap, how
 * each blank shows and when a wrong answer costs its Life.
 */
export type Round = {
  /** Which Round of the Game it is, from 1 up to the mode's Round limit, `GAME_ROUNDS` by default. */
  readonly number: number;
  /** The kind of Entry it asks about, by which the shell lays it out, such as a Synonym Row's question. */
  readonly entryKind: AskableKind;
  readonly prompt: string;
  /** The part of the prompt to mark, which the shell draws and VoiceOver names; none to mark. */
  readonly highlight: TextRange | undefined;
  /**
   * The gap in the prompt: the highlight when it stands for the Lemma in an
   * Example, which the shell labels and reads aloud as a gap, and marks no
   * further; none in another Round.
   */
  readonly gap: TextRange | undefined;
  /** Which label the Round shows over its prompt: the Game Mode's, or its own kind's. */
  readonly labelKind: RoundLabelKind;
  /** The Definition shown under the prompt, such as a Word's in «Звідки слово»; none when left out. */
  readonly definition?: string;
  /**
   * How long after a wrong answer its Life is lost, in milliseconds: when its
   * haptic comes (`LIFE_LOST_DELAY`), so the shell pops the Life then too.
   */
  readonly lifeLostAfter: number;
  /** The answer, once given; a Round is answered once. */
  readonly answer: RoundAnswer | undefined;
} & ShownRound;

/** A Round the reader answered: what the Game Review lists. */
export type PlayedRound = Round & {
  /** The Entry the Round asked about: of a pairs grid, the Word tapped. */
  readonly entry: AskableEntry;
  readonly answer: RoundAnswer;
  /** Whether the reader answered right. */
  readonly right: boolean;
};

/**
 * Where a Game stands: in play, a Round to answer or a Round answered and
 * waiting for «Далі»; or over, won at its Round limit, lost with its last
 * Life, or ended once its time was up.
 */
export type GameStatus = GameInPlayStatus | GameOverStatus;

/** Where a Game in play stands: a Round to answer, or one answered and waiting for «Далі». */
export type GameInPlayStatus = 'playing' | 'answered';

/** How a Game over ended: won at its Round limit, lost with its last Life, or its time up. */
export type GameOverStatus = 'won' | 'lost' | 'time-up';

/**
 * The play time a Game in a mode with a time limit has left: `left`
 * milliseconds when it last paused or started, and while its clock runs, the
 * moment it ends, which pauses leave out.
 */
export interface GameTime {
  readonly left: number;
  /** When the Game ends while its clock runs; none while it is paused or over. */
  readonly endsAt: Date | undefined;
}

/** What a Game in play and a Game just over both hold. */
export interface GameRounds {
  readonly modeId: string;
  /** The current Round; the last one played once the Game is over. */
  readonly round: Round;
  /**
   * The Rounds answered, right or wrong, but for the one that cost the last
   * Life; it moves up on «Далі». A won Game passed every Round the mode had.
   */
  readonly roundsPassed: number;
  /** The mode's Round limit (`GAME_ROUNDS` by default); none in a mode without one. */
  readonly roundLimit: number | undefined;
  /** The Lives left, from the Lives the Game started with to 0; none in a mode without Lives. */
  readonly lives: number | undefined;
  /** The mode's Lives, which the Game starts with; none in a mode without Lives. */
  readonly livesAtStart: number | undefined;
  /** The mode's time limit, in milliseconds of play; none in a mode without one. */
  readonly timeLimit?: number;
  /** The play time left, in a mode with a time limit; none in another mode. */
  readonly time?: GameTime;
  /**
   * Every Round answered so far, in order, the one that cost the last Life
   * included; kept in memory only, until the Game is left.
   */
  readonly played: readonly PlayedRound[];
}

/**
 * What the answer banner after an answer shows: a right answer
 * with the XP the XP log records for it, none when it records none; or a
 * wrong one with the right answer's text, and whether it took the last Life.
 */
export type AnsweredRound =
  | { readonly kind: 'right'; readonly xp: number | undefined }
  | { readonly kind: 'wrong'; readonly answer: string; readonly lastLife: boolean };

/**
 * The Game in play: a Round to answer, or one answered, with what its answer
 * banner shows, and waiting for «Далі» or, with the banner on, its delay.
 */
export type PlayingGame = GameRounds & {
  /** A Game in play has no end yet. */
  readonly end?: never;
} & (
    | { readonly status: 'playing'; readonly answered?: never }
    | {
        readonly status: 'answered';
        readonly answered: AnsweredRound;
        /**
         * Whether the answered Round shows the answer banner and moves on by
         * itself after its delay, in place of the sheet and its «Далі»: always, but never after a pair of a pairs grid or in a Game
         * with no schedule to move on by.
         */
        readonly banner: boolean;
      }
  );

/** A Game the moment it ends, before its end is counted. */
export type EndedGame = GameRounds & { readonly status: GameOverStatus };

/**
 * What a Game keeps the same from its start to its end, which every move of
 * the Round machine reads.
 */
export interface RoundRules {
  readonly mode: GameMode;
  /** The Lives the Game starts with, which it keeps however the Edition changes; none without Lives. */
  readonly lives: number | undefined;
  /** Whether the Game shows the answer banner: it does whenever a schedule moves it on, so a mode that moves on waits for it too. */
  readonly banner: boolean;
  /** Plans more Rounds of the mode, see `createRoundPlanner`. */
  readonly planRounds: RoundPlanner;
  /** How the Edition compares a typed answer. */
  readonly comparison: TextComparison;
}

/**
 * The Rounds planned for a Game, as the mode planned them, and the eligible
 * Entries of the mode's kinds more Rounds are planned from. The pairs of a
 * pairs grid are Rounds of their own, one after another, until the grid is
 * empty.
 */
export interface RoundsPlan {
  readonly rounds: readonly PlannedRound[];
  readonly eligible: EligibleOfKind<AskableEntry>;
}

/** A move of the Round machine: the Game it makes, and the Rounds planned after it. */
export interface RoundMove {
  readonly game: PlayingGame | EndedGame;
  readonly plan: RoundsPlan;
}

/** The Round as the reader sees it, its right answer kept out, after the answers given in its earlier Rounds, such as the pairs played in a grid. */
function roundOf(
  { entry, content }: PlannedRound,
  number: number,
  played: readonly PlayedRound[],
  inGrid: number,
): Round {
  const base = {
    number,
    entryKind: entry.kind,
    prompt: content.prompt,
    highlight: content.highlight,
    gap: content.gap,
    labelKind: content.labelKind ?? 'mode',
    ...(content.definition !== undefined && { definition: content.definition }),
    lifeLostAfter: LIFE_LOST_DELAY,
    answer: undefined,
  };
  const answered = played.slice(played.length - inGrid).map(({ answer }) => answer);
  return { ...base, ...shownRound(content, answered) };
}

/** The ids of the Entries the planned Rounds ask about, a grid's pairs included. */
const askedIn = (some: readonly PlannedRound[]) =>
  new Set(some.flatMap(({ entry, content }) => [entry.id, ...entriesIn(content)]));

/** How many Rounds of a Game the planned Rounds span, each pair of a grid counted. */
const spanOf = (some: readonly PlannedRound[]) =>
  some.reduce((sum, { content }) => sum + roundsIn(content), 0);

/**
 * The planned Round the Game's Round of that number comes from, its place
 * among the planned ones and how many Rounds of the Game come before it in
 * the same pairs grid; nothing past the last.
 */
function plannedAt(
  rounds: readonly PlannedRound[],
  number: number,
): { planned: PlannedRound; place: number; inGrid: number } | undefined {
  let start = 1;
  for (const [place, item] of rounds.entries()) {
    const span = roundsIn(item.content);
    if (number < start + span) return { planned: item, place, inGrid: number - start };
    start += span;
  }
  return undefined;
}

/** The Game at its first Round, with every Life; nothing without a Round planned. */
export function firstGame(
  { mode, lives }: RoundRules,
  { rounds }: RoundsPlan,
): PlayingGame | undefined {
  const first = rounds[0];
  if (first === undefined) return undefined;
  return {
    modeId: mode.id,
    round: roundOf(first, 1, [], 0),
    roundsPassed: 0,
    roundLimit: roundLimitOf(mode),
    lives,
    livesAtStart: lives,
    played: [],
    status: 'playing',
  };
}

/**
 * The Game after «Далі»: lost at 0 Lives, won after the last Round of the
 * mode's limit or, without one, after the last Round the mode can plan,
 * else at the next Round. In a mode with no Round limit, `GAME_ROUNDS` more
 * Rounds are planned whenever the Game runs out of them. Nothing before an
 * answer.
 */
export function nextRound(
  { mode, planRounds }: RoundRules,
  plan: RoundsPlan,
  game: PlayingGame,
): RoundMove | undefined {
  if (game.status !== 'answered') return undefined;
  // The banner's answer goes with the Round it answered.
  const { answered: _answered, banner: _banner, ...onward } = game;
  if (game.lives === 0) return { game: { ...onward, status: 'lost' }, plan };
  const roundLimit = roundLimitOf(mode);
  const roundsPassed = game.roundsPassed + 1;
  let { rounds } = plan;
  if (roundLimit === undefined && plannedAt(rounds, roundsPassed + 1) === undefined) {
    const more = planRounds(mode, plan.eligible, GAME_ROUNDS, askedIn(rounds), roundsPassed + 1);
    if ('rounds' in more) rounds = [...rounds, ...more.rounds];
  }
  const planned = rounds === plan.rounds ? plan : { ...plan, rounds };
  const upcoming =
    roundLimit === undefined || roundsPassed < roundLimit
      ? plannedAt(rounds, roundsPassed + 1)
      : undefined;
  if (upcoming === undefined) {
    return { game: { ...onward, roundsPassed, status: 'won' }, plan: planned };
  }
  return {
    game: {
      ...onward,
      roundsPassed,
      round: roundOf(upcoming.planned, roundsPassed + 1, game.played, upcoming.inGrid),
      status: 'playing',
    },
    plan: planned,
  };
}

/**
 * The Game with its Round answered: a wrong answer costs a Life, in a mode
 * with Lives. In a mode that moves on, the Game goes on to its next Round
 * at once, as `nextRound` does. Nothing unless a Round waits for an answer
 * in that form and the answer names something the Round has.
 */
export function answerRound(
  rules: RoundRules,
  plan: RoundsPlan,
  game: PlayingGame,
  given: GivenAnswer,
): RoundMove | undefined {
  if (game.status !== 'playing') return undefined;
  const { mode, banner, comparison } = rules;
  const at = plannedAt(plan.rounds, game.round.number);
  const judged = at && judge(at.planned.content, game.round, given, at.planned.entry, comparison);
  if (judged === undefined) return undefined;
  const { answer, entry } = judged;
  const lives = answer.right || game.lives === undefined ? game.lives : game.lives - 1;
  const answered: PlayingGame = {
    ...game,
    round: { ...game.round, answer },
    played: [...game.played, { ...game.round, answer, entry, right: answer.right }],
    lives,
    status: 'answered',
    answered: answer.right
      ? { kind: 'right', xp: undefined }
      : { kind: 'wrong', answer: answer.sheet.answer.text, lastLife: lives === 0 },
    banner: banner && showsBanner(answer),
  };
  const movesOn = mode.movesOn === true && !banner;
  return movesOn ? nextRound(rules, plan, answered) : { game: answered, plan };
}

/**
 * The Game with «Відкрити літеру»: a letter of the Round's answer opened, as
 * its Answer Form opens one, at no cost. Nothing unless the Round waits for
 * an answer and its form has a letter to open.
 */
export function openRoundLetter(plan: RoundsPlan, game: PlayingGame): PlayingGame | undefined {
  if (game.status !== 'playing') return undefined;
  const { round } = game;
  const at = plannedAt(plan.rounds, round.number);
  const opened = at && openLetter(at.planned.content, round);
  return opened && { ...game, round: { ...round, ...opened } };
}

/**
 * The Rounds planned anew after the ones the Game has shown, from the
 * eligible Entries of the mode's kind as they are now. When the mode can't
 * make the rest, they stay as they were.
 */
export function replanRounds(
  { mode, planRounds }: RoundRules,
  { rounds }: RoundsPlan,
  game: PlayingGame,
  eligible: EligibleOfKind<AskableEntry>,
): RoundsPlan {
  const at = plannedAt(rounds, game.round.number);
  if (at === undefined) return { rounds, eligible };
  const shown = rounds.slice(0, at.place + 1);
  const shownRounds = spanOf(shown);
  const rest = planRounds(
    mode,
    eligible,
    (roundLimitOf(mode) ?? spanOf(rounds)) - shownRounds,
    askedIn(shown),
    shownRounds + 1,
  );
  return { rounds: 'rounds' in rest ? [...shown, ...rest.rounds] : rounds, eligible };
}
