import type { EntryKind } from '@slovo/contracts';

import type { Entries } from '../entries/entries';
import type { Knowledge } from '../knowledge/knowledge';
import type { History } from '../saved/history';
import { createInTurn, createSubscribers } from '../in-turn';
import type { Random, Schedule } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type { GameEdition, GameMode, GameModeRefusal } from './game-mode';
import {
  createGameInPlay,
  type CurrentGame,
  type GameInPlay,
  type GivenAnswer,
} from './game-in-play';
import { createRoundPlanner, roundLimitOf, type RoundPlan } from './round-plan';

/** How long the Game waits before each new try of a failed planning of its offers, in milliseconds. */
const OFFER_PLANNING_RETRY_DELAYS: readonly number[] = [1_000, 2_000, 4_000];

/**
 * A Game Mode on offer, with what its card needs from the Core: the mode's
 * id, the kind of Entry it asks about, its Best result, and whether a Game in
 * it can start now, or why not; or, just after the Game opens, that it is
 * still planned.
 */
export type GameModeOffer = {
  readonly modeId: string;
  readonly entryKind: EntryKind;
  /** The mode's Best result; left out before its first finished Game. */
  readonly best?: OfferedBest;
} & (
  | { readonly canStart: true }
  | { readonly canStart: false; readonly refusal: GameModeRefusal }
  | { readonly canStart: false; readonly planning: true }
);

/**
 * The Best result on a mode's offer: `of` is the mode's Round limit, when it
 * has one, so that the result counts Rounds of it («12 з 15»); without one
 * the result is a bare number («23»).
 */
export interface OfferedBest {
  readonly result: number;
  readonly of?: number;
}

/** The Game as it stands: the modes on offer, the Game in play and each mode's Best result. */
export interface GameState {
  /** The Game Modes the Edition turns on, in the order they register; none with the Game off. */
  readonly modes: readonly GameModeOffer[];
  /** The Game in play or just over; none on the mode screen. */
  readonly current: CurrentGame | undefined;
  /**
   * The Best result of each Game Mode on offer, by mode id, the Game just
   * over included: the best result of one finished Game in it (`resultOf`).
   * A mode has none before its first finished Game; none has with the Game off.
   */
  readonly bestResults: Readonly<Partial<Record<string, number>>>;
}

/**
 * The Game: the Game Modes on offer and the Game in play, kept in memory for
 * the app session and never in the user state. A Game asks as many
 * different eligible Entries of the kinds its mode asks about as the mode's
 * Round limit, 15 by default (`roundsToPlanOf`), each pair of a grid
 * counted: up to 5 the reader is weak on, first (ADR 0043, 0052), the rest
 * those in History when there are at least 15, else any (ADR 0024). A mode
 * with no Round limit asks them again, reshuffled, once it has asked them all. A mode may set its own Lives too, or none (ADR 0052). Playing never writes Seen, History or Active Days; a finished Game
 * writes only its mode's Best result, when it beats it (ADR 0052).
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
   * Answers the current Round in its form: an option picked, a vowel tapped,
   * a pair matched, chips in order or typed text. A wrong answer costs a Life
   * at once and marks the Round's Entry «Не знаю» in the background, before
   * the next «Далі» goes on. Resolves once the mark is written; a mark that
   * fails to write rejects, for the shell to log, and the Game goes on.
   * Nothing changes once the Round is answered, or on an answer of another
   * form than the Round's.
   */
  answer(given: GivenAnswer): Promise<void>;
  /**
   * «Далі» after an answer: at 0 Lives the Game is lost; after the last Round
   * of the mode's limit, or the last one it has, it is won; otherwise the next Round comes. A Game that ends with more
   * Rounds passed than the best result becomes it, kept before it shows; when
   * that write fails, nothing changes. Nothing changes before an answer.
   */
  next(): Promise<void>;
  /**
   * «Відкрити літеру»: opens the first blank of the current Round's typed
   * text, one letter at a time until one is left, at no cost. Nothing changes
   * in a Round without blanks, with one blank left or once it is answered.
   */
  openLetter(): void;
  /** Drops the Game in play or just over, so the mode screen shows again. It never writes the best result. */
  leave(): void;
}

/** Whether two offers say the same, field by field, their Best results included. */
const sameOffer = (one: GameModeOffer, other: GameModeOffer | undefined) =>
  other !== undefined &&
  Object.keys(one).length === Object.keys(other).length &&
  Object.entries(one).every(([key, value]) =>
    key === 'best'
      ? one.best?.result === other.best?.result && one.best?.of === other.best?.of
      : (other as Record<string, unknown>)[key] === value,
  );

const sameOffers = (one: readonly GameModeOffer[], other: readonly GameModeOffer[]) =>
  one.length === other.length && one.every((offer, index) => sameOffer(offer, other[index]));

const { gameBest } = userStateRecords;

/**
 * The result of a finished Game, which its mode's Best result keeps: the
 * right answers in a mode with no Lives, such as «На час», else the Rounds
 * passed (ADR 0052).
 */
const resultOf = (over: CurrentGame): number =>
  over.lives === undefined ? over.played.filter(({ right }) => right).length : over.roundsPassed;

/** A mode's Best result as its offer says it, out of the mode's Round limit when it has one. */
function offeredBest(mode: GameMode, result: number): OfferedBest {
  const of = roundLimitOf(mode);
  return of === undefined ? { result } : { result, of };
}

/** What every offer of a Game Mode says: its id, kind and Best result, if any. */
const offeredMode = (mode: GameMode, best: number | undefined) => ({
  modeId: mode.id,
  entryKind: mode.entryKind,
  ...(best === undefined ? {} : { best: offeredBest(mode, best) }),
});

/** The offer of a Game Mode: it can start when it can make its Rounds. */
const offerOf = (mode: GameMode, plan: RoundPlan, best: number | undefined): GameModeOffer =>
  'rounds' in plan
    ? { ...offeredMode(mode, best), canStart: true }
    : { ...offeredMode(mode, best), canStart: false, refusal: plan.refusal };

/**
 * Opens the Game over the eligible Entries, History and the Knowledge Marks,
 * for the Core composition, with `followEligibility`, which reads the modes
 * on offer again after a hide, a restore or a Mix change, and `planOffers`. The Game Modes
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
  knowledge,
  userState,
  random,
  schedule,
  modes: registered,
}: {
  edition: GameEdition;
  entries: Pick<Entries, 'eligibleOfKind'>;
  history: Pick<History, 'list'>;
  knowledge: Pick<Knowledge, 'weak' | 'answer'>;
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

  const bestResults = await bestResultsOf(modes);
  let state: GameState = {
    modes: modes.map((mode) => ({
      ...offeredMode(mode, bestResults[mode.id]),
      canStart: false,
      planning: true,
    })),
    current: undefined,
    bestResults,
  };
  /** The Game in play, or just over; none on the mode screen. */
  let played: GameInPlay | undefined;

  function change(next: GameState): void {
    state = next;
    subscribers.tell();
  }

  const changeCurrent = (current: CurrentGame | undefined) => {
    change({ ...state, current });
  };

  /** The one place that decides whether a mode can start, see `createRoundPlanner`. */
  const planRounds = createRoundPlanner({ history, knowledge, random, edition });

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
      modes.map(async (mode) => ({
        mode,
        eligible: await entries.eligibleOfKind(mode.entryKind, mode.alsoAsks),
      })),
    );
    // Planned one after another, so the modes draw from the random source in turn.
    const offers = read.map(({ mode, eligible }) =>
      offerOf(mode, planRounds(mode, eligible), state.bestResults[mode.id]),
    );
    if (!sameOffers(offers, state.modes)) change({ ...state, modes: offers });
    const game = state.current;
    const eligible = read.find(({ mode }) => mode === played?.mode)?.eligible;
    if (game !== undefined && eligible !== undefined) played?.replan(game, eligible);
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

  async function start(modeId: string): Promise<void> {
    const mode = modes.find(({ id }) => id === modeId);
    if (mode === undefined) throw new Error(`No Game Mode «${modeId}» is on offer`);
    const eligible = await entries.eligibleOfKind(mode.entryKind, mode.alsoAsks);
    const plan = planRounds(mode, eligible);
    // The offer says what the plan does already, unless the mode's fair Rounds hang on the draw.
    const offers = state.modes.map((offer) =>
      offer.modeId === modeId ? offerOf(mode, plan, state.bestResults[modeId]) : offer,
    );
    const modesNow = sameOffers(offers, state.modes) ? state.modes : offers;
    played =
      'rounds' in plan ? createGameInPlay(mode, plan.rounds, planRounds, eligible) : undefined;
    change({ ...state, modes: modesNow, current: played?.first });
  }

  async function answer(given: GivenAnswer): Promise<void> {
    const game = state.current;
    const answered = game && played?.answer(game, given);
    if (answered === undefined) return;
    changeCurrent(answered);
    const round = answered.played.at(-1);
    if (round !== undefined && !round.right) {
      await inTurn(() => knowledge.answer(round.entry.id, 'unknown'));
    }
  }

  async function next(): Promise<void> {
    const game = state.current;
    const after = game && played?.next(game);
    if (game === undefined || after === undefined) return;
    if (after.status === 'playing') changeCurrent(after);
    else await finish(game, after);
  }

  /**
   * Ends the Game, its Rounds passed the best result when they beat it: kept
   * in the user state first, so a failed write changes nothing. A Game left
   * during the write stays left.
   */
  async function finish(game: CurrentGame, over: CurrentGame): Promise<void> {
    const result = resultOf(over);
    const best = state.bestResults[over.modeId];
    const beaten = best === undefined || result > best;
    if (beaten) await userState.write(gameBest.record(over.modeId).change(result));
    const mode = beaten ? modes.find(({ id }) => id === over.modeId) : undefined;
    change({
      ...state,
      modes: state.modes.map((offer) =>
        offer.modeId === mode?.id ? { ...offer, best: offeredBest(mode, result) } : offer,
      ),
      current: state.current === game ? over : state.current,
      bestResults: beaten ? { ...state.bestResults, [over.modeId]: result } : state.bestResults,
    });
  }

  /** The Best result of each mode, read from the user state; a mode with none is left out. */
  async function bestResultsOf(
    on: readonly GameMode[],
  ): Promise<Readonly<Partial<Record<string, number>>>> {
    const read = await Promise.all(
      on.map(async ({ id }) => [id, await userState.read(gameBest.record(id))] as const),
    );
    return Object.fromEntries(read.filter(([, best]) => best !== undefined));
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
      openLetter() {
        const game = state.current;
        const opened = game && played?.openLetter(game);
        if (opened !== undefined) changeCurrent(opened);
      },
      leave() {
        played = undefined;
        if (state.current !== undefined) changeCurrent(undefined);
      },
    },
    followEligibility: () => inTurn(followEligibility),
    planOffers,
  };
}
