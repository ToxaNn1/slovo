import type { AskableEntry, EligibleOfKind } from '../entries/entries';
import type { Knowledge } from '../knowledge/knowledge';
import type { Random } from '../ports';
import type { History } from '../saved/history';
import {
  entriesIn,
  ROUND_OPTIONS,
  roundsIn,
  shuffled,
  type GameEdition,
  type GameMode,
  type GameModeRefusal,
  type RoundContent,
} from './game-mode';

/** How many Rounds a Game has, in a Game Mode that sets no Round limit of its own. */
export const GAME_ROUNDS = 15;

/** How many Rounds a Game in the mode has at most; none in a mode with no Round limit. */
export const roundLimitOf = ({ roundLimit = GAME_ROUNDS }: GameMode): number | undefined =>
  roundLimit === 'none' ? undefined : roundLimit;

/**
 * How many Rounds a Game in the mode starts with, and so how many eligible
 * Entries the mode needs: its Round limit, or `GAME_ROUNDS` without one.
 */
export const roundsToPlanOf = (mode: GameMode): number => roundLimitOf(mode) ?? GAME_ROUNDS;

/** How many Rounds of a Game, at most, ask about Entries the reader is weak on (ADR 0043). */
const WEAK_ROUNDS = 5;

/** A Round of the Game in play, with the Entry it asks about. */
export interface PlannedRound {
  readonly entry: AskableEntry;
  readonly content: RoundContent;
}

/** The Rounds a Game Mode makes, or why it can't make them. */
export type RoundPlan =
  { readonly rounds: readonly PlannedRound[] } | { readonly refusal: GameModeRefusal };

/**
 * Plans `count` Rounds of the mode, each pair of a grid counted, by default
 * the ones a Game in it starts with (`roundsToPlanOf`), each asking about
 * another eligible Entry than the ones `asked` (in a mode with no Round
 * limit, then about them again); or says why the mode can't make them.
 */
export type RoundPlanner = (
  mode: GameMode,
  ofKind: EligibleOfKind<AskableEntry>,
  count?: number,
  asked?: ReadonlySet<string>,
) => RoundPlan;

/** Whether at least `count` of the items pass the test, checking no more than it takes. */
function enough<T>(items: readonly T[], test: (item: T) => boolean, count: number): boolean {
  let passed = 0;
  for (const item of items) {
    if (passed >= count) break;
    if (test(item)) passed += 1;
  }
  return passed >= count;
}

/** Whether the Round as a Game Mode built it has exactly one right answer in its form. */
function wellFormed(round: RoundContent): boolean {
  switch (round.form) {
    case 'pick':
      return round.options.length === ROUND_OPTIONS && round.options[round.correct] !== undefined;
    case 'vowel':
      return (
        round.stressed.length > 0 && round.stressed.every((vowel) => round.vowels.includes(vowel))
      );
    case 'pairs': {
      const places = round.pairs.map((_, place) => place).sort();
      const sorted = (order: readonly number[]) => [...order].sort();
      return (
        round.pairs.length > 0 &&
        round.pairs.length <= ROUND_OPTIONS &&
        sorted(round.wordOrder).join() === places.join() &&
        sorted(round.definitionOrder).join() === places.join()
      );
    }
    case 'chips':
      return (
        round.chips.length > 0 &&
        [...round.chips].sort().join('\u0000') === [...round.expected].sort().join('\u0000')
      );
    case 'typed':
      return round.expected.length > 0;
  }
}

/** A Round as a Game Mode built it, checked to have exactly one right answer in its form and no more than `upTo` Rounds. */
function checkedRound(mode: GameMode, round: RoundContent, upTo: number): RoundContent {
  if (!wellFormed(round)) {
    throw new Error(
      `The Game Mode «${mode.id}» built a «${round.form}» Round without one right answer`,
    );
  }
  if (roundsIn(round) > upTo) {
    throw new Error(`The Game Mode «${mode.id}» built more than the ${String(upTo)} Rounds left`);
  }
  return round;
}

/**
 * Makes the `RoundPlanner` of the Game over History and the Knowledge Marks,
 * for `openGame`. Up to `WEAK_ROUNDS` Rounds of a Game, in every mode, ask
 * about eligible Entries the reader is weak on, marked Unknown or due for
 * Review (ADR 0043, 0052), and come first; the Rounds already `asked` about
 * such Entries count. The others ask first about the pool, the eligible
 * Entries in History when at least `GAME_ROUNDS` of them make a Round (a
 * place name makes none, ADR 0024), else every eligible one; should the pool
 * make too few fair Rounds, the other eligible Entries fill in, the weak ones
 * left over last. Each pair of a pairs grid counts as a Round. In a mode with
 * no Round limit, once a Game under way has asked about every eligible Entry,
 * the rest of its Rounds ask about them again, reshuffled. The one place that
 * decides whether a mode can start: its offer and a start both come from it,
 * so they always agree.
 */
export function createRoundPlanner({
  history,
  knowledge,
  random,
  edition,
}: {
  history: Pick<History, 'list'>;
  knowledge: Pick<Knowledge, 'weak'>;
  random: Random;
  edition: GameEdition;
}): RoundPlanner {
  return (mode, ofKind, count = roundsToPlanOf(mode), asked = new Set()) => {
    if ('refusal' in ofKind) return ofKind;
    const eligible = ofKind.entries;
    const met = new Set(history.list.map(({ entryId }) => entryId));
    const inHistory = eligible.filter((entry) => met.has(entry.id));
    /** Whether the mode can ask about the Entry: it makes a Round of it. */
    const askable = (answer: AskableEntry) =>
      mode.buildRound({ answer, eligible, next: [], upTo: 1, random, edition }) !== undefined;
    const pool = new Set(enough(inHistory, askable, GAME_ROUNDS) ? inHistory : eligible);
    const weak = new Set(knowledge.weak());
    const unasked = eligible.filter((entry) => !asked.has(entry.id));
    const weakDrawn = shuffled(
      unasked.filter((entry) => weak.has(entry.id)),
      random,
    );
    const others = unasked.filter((entry) => !weak.has(entry.id));
    const built: PlannedRound[] = [];
    /** The Rounds built, each pair of a grid counted. */
    let planned = 0;
    /** The Entries the Rounds built ask about. */
    const taken = new Set<string>();
    /** How many more Rounds may ask about Entries the reader is weak on. */
    let weakLeft = WEAK_ROUNDS - [...asked].filter((id) => weak.has(id)).length;
    /**
     * Builds a Round about each answer in turn not asked yet, until there are
     * `count`; within `WEAK_ROUNDS` when `weakAtMost`, so a weak answer past
     * them waits and the next ones hold no more weak Entries than are left.
     */
    function build(answers: readonly AskableEntry[], weakAtMost: boolean): void {
      for (const [place, answer] of answers.entries()) {
        if (planned >= count) return;
        if (taken.has(answer.id)) continue;
        if (weakAtMost && weak.has(answer.id) && weakLeft <= 0) continue;
        let weakNext = weakLeft - (weak.has(answer.id) ? 1 : 0);
        const next = answers.slice(place + 1).filter((entry) => {
          if (taken.has(entry.id)) return false;
          if (!weakAtMost || !weak.has(entry.id)) return true;
          weakNext -= 1;
          return weakNext >= 0;
        });
        const upTo = count - planned;
        const round = mode.buildRound({ answer, eligible, next, upTo, random, edition });
        if (round === undefined) continue;
        const content = checkedRound(mode, round, upTo);
        for (const id of new Set([answer.id, ...entriesIn(content)])) {
          taken.add(id);
          if (weak.has(id)) weakLeft -= 1;
        }
        built.push({ entry: answer, content });
        planned += roundsIn(content);
      }
    }
    build(
      [
        ...weakDrawn,
        ...shuffled(
          others.filter((entry) => pool.has(entry)),
          random,
        ),
        ...shuffled(
          others.filter((entry) => !pool.has(entry)),
          random,
        ),
      ],
      true,
    );
    build(weakDrawn, false);
    if (planned < count && asked.size > 0 && roundLimitOf(mode) === undefined) {
      build(
        shuffled(
          eligible.filter((entry) => !taken.has(entry.id)),
          random,
        ),
        false,
      );
    }
    return planned === count ? { rounds: built } : { refusal: 'too-few-entries' };
  };
}
