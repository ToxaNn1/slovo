import type { EntryKind } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { AskableEntry, AskableKind, EligibleOfKind, Entries } from '../entries/entries';
import type { Knowledge } from '../knowledge/knowledge';
import type { GameXp, XpAward } from './game-xp';
import type { History } from '../saved/history';
import { createInTurn, createSubscribers } from '../in-turn';
import type { LocalDate } from '../local-date';
import type { Clock, Random, Schedule, UserStateChanges } from '../ports';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import type {
  AnswerSheet,
  ChipKind,
  FixedChip,
  GameEdition,
  GameMode,
  GameModeGroup,
  GameModeRefusal,
  RoundLabelKind,
  RoundOption,
  TextRange,
} from './game-mode';
import { chipsMatch, entriesIn, roundsIn } from './game-mode';
import { LIFE_LOST_DELAY } from './game-haptics';
import {
  createRoundPlanner,
  GAME_ROUNDS,
  roundLimitOf,
  type PlannedRound,
  type RoundPlan,
  type RoundPlanner,
} from './round-plan';
import { typedAnswerMatches } from './typed-answer';

/** How many Lives a Game starts with, in a Game Mode that sets no Lives of its own. */
export const GAME_LIVES = 5;

/** The Lives a Game in the mode starts with; none in a mode without Lives. */
const livesOf = ({ lives = GAME_LIVES }: GameMode): number | undefined =>
  lives === 'none' ? undefined : lives;

/** The answer the reader gives a Round, in the Round's form. */
export type GivenAnswer =
  | { readonly form: 'pick'; readonly option: number }
  | {
      readonly form: 'vowel';
      /** Where in the prompt the vowel tapped stands. */
      readonly position: number;
    }
  | {
      readonly form: 'pairs';
      /** The place of the Word tapped among the grid's Words, then of the Definition among its Definitions. */
      readonly word: number;
      readonly definition: number;
    }
  | {
      readonly form: 'chips';
      /** The places of the chips tapped, in the order tapped. */
      readonly chips: readonly number[];
    }
  | { readonly form: 'typed'; readonly text: string };

/** The answer given to a Round, judged: whether it is right, and the sheet to show. */
export type RoundAnswer = {
  readonly right: boolean;
  readonly sheet: AnswerSheet;
} & (
  | {
      readonly form: 'pick';
      /** The place of the option the reader chose. */
      readonly chosen: number;
      /** The place of the right option. */
      readonly correct: number;
    }
  | {
      readonly form: 'vowel';
      /** Where in the prompt the vowel tapped stands. */
      readonly chosen: number;
      /** Where the stressed vowels stand. */
      readonly stressed: readonly number[];
    }
  | {
      readonly form: 'pairs';
      /** The place of the Word tapped among the grid's Words, then of the Definition among its Definitions. */
      readonly word: number;
      readonly definition: number;
      /** The place of the Word's own Definition. */
      readonly correct: number;
    }
  | {
      readonly form: 'chips';
      /** The places of the chips tapped, in the order tapped. */
      readonly chosen: readonly number[];
      /** The chips in the right order. */
      readonly expected: readonly string[];
    }
  | {
      readonly form: 'typed';
      readonly typed: string;
      /** The text to type. */
      readonly expected: string;
    }
);

/** A cell of a pairs grid as the reader sees it: a Word or a Definition; one of a pair answered is gone. */
export interface GridCell<T> {
  readonly shown: T;
  readonly gone: boolean;
}

/**
 * One character of a typed Round's text shown as blanks: a mark that stays in
 * place, such as an apostrophe, a letter «Відкрити літеру» opened, or a blank
 * with no letter yet.
 */
export type RoundBlank = { readonly mark: string } | { readonly letter?: string };

/**
 * A Round as the reader plays it, in its answer form, the right answer kept
 * out, and resolved for the shell to draw: whether its prompt has a gap, how
 * each blank shows and when a wrong answer costs its Life (ADR 0017).
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
} & (
  | { readonly form: 'pick'; readonly options: readonly RoundOption[] }
  | { readonly form: 'vowel'; readonly vowels: readonly number[] }
  | {
      readonly form: 'pairs';
      /** The grid's Words in the order shown, then its Definitions; a pair answered is gone from both. */
      readonly words: readonly GridCell<RoundOption>[];
      readonly definitions: readonly GridCell<string>[];
    }
  | {
      readonly form: 'chips';
      /** What the chips are, a Word's letters or an expression's words. */
      readonly chipKind: ChipKind;
      readonly chips: readonly string[];
      /** The characters of the answer that stay in place among the chips. */
      readonly fixed: readonly FixedChip[];
    }
  | {
      readonly form: 'typed';
      /** The text to type as blanks, one per character; no blanks in a Round that shows none. */
      readonly blanks: readonly RoundBlank[] | undefined;
      /** Whether «Відкрити літеру» opens a letter: while more than one blank is left. */
      readonly canOpenLetter: boolean;
    }
);

/** A Round the reader answered: what the Game Review lists. */
export type PlayedRound = Round & {
  /** The Entry the Round asked about: of a pairs grid, the Word tapped. */
  readonly entry: AskableEntry;
  readonly answer: RoundAnswer;
  /** Whether the reader answered right. */
  readonly right: boolean;
};

/**
 * Where a Game stands: a Round to answer, a Round answered and waiting for
 * «Далі», or over, won or lost.
 */
export type GameStatus = 'playing' | 'answered' | 'won' | 'lost';

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

/** The Game in play, or just over. */
export interface CurrentGame {
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
  /** The Lives left, from the mode's Lives (`GAME_LIVES` by default) to 0; none in a mode without Lives. */
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
  readonly status: GameStatus;
}

/**
 * The Game in play: the Rounds, planned when the Game starts, and the moves
 * of a `CurrentGame` through them, which `openGame` wraps with what the
 * Rounds know nothing of: the play time, the Knowledge Marks, the Best
 * result and the order of the Game's changes (ADR 0052). A move never edits
 * the Game it takes: it makes a new one, and leaves showing it to `openGame`.
 */
interface GameInPlay {
  /** The Game at its first Round, with every Life. */
  readonly first: CurrentGame;
  /**
   * The Game with its Round answered: a wrong answer costs a Life, in a mode
   * with Lives. In a mode that moves on, the Game goes on to its next Round
   * at once, as `next` does. Nothing unless a Round waits for an answer in that form and
   * the answer names something the Round has.
   */
  answer(game: CurrentGame, given: GivenAnswer): CurrentGame | undefined;
  /**
   * The Game after «Далі»: lost at 0 Lives, won after the last Round of the
   * mode's limit or, without one, after the last Round the mode can plan,
   * else at the next Round. Nothing before an answer.
   */
  next(game: CurrentGame): CurrentGame | undefined;
  /**
   * The Game with «Відкрити літеру»: the first blank of the Round's typed
   * text opened, at no cost. Nothing unless the Round waits for an answer
   * and more than one blank is left.
   */
  openLetter(game: CurrentGame): CurrentGame | undefined;
  /**
   * Builds the Rounds after the ones the Game has shown anew from the
   * eligible Entries of the mode's kind, while the Game is not over. When the
   * mode can't make the rest, they stay as they were.
   */
  replan(game: CurrentGame, eligible: EligibleOfKind<AskableEntry>): void;
}

/** The pairs of a grid answered so far, by the Rounds played in it: the places of their Words and Definitions. */
function pairsGone(
  played: readonly PlayedRound[],
  inGrid: number,
): { words: Set<number>; definitions: Set<number> } {
  const words = new Set<number>();
  const definitions = new Set<number>();
  for (const { answer } of played.slice(played.length - inGrid)) {
    if (answer.form !== 'pairs') continue;
    words.add(answer.word);
    definitions.add(answer.correct);
  }
  return { words, definitions };
}

/** The Round as the reader sees it, its right answer kept out; of a pairs grid, with the pairs played in it gone. */
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
  switch (content.form) {
    case 'pick':
      return { ...base, form: 'pick', options: content.options };
    case 'vowel':
      return { ...base, form: 'vowel', vowels: content.vowels };
    case 'pairs': {
      const gone = pairsGone(played, inGrid);
      const pairAt = (place: number) => {
        const pair = content.pairs[place];
        if (pair === undefined) throw new Error(`The pairs grid has no pair at ${String(place)}`);
        return pair;
      };
      return {
        ...base,
        form: 'pairs',
        words: content.wordOrder.map((pair, place) => ({
          shown: pairAt(pair).word,
          gone: gone.words.has(place),
        })),
        definitions: content.definitionOrder.map((pair, place) => ({
          shown: pairAt(pair).definition,
          gone: gone.definitions.has(place),
        })),
      };
    }
    case 'chips':
      return {
        ...base,
        form: 'chips',
        chipKind: content.chipKind,
        chips: content.chips,
        fixed: content.fixed ?? [],
      };
    case 'typed': {
      const inPlace = content.blanks?.inPlace;
      const blanks =
        inPlace &&
        Array.from(content.expected, (character, place): RoundBlank =>
          inPlace.includes(place) ? { mark: character } : {},
        );
      return { ...base, form: 'typed', blanks, canOpenLetter: canOpenLetterIn(blanks) };
    }
  }
}

/** Whether a blank shows no letter or mark yet. */
const isEmpty = (blank: RoundBlank) => !('mark' in blank) && blank.letter === undefined;

/** Whether more than one blank is left, so that «Відкрити літеру» may open one. */
const canOpenLetterIn = (blanks: readonly RoundBlank[] | undefined) =>
  blanks !== undefined && blanks.filter(isEmpty).length > 1;

/**
 * The answer judged against the Round's content, with the Entry it asked
 * about; nothing when the answer is of another form or names something the
 * Round doesn't have, such as a pair already gone.
 */
function judge(
  { entry, content }: PlannedRound,
  round: Round,
  given: GivenAnswer,
): { answer: RoundAnswer; entry: AskableEntry } | undefined {
  if (content.form !== given.form) return undefined;
  switch (content.form) {
    case 'pick': {
      if (given.form !== 'pick' || content.options[given.option] === undefined) return undefined;
      const { correct, sheet } = content;
      const chosen = given.option;
      return { entry, answer: { form: 'pick', chosen, correct, right: chosen === correct, sheet } };
    }
    case 'vowel': {
      if (given.form !== 'vowel' || !content.vowels.includes(given.position)) return undefined;
      const { stressed, sheet } = content;
      const chosen = given.position;
      return {
        entry,
        answer: { form: 'vowel', chosen, stressed, right: stressed.includes(chosen), sheet },
      };
    }
    case 'pairs': {
      if (given.form !== 'pairs' || round.form !== 'pairs') return undefined;
      const { word, definition } = given;
      const wordCell = round.words[word];
      const definitionCell = round.definitions[definition];
      if (wordCell === undefined || definitionCell === undefined) return undefined;
      if (wordCell.gone || definitionCell.gone) return undefined;
      const pairPlace = content.wordOrder[word];
      const pair = pairPlace === undefined ? undefined : content.pairs[pairPlace];
      if (pairPlace === undefined || pair === undefined) return undefined;
      const correct = content.definitionOrder.indexOf(pairPlace);
      return {
        entry: pair.entry,
        answer: {
          form: 'pairs',
          word,
          definition,
          correct,
          right: definition === correct,
          sheet: pair.sheet,
        },
      };
    }
    case 'chips': {
      if (given.form !== 'chips') return undefined;
      const tapped: string[] = [];
      for (const place of given.chips) {
        const chip = content.chips[place];
        if (chip === undefined) return undefined;
        tapped.push(chip);
      }
      const { expected, sheet } = content;
      return {
        entry,
        answer: {
          form: 'chips',
          chosen: given.chips,
          expected,
          right: chipsMatch(tapped, expected),
          sheet,
        },
      };
    }
    case 'typed': {
      if (given.form !== 'typed') return undefined;
      const { expected, sheet } = content;
      return {
        entry,
        answer: {
          form: 'typed',
          typed: given.text,
          expected,
          right: typedAnswerMatches(given.text, expected),
          sheet,
        },
      };
    }
  }
}

/**
 * Starts a Game in the mode over the Rounds planned for it, which
 * `planRounds` builds anew from the eligible Entries on `replan`; nothing
 * without a Round. The pairs of a pairs grid are Rounds of their own, one
 * after another, until the grid is empty. In a mode with no Round limit, the
 * Game plans `GAME_ROUNDS` more Rounds whenever it runs out of them.
 */
function createGameInPlay({
  mode,
  rounds: planned,
  planRounds,
  eligible: eligibleAtStart,
}: {
  mode: GameMode;
  /** The Rounds the Game starts over, as the mode planned them. */
  rounds: readonly PlannedRound[];
  planRounds: RoundPlanner;
  /** The eligible Entries of the mode's kinds the Rounds were planned from. */
  eligible: EligibleOfKind<AskableEntry>;
}): GameInPlay | undefined {
  const first = planned[0];
  if (first === undefined) return undefined;
  let rounds = planned;
  let eligible = eligibleAtStart;
  const roundLimit = roundLimitOf(mode);

  /** The ids of the Entries the planned Rounds ask about, a grid's pairs included. */
  const askedIn = (some: readonly PlannedRound[]) =>
    new Set(some.flatMap(({ entry, content }) => [entry.id, ...entriesIn(content)]));

  /**
   * The planned Round the Game's Round of that number comes from, its place
   * among the planned ones and how many Rounds of the Game come before it in
   * the same pairs grid; nothing past the last.
   */
  function plannedAt(
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

  function next(game: CurrentGame): CurrentGame | undefined {
    if (game.status !== 'answered') return undefined;
    if (game.lives === 0) return { ...game, status: 'lost' };
    const roundsPassed = game.roundsPassed + 1;
    if (roundLimit === undefined && plannedAt(roundsPassed + 1) === undefined) {
      const more = planRounds(mode, eligible, GAME_ROUNDS, askedIn(rounds), roundsPassed + 1);
      if ('rounds' in more) rounds = [...rounds, ...more.rounds];
    }
    const upcoming =
      roundLimit === undefined || roundsPassed < roundLimit
        ? plannedAt(roundsPassed + 1)
        : undefined;
    if (upcoming === undefined) return { ...game, roundsPassed, status: 'won' };
    return {
      ...game,
      roundsPassed,
      round: roundOf(upcoming.planned, roundsPassed + 1, game.played, upcoming.inGrid),
      status: 'playing',
    };
  }

  return {
    first: {
      modeId: mode.id,
      round: roundOf(first, 1, [], 0),
      roundsPassed: 0,
      roundLimit,
      lives: livesOf(mode),
      livesAtStart: livesOf(mode),
      played: [],
      status: 'playing',
    },
    answer(game, given) {
      if (game.status !== 'playing') return undefined;
      const at = plannedAt(game.round.number);
      const judged = at && judge(at.planned, game.round, given);
      if (judged === undefined) return undefined;
      const { answer, entry } = judged;
      const answered: CurrentGame = {
        ...game,
        round: { ...game.round, answer },
        played: [...game.played, { ...game.round, answer, entry, right: answer.right }],
        lives: answer.right || game.lives === undefined ? game.lives : game.lives - 1,
        status: 'answered',
      };
      return mode.movesOn === true ? next(answered) : answered;
    },
    next,
    openLetter(game) {
      const { round } = game;
      if (game.status !== 'playing' || round.form !== 'typed' || !round.canOpenLetter) {
        return undefined;
      }
      const at = plannedAt(round.number);
      if (at?.planned.content.form !== 'typed') return undefined;
      const letters = Array.from(at.planned.content.expected);
      const first = round.blanks?.findIndex(isEmpty) ?? -1;
      const opened = letters[first];
      const blanks = round.blanks?.map((blank, place) =>
        place === first && opened !== undefined ? { letter: opened } : blank,
      );
      return { ...game, round: { ...round, blanks, canOpenLetter: canOpenLetterIn(blanks) } };
    },
    replan(game, eligibleNow) {
      if (game.status !== 'playing' && game.status !== 'answered') return;
      eligible = eligibleNow;
      const at = plannedAt(game.round.number);
      if (at === undefined) return;
      const shown = rounds.slice(0, at.place + 1);
      const shownRounds = shown.reduce((sum, { content }) => sum + roundsIn(content), 0);
      const all = rounds.reduce((sum, { content }) => sum + roundsIn(content), 0);
      const rest = planRounds(
        mode,
        eligible,
        (roundLimit ?? all) - shownRounds,
        askedIn(shown),
        shownRounds + 1,
      );
      if ('rounds' in rest) rounds = [...shown, ...rest.rounds];
    },
  };
}

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
  /** The group of the mode screen its card stands in. */
  readonly group: GameModeGroup;
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
  /**
   * Whether the result of the Game just over offers the widget hint: after
   * each finished Game with at least one Life left until the shell shows it,
   * then never again on the device (ADR 0054), and never with the widget or
   * its hint switched off.
   */
  readonly widgetHint: boolean;
}

/**
 * The Game: the Game Modes on offer and the Game in play, kept in memory for
 * the app session and never in the user state. A Game asks as many
 * different eligible Entries of the kinds its mode asks about as the mode's
 * Round limit, 15 by default (`roundsToPlanOf`), each pair of a grid
 * counted: up to 5 the reader is weak on, first (ADR 0043, 0052), the rest
 * those in History when there are at least 15, else any (ADR 0024). A mode
 * with no Round limit asks them again, reshuffled, once it has asked them all. A mode may set its own Lives too, or none, and a time limit (ADR 0052). Playing never writes Seen, History or Active Days; a Round
 * answered right writes its XP, and a finished Game its mode's Best result,
 * when it beats it (ADR 0052), with the XP of the finished Game and of the
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
  /**
   * Keeps on the device that the widget hint the result offers is on screen,
   * so no later Game offers it. The shell tells it once the hint shows.
   */
  widgetHintShown(): Promise<void>;
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

const { gameBest, widgetHintShown } = userStateRecords;

/** Whether the Game is still in play: a Round to answer, or one answered and waiting for «Далі». */
const inPlay = ({ status }: CurrentGame) => status === 'playing' || status === 'answered';

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
  entries: Pick<Entries, 'eligibleOfKind'>;
  history: Pick<History, 'list'>;
  knowledge: Pick<Knowledge, 'weak' | 'answer' | 'confirm'>;
  /** The XP log, which a right Round, a finished Game and a new Best result earn XP in. */
  xp: GameXp;
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

  const bestResults = await bestResultsOf(modes);
  let state: GameState = {
    modes: modes.map((mode) => ({
      ...offeredMode(mode, bestResults[mode.id]),
      canStart: false,
      planning: true,
    })),
    current: undefined,
    bestResults,
    widgetHint: false,
  };
  /** Whether the next finished Game with a Life left offers the widget hint: until it is shown. */
  let widgetHintDue =
    edition.isFeatureEnabled('widget') &&
    edition.isFeatureEnabled('widgetHint') &&
    (await userState.read(widgetHintShown)) === undefined;
  /** The Game in play, or just over; none on the mode screen. */
  let played: GameInPlay | undefined;
  /** When the Game in play started, by the clock. */
  let startedAt = clock.now();
  /** Cancels the end of the timed Game in play, scheduled while its clock runs. */
  let cancelTimeUp: (() => void) | undefined;

  function change(next: GameState): void {
    state = next;
    subscribers.tell();
  }

  const changeCurrent = (current: CurrentGame | undefined) => {
    change({ ...state, current, widgetHint: false });
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
    const eligible = read.find(({ mode }) => mode.id === game?.modeId)?.eligible;
    if (game !== undefined && eligible !== undefined) played?.replan(game, eligible);
  }

  /** Whether a planning of the offers is under way, or waits to try again. */
  let planningOffers = false;
  const unplanned = () => state.modes.some((offer) => 'planning' in offer);

  /**
   * Plans the offers in the background, in turn with the Game's other
   * changes, unless they are planned already or a planning is under way. A
   * planning that fails is tried again after each delay of
   * `OFFER_PLANNING_RETRY_DELAYS` (1, 2 and 4 s), then no more: the offers
   * keep saying they are still planned until the next day turned to, return,
   * hide, restore or Mix change.
   */
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
      'rounds' in plan
        ? createGameInPlay({ mode, rounds: plan.rounds, planRounds, eligible })
        : undefined;
    stopTime();
    const first =
      played && mode.timeLimit !== undefined
        ? { ...played.first, timeLimit: mode.timeLimit, time: runTime(mode.timeLimit) }
        : played?.first;
    change({ ...state, modes: modesNow, current: first, widgetHint: false });
    if (first === undefined) return;
    startedAt = clock.now();
    void analytics?.track('gameStarted', { mode: modeId }).catch(() => undefined);
  }

  /** Cancels the scheduled end of the timed Game in play, if any. */
  function stopTime(): void {
    cancelTimeUp?.();
    cancelTimeUp = undefined;
  }

  /** The clock of a timed Game run from the play time left, its end scheduled. */
  function runTime(left: number): GameTime {
    const time: GameTime = { left, endsAt: new Date(clock.now().getTime() + left) };
    cancelTimeUp = schedule?.(() => {
      // A write that fails leaves the Game to end on its next answer.
      inTurn(() => timeUp(time)).catch(() => undefined);
    }, left);
    return time;
  }

  /** Whether the play time of the Game has run out by the clock. */
  const outOfTime = ({ time }: CurrentGame) =>
    time?.endsAt !== undefined && time.endsAt.getTime() <= clock.now().getTime();

  /**
   * Ends the Game in play once the clock that `time` started has run out,
   * unless the Game paused or ended since.
   */
  async function timeUp(time: GameTime): Promise<void> {
    const game = state.current;
    if (game?.time !== time || !inPlay(game)) return;
    stopTime();
    await finish(game, { ...game, time: { left: 0, endsAt: undefined }, status: 'won' });
  }

  async function answer(given: GivenAnswer): Promise<void> {
    const game = state.current;
    const { time } = game ?? {};
    if (game !== undefined && time !== undefined && outOfTime(game)) {
      await inTurn(() => timeUp(time));
      return;
    }
    const answered = game && played?.answer(game, given);
    if (game === undefined || answered === undefined) return;
    const round = answered.played.at(-1);
    const roundXp = round?.right
      ? xp.award({
          source: 'game-round',
          mode: game.modeId,
          rarity: round.entry.kind === 'word' ? round.entry.rarity : undefined,
        })
      : undefined;
    if (inPlay(answered)) {
      changeCurrent(answered);
      if (roundXp !== undefined) await inTurn(() => writeAwards([roundXp]));
    } else await inTurn(() => finish(game, answered, roundXp));
    if (round === undefined) return;
    await inTurn(() =>
      round.right ? knowledge.confirm(round.entry.id) : knowledge.answer(round.entry.id, 'unknown'),
    );
  }

  async function next(): Promise<void> {
    const game = state.current;
    const after = game && played?.next(game);
    if (game === undefined || after === undefined) return;
    if (after.status === 'playing') changeCurrent(after);
    else await finish(game, after);
  }

  /** Writes the XP the awards append, at once, then makes them in memory. */
  async function writeAwards(awards: readonly XpAward[], own: UserStateChanges = new Map()) {
    const changes = new Map([...own, ...awards.flatMap((award) => [...award.changes])]);
    if (changes.size > 0) await userState.write(changes);
    for (const award of awards) award.commit();
  }

  /**
   * Ends the Game, its Rounds passed the best result when they beat it, kept
   * in the user state in one write with the XP of the last Round, of the
   * finished Game and of the new Best result, so a failed write changes
   * nothing, and offers the widget hint when it is due and a Life is left. A
   * Game left during the write stays left.
   */
  async function finish(game: CurrentGame, over: CurrentGame, roundXp?: XpAward): Promise<void> {
    const result = resultOf(over);
    const best = state.bestResults[over.modeId];
    const beaten = best === undefined || result > best;
    const widgetHint = widgetHintDue && over.lives !== undefined && over.lives > 0;
    const right = over.played.filter((round) => round.right).length;
    // A Game with no right answer still sets the mode's first Best result but
    // earns no XP for it: the bonus rewards effort, not random tapping (story 3).
    const bestXp = beaten && right > 0;
    await writeAwards(
      [
        ...(roundXp === undefined ? [] : [roundXp]),
        xp.award({
          source: 'game-finished',
          mode: over.modeId,
          right,
          played: over.played.length,
        }),
        ...(bestXp ? [xp.award({ source: 'game-best' })] : []),
      ],
      beaten ? gameBest.record(over.modeId).change(result) : new Map(),
    );
    void analytics
      ?.track('gameFinished', {
        mode: over.modeId,
        durationSeconds: Math.round((clock.now().getTime() - startedAt.getTime()) / 1000),
        right,
        played: over.played.length,
        status: over.status === 'lost' ? 'lost' : 'won',
      })
      .catch(() => undefined);
    const mode = beaten ? modes.find(({ id }) => id === over.modeId) : undefined;
    change({
      ...state,
      modes: state.modes.map((offer) =>
        offer.modeId === mode?.id ? { ...offer, best: offeredBest(mode, result) } : offer,
      ),
      current: state.current === game ? over : state.current,
      bestResults: beaten ? { ...state.bestResults, [over.modeId]: result } : state.bestResults,
      widgetHint: widgetHint && state.current === game,
    });
  }

  /** Stops the clock of the timed Game in play while it runs. */
  function pause(): void {
    const game = state.current;
    const endsAt = game?.time?.endsAt;
    if (game === undefined || endsAt === undefined || !inPlay(game)) return;
    stopTime();
    const left = Math.max(0, endsAt.getTime() - clock.now().getTime());
    changeCurrent({ ...game, time: { left, endsAt: undefined } });
  }

  /** Runs the clock of the paused timed Game in play again. */
  function resume(): void {
    const game = state.current;
    const time = game?.time;
    if (game === undefined || time === undefined || time.endsAt !== undefined || !inPlay(game)) {
      return;
    }
    changeCurrent({ ...game, time: runTime(time.left) });
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

  eligibility.subscribe(() => inTurn(followEligibility));
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
      const opened = game && played?.openLetter(game);
      if (opened !== undefined) changeCurrent(opened);
    },
    widgetHintShown: () =>
      inTurn(async () => {
        if (!state.widgetHint || !widgetHintDue) return;
        await userState.write(widgetHintShown.change(true));
        widgetHintDue = false;
      }),
    leave() {
      played = undefined;
      stopTime();
      if (state.current !== undefined) changeCurrent(undefined);
    },
  };
}
