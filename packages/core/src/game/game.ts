import type { EntryKind } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { Entries } from '../entries/entries';
import type { Knowledge } from '../knowledge/knowledge';
import type { History } from '../saved/history';
import { createInTurn, createSubscribers } from '../in-turn';
import type { LocalDate } from '../local-date';
import type { Clock, Random, Schedule } from '../ports';
import type { Subject } from '../subject';
import type { TextComparison } from '../text/text-comparison';
import type { UserState } from '../user-state/user-state';
import type { GivenAnswer } from './answer-forms';
import { createGameAwards, type RoundAward } from './game-awards';
import type { GameEdition, GameMode, GameHubGroup, GameModeRefusal } from './game-mode';
import { createGameClock, TIME_UP } from './game-time';
import type { GameRecords } from './game-xp';
import { createMoveOn } from './move-on';
import { createOfferPlanning } from './offer-planning';
import {
  answerRound,
  firstGame,
  nextRound,
  openRoundLetter,
  replanRounds,
  type EndedGame,
  type GameInPlayStatus,
  type GameOverStatus,
  type GameStatus,
  type GameTime,
  type PlayingGame,
  type RoundMove,
  type RoundRules,
  type RoundsPlan,
} from './round-machine';
import { createRoundPlanner, roundLimitOf, type RoundPlan } from './round-plan';

export type { RoundBlank } from './typed-form';
export type { GivenAnswer, RoundAnswer } from './answer-forms';
export type { GridCell, GridCellState } from './pairs-form';
export { answerBannerDelay } from './move-on';
export type { GameTime, PlayedRound, PlayingGame, Round } from './round-machine';

/** How many Lives a Game starts with, in a Game Mode that sets no Lives of its own. */
export const GAME_LIVES = 3;

/** The Lives a Game in the mode starts with; none in a mode without Lives. */
function livesOf({ lives = GAME_LIVES }: GameMode): number | undefined {
  return lives === 'none' ? undefined : lives;
}

/** The time limit of a Game in the mode, read at its start; none in a mode without one. */
const timeLimitOf = ({ timeLimit }: GameMode, edition: GameEdition): number | undefined =>
  typeof timeLimit === 'function' ? timeLimit(edition) : timeLimit;

/**
 * Whether a Game over counts as won: one won at its Round limit and one whose
 * time is up do, one lost with its last Life does not. The one place that
 * decides it, for the Game's end, its analytics event and its result screen.
 */
export const countsAsWon = ({ status }: { readonly status: GameOverStatus }): boolean =>
  status !== 'lost';

/**
 * How a Game ended (spec #1674): `finished` at its Round limit, `time-up` once
 * its time limit ran out, `lives-over` with its last Life lost. Each says the
 * Rounds played, the right answers, the XP the Game earned and whether it
 * beat the mode's Best result; a finished Game and a time-up also say whether
 * at least 60% of the answers were right, «Влучно!» rather than «Ще раунд!»
 * (spec #1880, as the board computes it).
 */
export type GameEnd = (
  | { readonly kind: 'finished' | 'time-up'; readonly onTarget: boolean }
  | { readonly kind: 'lives-over' }
) & {
  readonly played: number;
  readonly right: number;
  readonly xp: number;
  /** Whether the Game set a new Best result above the one before; a first Game with a result of 0 sets none. */
  readonly newBest: boolean;
};

/** A Game over, with how it ended. */
export type GameOver = EndedGame & { readonly end: GameEnd };

/** The Game in play, or just over with how it ended. */
export type CurrentGame = PlayingGame | GameOver;

/**
 * A Game Mode on offer, with what its card needs from the Core: the mode's
 * id, the kind of Entry it asks about, its Best result, and whether a Game in
 * it can start now, or why not; or, just after the Game opens, that it is
 * still planned.
 */
export type GameModeOffer = {
  readonly modeId: string;
  readonly entryKind: EntryKind;
  /** The group of the mode screen its card stands in. */
  readonly group: GameHubGroup;
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
 * counted: up to 5 the reader is weak on, at places drawn at random among
 * its first 15 Rounds, the rest
 * those in History when there are at least 15, else any. A mode
 * with no Round limit asks them again, reshuffled, once it has asked them all. A mode may set its own Lives too, or none, and a time limit. Playing never writes Seen, History or Active Days; a Round
 * answered right writes its XP, and a finished Game its mode's Best result,
 * when it beats it, with the XP of the finished Game and of the
 * new Best result (ADR 0066).
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
   * the next «Далі» goes on. In a mode that moves on, the next Round comes at
   * once. Once the play time of a timed Game is up, the answer counts for
   * nothing and the Game ends, should its schedule not have ended it yet.
   * Resolves once the mark is written; a mark that fails to write rejects,
   * for the shell to log, and the Game goes on.
   * Nothing changes once the Round is answered, or on an answer of another
   * form than the Round's.
   */
  answer(given: GivenAnswer): Promise<void>;
  /**
   * «Далі» after an answer: at 0 Lives the Game is lost; after the last Round
   * of the mode's limit, or the last one it has, it is won; otherwise the next Round comes. A Game that ends with more
   * right answers than the best result makes them it, kept before it shows; when
   * that write fails, nothing changes. Nothing changes before an answer.
   */
  next(): Promise<void>;
  /**
   * «Відкрити літеру»: opens the first blank of the current Round's typed
   * text, one letter at a time until one is left, at no cost. Nothing changes
   * in a Round without blanks, with one blank left or once it is answered.
   */
  openLetter(): void;
  /**
   * Keeps the answered Round until `done` settles as well as its banner's
   * delay has passed, with the banner on: so the screen has VoiceOver read
   * the banner before the next Round. Nothing changes once the delay has
   * passed or with no move on to come.
   */
  waitFor(done: Promise<unknown>): void;
  /** Drops the Game in play or just over, so the mode screen shows again. It never writes the best result. */
  leave(): void;
  /**
   * Stops the clock of a timed Game in play, as the app goes to the
   * background, keeping the play time it has left. Nothing changes in
   * another Game or one already paused.
   */
  pause(): Promise<void>;
  /**
   * Runs the clock of a paused timed Game again, as the app comes back from
   * the background, from the play time it had left. Nothing changes in
   * another Game or one whose clock runs.
   */
  resume(): Promise<void>;
}

/** Whether two offers say the same, field by field, their Best results included. */
const sameOffer = (one: GameModeOffer, other: GameModeOffer | undefined) => {
  if (other === undefined) return false;
  const theirs = new Map<string, unknown>(Object.entries(other));
  return (
    Object.keys(one).length === theirs.size &&
    Object.entries(one).every(([key, value]) =>
      key === 'best'
        ? one.best?.result === other.best?.result && one.best?.of === other.best?.of
        : theirs.get(key) === value,
    )
  );
};

const sameOffers = (one: readonly GameModeOffer[], other: readonly GameModeOffer[]) =>
  one.length === other.length && one.every((offer, index) => sameOffer(offer, other[index]));

/** Whether the Game is still in play: a Round to answer, or one answered and waiting for «Далі». */
const inPlay = <Game extends { readonly status: GameStatus }>(
  game: Game,
): game is Extract<Game, { readonly status: GameInPlayStatus }> =>
  game.status === 'playing' || game.status === 'answered';

/**
 * How a Game just over ended, by its status: its last Life lost, its time up,
 * or its Round limit reached; at least 60% of the answers right is on target.
 */
function endOf(ended: EndedGame, counts: Omit<GameEnd, 'kind' | 'onTarget'>): GameEnd {
  if (!countsAsWon(ended)) return { kind: 'lives-over', ...counts };
  const onTarget = counts.played > 0 && counts.right * 5 >= counts.played * 3;
  return { kind: ended.status === 'time-up' ? 'time-up' : 'finished', onTarget, ...counts };
}

/** A mode's Best result as its offer says it, out of the mode's Round limit when it has one. */
function offeredBest(mode: GameMode, result: number): OfferedBest {
  const of = roundLimitOf(mode);
  return of === undefined ? { result } : { result, of };
}

/** What every offer of a Game Mode says: its id, kind, group and Best result, if any. */
const offeredMode = (mode: GameMode, best: number | undefined) => ({
  modeId: mode.id,
  entryKind: mode.entryKind,
  group: mode.group,
  ...(best === undefined ? {} : { best: offeredBest(mode, best) }),
});

/** The offer of a Game Mode: it can start when it can make its Rounds. */
const offerOf = (mode: GameMode, plan: RoundPlan, best: number | undefined): GameModeOffer =>
  'rounds' in plan
    ? { ...offeredMode(mode, best), canStart: true }
    : { ...offeredMode(mode, best), canStart: false, refusal: plan.refusal };

/**
 * Opens the Game over the eligible Entries, History and the Knowledge Marks,
 * for the Core composition. It reads the modes on offer again on
 * `eligibility`, after a hide, a restore or a Mix change. The Game Modes come
 * in the order they register. Their offers say they are still planned until a
 * planning succeeds: the first is the one `dayTurned` starts, once the
 * composition is open, and on each `dayTurned` and `returned` the Game tries
 * again should every try have failed. The best result is read from the user
 * state once, when it opens, so open one per app session (the Core
 * composition does).
 */
export async function openGame({
  edition,
  comparison,
  entries,
  history,
  knowledge,
  xp,
  userState,
  clock,
  random,
  schedule,
  modes: registered,
  eligibility,
  dayTurned,
  returned,
  analytics,
}: {
  edition: GameEdition;
  /** The Edition's text comparison, built once by the composition. */
  comparison: TextComparison;
  entries: Pick<Entries, 'eligibleOfKind'>;
  history: Pick<History, 'list'>;
  knowledge: Pick<Knowledge, 'weak' | 'answer' | 'confirm'>;
  /**
   * The XP log, which a right Round, a finished Game and a new Best result
   * earn XP in, and which keeps each Round answered wrong.
   */
  xp: GameRecords;
  userState: Pick<UserState, 'read' | 'write'>;
  /** What a timed Game's play time is told by. */
  clock: Pick<Clock, 'now'>;
  random: Random;
  /**
   * What a failed planning of the offers is tried again by, and what ends a
   * timed Game once its play time is up; without it, only the next
   * `planOffers` tries, and a timed Game ends on its first answer after.
   */
  schedule?: Schedule;
  modes: readonly GameMode[];
  eligibility: Pick<Subject<void>, 'subscribe'>;
  dayTurned: Pick<Subject<LocalDate>, 'subscribe'>;
  returned: Pick<Subject<void>, 'subscribe'>;
  /** Where a Game started and finished go (ADR 0068). */
  analytics?: Pick<Analytics, 'track'>;
}): Promise<Game> {
  const ids = new Set<string>();
  for (const { id } of registered) {
    if (ids.has(id)) throw new Error(`Two Game Modes have the id «${id}»`);
    ids.add(id);
  }
  const gameOn = edition.isFeatureEnabled('game');
  const modes = gameOn ? registered.filter((mode) => mode.isOn(edition)) : [];
  const subscribers = createSubscribers();
  const inTurn = createInTurn();
  const awards = createGameAwards({ xp, userState });

  const bestResults = await awards.bestResults(modes);
  let state: GameState = {
    modes: modes.map((mode) => ({
      ...offeredMode(mode, bestResults[mode.id]),
      canStart: false,
      planning: true,
    })),
    current: undefined,
    bestResults,
  };
  /** The Rounds of the Game in play, or just over; none on the mode screen. */
  let played: { readonly rules: RoundRules; readonly plan: RoundsPlan } | undefined;
  /** When the Game in play started, by the clock. */
  let startedAt = clock.now();

  function change(next: GameState): void {
    state = next;
    subscribers.tell();
  }

  const changeCurrent = (current: CurrentGame | undefined) => {
    change({ ...state, current });
  };

  /** The one place that decides whether a mode can start, see `createRoundPlanner`. */
  const planRounds = createRoundPlanner({ history, knowledge, random, edition, comparison });

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
    const eligible = read.find(({ mode }) => mode.id === game?.modeId)?.eligible;
    if (played !== undefined && game !== undefined && inPlay(game) && eligible !== undefined) {
      played = { ...played, plan: replanRounds(played.rules, played.plan, game, eligible) };
    }
  }

  const unplanned = () => state.modes.some((offer) => 'planning' in offer);

  /**
   * Plans the offers in the background, in turn with the Game's other
   * changes: the offers keep saying they are still planned until the next
   * day turned to, return, hide, restore or Mix change, should every try fail.
   */
  const planOffers = createOfferPlanning({
    schedule,
    unplanned,
    plan: () =>
      inTurn(async () => {
        // A hide, a restore or a Mix change may have planned them meanwhile.
        if (unplanned()) await followEligibility();
      }),
  });

  /** The play time of a timed Game, which ends it once it has run out. */
  const time = createGameClock({
    clock,
    schedule,
    timeUp(ran) {
      // A write that fails leaves the Game to end on its next answer.
      inTurn(() => timeUp(ran)).catch(() => undefined);
    },
  });

  /**
   * The move on from an answered Round by itself, unless the Game moved on,
   * ended or was left since. A move on that fails to write takes the banner
   * down, so the sheet's «Далі» tries again.
   */
  const moveOn = createMoveOn({
    schedule,
    moveOn: (shown) =>
      inTurn(async () => {
        const game = state.current;
        if (game?.status !== 'answered' || game.round !== shown.round) return;
        try {
          await next();
        } catch {
          // The write failed and the Round stays answered: «Далі» tries again.
          changeCurrent({ ...game, banner: false });
        }
      }),
  });

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
    const rules: RoundRules = {
      mode,
      lives: livesOf(mode),
      planRounds,
      comparison,
      // With no schedule, nothing moves it on.
      banner: schedule !== undefined,
    };
    const rounds: RoundsPlan = { rounds: 'rounds' in plan ? plan.rounds : [], eligible };
    const firstRound = firstGame(rules, rounds);
    played = firstRound && { rules, plan: rounds };
    time.stop();
    moveOn.stop();
    const timeLimit = timeLimitOf(mode, edition);
    const first =
      firstRound && timeLimit !== undefined
        ? { ...firstRound, timeLimit, time: time.run(timeLimit) }
        : firstRound;
    change({ ...state, modes: modesNow, current: first });
    if (first === undefined) return;
    startedAt = clock.now();
    awards.start();
    void analytics?.track('gameStarted', { mode: modeId }).catch(() => undefined);
  }

  /**
   * Ends the Game in play once the clock that `ran` started has run out,
   * unless the Game paused or ended since.
   */
  async function timeUp(ran: GameTime): Promise<void> {
    const game = state.current;
    if (game?.time !== ran || !inPlay(game)) return;
    time.stop();
    await finish(game, { ...game, time: TIME_UP, status: 'time-up' });
  }

  /** The move of the Round machine kept: the Rounds planned after it; the Game it made is for the caller to show. */
  function moved(move: RoundMove | undefined): RoundMove['game'] | undefined {
    if (played !== undefined && move !== undefined) played = { ...played, plan: move.plan };
    return move?.game;
  }

  async function answer(given: GivenAnswer): Promise<void> {
    const game = state.current;
    if (game === undefined || !inPlay(game)) return;
    const ran = game.time;
    if (ran !== undefined && time.isOut(ran)) {
      await inTurn(() => timeUp(ran));
      return;
    }
    const answered = moved(played && answerRound(played.rules, played.plan, game, given));
    if (answered === undefined) return;
    const round = answered.played.at(-1);
    const award = round && awards.round(game.modeId, round);
    if (inPlay(answered)) {
      const xpShown = award !== undefined && award.amount > 0 ? award.amount : undefined;
      const shown: PlayingGame =
        answered.status === 'answered' && answered.answered.kind === 'right'
          ? { ...answered, answered: { kind: 'right', xp: xpShown } }
          : answered;
      changeCurrent(shown);
      moveOn.later(shown);
      if (award !== undefined) {
        if (award.piece.changes.size > 0) await inTurn(() => awards.writeRound(award));
        awards.earned(award);
      }
    } else await inTurn(() => finish(game, answered, award));
    if (round === undefined) return;
    // The Knowledge Mark of the answer, written in the background of the Game going on.
    await inTurn(() =>
      round.right ? knowledge.confirm(round.entry.id) : knowledge.answer(round.entry.id, 'unknown'),
    );
  }

  async function next(): Promise<void> {
    const game = state.current;
    if (game === undefined || !inPlay(game)) return;
    const after = moved(played && nextRound(played.rules, played.plan, game));
    if (after === undefined) return;
    if (inPlay(after)) changeCurrent(after);
    else await finish(game, after);
  }

  /**
   * Ends the Game with what its awards came to, written before it shows, so
   * a failed write changes nothing. A Game left during the write stays left.
   */
  async function finish(
    game: PlayingGame,
    ended: EndedGame,
    lastRound?: RoundAward,
  ): Promise<void> {
    const {
      right,
      beaten,
      newBest,
      xp: earned,
    } = await awards.finish(ended, state.bestResults[ended.modeId], lastRound);
    const over: GameOver = {
      ...ended,
      end: endOf(ended, { played: ended.played.length, right, xp: earned, newBest }),
    };
    void analytics
      ?.track('gameFinished', {
        mode: over.modeId,
        durationSeconds: Math.round((clock.now().getTime() - startedAt.getTime()) / 1000),
        right,
        played: over.played.length,
        // Analytics keeps its two results: a Game whose time is up counts as won.
        status: countsAsWon(over) ? 'won' : 'lost',
      })
      .catch(() => undefined);
    const mode = beaten ? modes.find(({ id }) => id === over.modeId) : undefined;
    change({
      ...state,
      modes: state.modes.map((offer) =>
        offer.modeId === mode?.id ? { ...offer, best: offeredBest(mode, right) } : offer,
      ),
      current: state.current === game ? over : state.current,
      bestResults: beaten ? { ...state.bestResults, [over.modeId]: right } : state.bestResults,
    });
  }

  /** Stops the clock of the timed Game in play while it runs. */
  function pause(): void {
    const game = state.current;
    if (game === undefined || !inPlay(game)) return;
    const paused = time.paused(game.time);
    if (paused !== undefined) changeCurrent({ ...game, time: paused });
  }

  /** Runs the clock of the paused timed Game in play again. */
  function resume(): void {
    const game = state.current;
    if (game === undefined || !inPlay(game)) return;
    const resumed = time.resumed(game.time);
    if (resumed !== undefined) changeCurrent({ ...game, time: resumed });
  }

  /** After a Progress reset, reads each mode's Best result again, which is none until a Game after it. */
  let resetFollowed = xp.resetMarker?.id;
  async function followReset(): Promise<void> {
    if (xp.resetMarker?.id === resetFollowed) return;
    resetFollowed = xp.resetMarker?.id;
    const bestResults = await awards.bestResults(modes);
    change({
      ...state,
      bestResults,
      modes: state.modes.map((offer) => {
        const mode = modes.find(({ id }) => id === offer.modeId);
        if (mode === undefined) return offer;
        const next = { ...offer, ...offeredMode(mode, bestResults[mode.id]) };
        if (bestResults[mode.id] === undefined) delete next.best;
        return next;
      }),
    });
  }

  eligibility.subscribe(() => inTurn(followEligibility));
  xp.subscribe(() => {
    inTurn(followReset).catch(() => undefined);
  });
  dayTurned.subscribe(planOffers);
  returned.subscribe(planOffers);

  return {
    get state() {
      return state;
    },
    subscribe: subscribers.subscribe,
    start: (modeId) => inTurn(() => start(modeId)),
    answer,
    next: () => inTurn(next),
    pause: () =>
      inTurn(() => {
        pause();
        return Promise.resolve();
      }),
    resume: () =>
      inTurn(() => {
        resume();
        return Promise.resolve();
      }),
    openLetter() {
      const game = state.current;
      const opened =
        played && game && inPlay(game) ? openRoundLetter(played.plan, game) : undefined;
      if (opened !== undefined) changeCurrent(opened);
    },
    waitFor(done) {
      moveOn.waitFor(done);
    },
    leave() {
      played = undefined;
      time.stop();
      moveOn.stop();
      if (state.current !== undefined) changeCurrent(undefined);
    },
  };
}
