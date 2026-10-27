import type { AskableEntry, AskableKind, EligibleOfKind } from '../entries/entries';
import type { AnswerSheet, GameMode, RoundOption, TextRange } from './game-mode';
import { entriesIn, roundsIn } from './game-mode';
import { GAME_ROUNDS, roundLimitOf, type PlannedRound, type RoundPlanner } from './round-plan';
import { typedAnswerMatches } from './typed-answer';

/** How many Lives a Game starts with, in a Game Mode that sets no Lives of its own. */
export const GAME_LIVES = 5;

/** The Lives a Game in the mode starts with; none in a mode without Lives. */
export const livesOf = ({ lives = GAME_LIVES }: GameMode): number | undefined =>
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

/** A Round as the reader plays it, in its answer form, the right answer kept out. */
export type Round = {
  /** Which Round of the Game it is, from 1 up to the mode's Round limit, `GAME_ROUNDS` by default. */
  readonly number: number;
  /** The kind of Entry it asks about, by which the shell lays it out, such as a Synonym Row's question. */
  readonly entryKind: AskableKind;
  readonly prompt: string;
  /** The part of the prompt to mark, which the shell draws and VoiceOver names; none to mark. */
  readonly highlight: TextRange | undefined;
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
  | { readonly form: 'chips'; readonly chips: readonly string[] }
  | { readonly form: 'typed' }
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
  /** The Lives left, from the mode's Lives (`GAME_LIVES` by default) to 0; none in a mode without Lives. */
  readonly lives: number | undefined;
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
   * The Game with its Round answered: a wrong answer costs a Life, in a mode
   * with Lives. Nothing unless a Round waits for an answer in that form and
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
      return { ...base, form: 'chips', chips: content.chips };
    case 'typed':
      return { ...base, form: 'typed' };
  }
}

/** Whether the chips tapped are the right ones in the right order, equal chips interchangeable. */
const chipsMatch = (tapped: readonly string[], right: readonly string[]) =>
  tapped.length === right.length && tapped.every((chip, place) => chip === right[place]);

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
 * Starts a Game in the mode over its planned Rounds, which `planRounds`
 * builds anew from the eligible Entries on `replan`; nothing without a Round.
 * The pairs of a pairs grid are Rounds of their own, one after another, until
 * the grid is empty. In a mode with no Round limit, the Game plans
 * `GAME_ROUNDS` more Rounds whenever it runs out of them.
 */
export function createGameInPlay(
  mode: GameMode,
  planned: readonly PlannedRound[],
  planRounds: RoundPlanner,
  eligibleAtStart: EligibleOfKind<AskableEntry>,
): GameInPlay | undefined {
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

  return {
    mode,
    first: {
      modeId: mode.id,
      round: roundOf(first, 1, [], 0),
      roundsPassed: 0,
      lives: livesOf(mode),
      played: [],
      status: 'playing',
    },
    answer(game, given) {
      if (game.status !== 'playing') return undefined;
      const at = plannedAt(game.round.number);
      const judged = at && judge(at.planned, game.round, given);
      if (judged === undefined) return undefined;
      const { answer, entry } = judged;
      return {
        ...game,
        round: { ...game.round, answer },
        played: [...game.played, { ...game.round, answer, entry, right: answer.right }],
        lives: answer.right || game.lives === undefined ? game.lives : game.lives - 1,
        status: 'answered',
      };
    },
    next(game) {
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
