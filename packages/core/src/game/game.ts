import type { EntryKind } from '@slovo/contracts';

import type { Entries } from '../entries/entries';
import type { History } from '../saved/history';
import { createInTurn, createSubscribers } from '../in-turn';
import type { Random, Schedule } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type {
  AnswerSheet,
  GameEdition,
  GameMode,
  GameModeRefusal,
  RoundContent,
  RoundOption,
  TextRange,
} from './game-mode';
import { createRoundPlanner, GAME_ROUNDS, type PlannedRound, type RoundPlan } from './round-plan';

/** How many Lives a Game starts with, in every Game Mode. */
export const GAME_LIVES = 5;

/** How long the Game waits before each new try of a failed planning of its offers, in milliseconds. */
const OFFER_PLANNING_RETRY_DELAYS: readonly number[] = [1_000, 2_000, 4_000];

/**
 * A Game Mode on offer, with what its card needs from the Core: the mode's
 * id, the kind of Entry it asks about, and whether a Game in it can start
 * now, or why not; or, just after the Game opens, that it is still planned.
 */
export type GameModeOffer = {
  readonly modeId: string;
  readonly entryKind: EntryKind;
} & (
  | { readonly canStart: true }
  | { readonly canStart: false; readonly refusal: GameModeRefusal }
  | { readonly canStart: false; readonly planning: true }
);

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
  readonly status: GameStatus;
}

/** The Game as it stands: the modes on offer, the Game in play and the best result. */
export interface GameState {
  /** The Game Modes the Edition turns on, in the order they register; none with the Game off. */
  readonly modes: readonly GameModeOffer[];
  /** The Game in play or just over; none on the mode screen. */
  readonly current: CurrentGame | undefined;
  /**
   * The best result: the most Rounds passed in one finished Game, in any
   * Game Mode, the Game just over included. None before the first finished
   * Game, or with the Game off.
   */
  readonly bestResult: number | undefined;
}

/**
 * The Game: the Game Modes on offer and the Game in play, kept in memory for
 * the app session and never in the user state. A Game asks 15 different
 * eligible Entries of its mode's kind: those in History when there are at
 * least 15, else any (ADR 0024). Playing never writes Seen, History or Active
 * Days; a finished Game writes only the best result, when it beats it.
 */
export interface Game {
  /**
   * The Game as it stands. A change never edits it: it makes a new one and
   * tells the subscribers, so it stays the same object until something changes.
   */
  readonly state: GameState;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Starts a new Game in the mode, in place of any Game there is. When the
   * mode can't start, no Game starts, the mode screen shows and the mode's
   * offer says why, as it did before.
   */
  start(modeId: string): Promise<void>;
  /**
   * Answers the current Round with the option at that place. A wrong answer
   * costs a Life at once. Nothing changes once the Round is answered.
   */
  answer(option: number): void;
  /**
   * «Далі» after an answer: at 0 Lives the Game is lost; after the last Round
   * it is won; otherwise the next Round comes. A Game that ends with more
   * Rounds passed than the best result becomes it, kept before it shows; when
   * that write fails, nothing changes. Nothing changes before an answer.
   */
  next(): Promise<void>;
  /** Drops the Game in play or just over, so the mode screen shows again. It never writes the best result. */
  leave(): void;
}

/** Whether two offers say the same, field by field. */
const sameOffer = (one: GameModeOffer, other: GameModeOffer | undefined) =>
  other !== undefined &&
  Object.keys(one).length === Object.keys(other).length &&
  Object.entries(one).every(([key, value]) => (other as Record<string, unknown>)[key] === value);

const sameOffers = (one: readonly GameModeOffer[], other: readonly GameModeOffer[]) =>
  one.length === other.length && one.every((offer, index) => sameOffer(offer, other[index]));

const { gameBest } = userStateRecords;

/** The offer of a Game Mode: it can start when it can make its Rounds. */
const offerOf = ({ id, entryKind }: GameMode, plan: RoundPlan): GameModeOffer =>
  'rounds' in plan
    ? { modeId: id, entryKind, canStart: true }
    : { modeId: id, entryKind, canStart: false, refusal: plan.refusal };

/**
 * Opens the Game over the eligible Entries and History, for the Core
 * composition, with `followEligibility`, which reads the modes on offer again
 * after a hide, a restore or a Mix change, and `planOffers`. The Game Modes
 * come in the order they register. Their offers say they are still planned
 * until a planning succeeds: the first is the one `planOffers` starts, which
 * the Core composition calls once it is open. The best result is read from
 * the user state once, when it opens, so open one per app session (the Core
 * composition does).
 */
export async function openGame({
  edition,
  entries,
  history,
  userState,
  random,
  schedule,
  modes: registered,
}: {
  edition: GameEdition;
  entries: Pick<Entries, 'eligibleOfKind'>;
  history: Pick<History, 'list'>;
  userState: Pick<UserState, 'read' | 'write'>;
  random: Random;
  /** What a failed planning of the offers is tried again by; without it, only the next `planOffers` tries. */
  schedule?: Schedule;
  modes: readonly GameMode[];
}): Promise<{
  game: Game;
  followEligibility: () => Promise<void>;
  /**
   * Plans the offers in the background, in turn with the Game's other
   * changes, unless they are planned already or a planning is under way. A
   * planning that fails is tried again after each delay of
   * `OFFER_PLANNING_RETRY_DELAYS` (1, 2 and 4 s), then no more: the offers
   * keep saying they are still planned until the next call, hide, restore or
   * Mix change. The Core composition calls it once it is open and on each
   * `resume`.
   */
  planOffers: () => void;
}> {
  const ids = new Set<string>();
  for (const { id } of registered) {
    if (ids.has(id)) throw new Error(`Two Game Modes have the id «${id}»`);
    ids.add(id);
  }
  const gameOn = edition.isFeatureEnabled('game');
  const modes = gameOn ? registered.filter((mode) => mode.isOn(edition)) : [];
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  let state: GameState = {
    modes: modes.map(({ id, entryKind }) => ({
      modeId: id,
      entryKind,
      canStart: false,
      planning: true,
    })),
    current: undefined,
    bestResult: gameOn ? await userState.read(gameBest) : undefined,
  };
  /** The mode of the Game in play and its Rounds, built when it starts. */
  let played: { readonly mode: GameMode; readonly rounds: readonly PlannedRound[] } | undefined;

  function change(next: GameState): void {
    state = next;
    subscribers.tell();
  }

  const changeCurrent = (current: CurrentGame | undefined) => {
    change({ ...state, current });
  };

  /** The one place that decides whether a mode can start, see `createRoundPlanner`. */
  const planRounds = createRoundPlanner({ history, random, edition });

  /**
   * Plans the modes on offer, once the composition is open and again after
   * each hide, restore or Mix change, and builds the Rounds still to come of the Game in
   * play anew, so an Entry hidden or taken out of the Mix meanwhile never
   * comes up. The Rounds shown so far stay; when the mode can't make the
   * rest, they stay as they were.
   */
  async function followEligibility(): Promise<void> {
    // Each mode with the eligible Entries of its kind, read afresh, all at once.
    const read = await Promise.all(
      modes.map(async (mode) => ({ mode, eligible: await entries.eligibleOfKind(mode.entryKind) })),
    );
    // Planned one after another, so the modes draw from the random source in turn.
    const offers = read.map(({ mode, eligible }) => offerOf(mode, planRounds(mode, eligible)));
    if (!sameOffers(offers, state.modes)) change({ ...state, modes: offers });
    const game = state.current;
    const eligible = read.find(({ mode }) => mode === played?.mode)?.eligible;
    if (
      played === undefined ||
      eligible === undefined ||
      (game?.status !== 'playing' && game?.status !== 'answered')
    ) {
      return;
    }
    const shown = played.rounds.slice(0, game.roundsPassed + 1);
    const rest = planRounds(
      played.mode,
      eligible,
      GAME_ROUNDS - shown.length,
      new Set(shown.map(({ answerId }) => answerId)),
    );
    if ('rounds' in rest) played = { mode: played.mode, rounds: [...shown, ...rest.rounds] };
  }

  /** Whether a planning of the offers is under way, or waits to try again. */
  let planningOffers = false;
  const unplanned = () => state.modes.some((offer) => 'planning' in offer);

  function planOffers(): void {
    if (planningOffers || !unplanned()) return;
    planningOffers = true;
    const tryPlanning = (delays: readonly number[]) => {
      inTurn(async () => {
        // A hide, a restore or a Mix change may have planned them meanwhile.
        if (unplanned()) await followEligibility();
      }).then(
        () => {
          planningOffers = false;
        },
        () => {
          const [delay, ...rest] = delays;
          if (schedule === undefined || delay === undefined) {
            planningOffers = false;
            return;
          }
          schedule(() => {
            tryPlanning(rest);
          }, delay);
        },
      );
    };
    tryPlanning(OFFER_PLANNING_RETRY_DELAYS);
  }

  const roundOf = ({ prompt, highlight, options }: RoundContent, number: number): Round => ({
    number,
    prompt,
    highlight,
    options,
    answer: undefined,
  });

  async function start(modeId: string): Promise<void> {
    const mode = modes.find(({ id }) => id === modeId);
    if (mode === undefined) throw new Error(`No Game Mode «${modeId}» is on offer`);
    const plan = planRounds(mode, await entries.eligibleOfKind(mode.entryKind));
    // The offer says what the plan does already, unless the mode's fair Rounds hang on the draw.
    const offers = state.modes.map((offer) =>
      offer.modeId === modeId ? offerOf(mode, plan) : offer,
    );
    const modesNow = sameOffers(offers, state.modes) ? state.modes : offers;
    const first = 'rounds' in plan ? plan.rounds[0] : undefined;
    if (!('rounds' in plan) || first === undefined) {
      played = undefined;
      change({ ...state, modes: modesNow, current: undefined });
      return;
    }
    played = { mode, rounds: plan.rounds };
    change({
      ...state,
      modes: modesNow,
      current: {
        modeId,
        round: roundOf(first.content, 1),
        roundsPassed: 0,
        lives: GAME_LIVES,
        status: 'playing',
      },
    });
  }

  function answer(option: number): void {
    const game = state.current;
    if (game?.status !== 'playing') return;
    const content = played?.rounds[game.round.number - 1]?.content;
    if (content?.options[option] === undefined) return;
    const { correct, sheet } = content;
    changeCurrent({
      ...game,
      round: { ...game.round, answer: { chosen: option, correct, sheet } },
      lives: option === correct ? game.lives : game.lives - 1,
      status: 'answered',
    });
  }

  async function next(): Promise<void> {
    const game = state.current;
    if (game?.status !== 'answered') return;
    if (game.lives === 0) {
      await finish(game, { ...game, status: 'lost' });
      return;
    }
    const roundsPassed = game.roundsPassed + 1;
    const upcoming = roundsPassed < GAME_ROUNDS ? played?.rounds[roundsPassed]?.content : undefined;
    if (upcoming === undefined) {
      await finish(game, { ...game, roundsPassed, status: 'won' });
      return;
    }
    changeCurrent({
      ...game,
      roundsPassed,
      round: roundOf(upcoming, roundsPassed + 1),
      status: 'playing',
    });
  }

  /**
   * Ends the Game, its Rounds passed the best result when they beat it: kept
   * in the user state first, so a failed write changes nothing. A Game left
   * during the write stays left.
   */
  async function finish(game: CurrentGame, over: CurrentGame): Promise<void> {
    const beaten = state.bestResult === undefined || over.roundsPassed > state.bestResult;
    if (beaten) await userState.write(gameBest.change(over.roundsPassed));
    change({
      ...state,
      current: state.current === game ? over : state.current,
      bestResult: beaten ? over.roundsPassed : state.bestResult,
    });
  }

  return {
    game: {
      get state() {
        return state;
      },
      subscribe: subscribers.subscribe,
      start: (modeId) => inTurn(() => start(modeId)),
      answer,
      next: () => inTurn(next),
      leave() {
        played = undefined;
        if (state.current !== undefined) changeCurrent(undefined);
      },
    },
    followEligibility: () => inTurn(followEligibility),
    planOffers,
  };
}
