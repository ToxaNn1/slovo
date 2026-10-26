import type { EligibleOfKind, ShownEntry } from '../entries/entries';
import type { Knowledge } from '../knowledge/knowledge';
import type { Random } from '../ports';
import type { History } from '../saved/history';
import {
  ROUND_OPTIONS,
  shuffled,
  type GameEdition,
  type GameMode,
  type GameModeRefusal,
  type RoundContent,
} from './game-mode';

/** How many Rounds a Game has, in every Game Mode. */
export const GAME_ROUNDS = 15;

/** How many Rounds of a Game, at most, ask about Entries the reader is weak on (ADR 0043). */
const WEAK_ROUNDS = 5;

/** A Round of the Game in play, with the Entry it asks about. */
export interface PlannedRound {
  readonly entry: ShownEntry;
  readonly content: RoundContent;
}

/** The Rounds a Game Mode makes, or why it can't make them. */
export type RoundPlan =
  { readonly rounds: readonly PlannedRound[] } | { readonly refusal: GameModeRefusal };

/**
 * Plans `count` Rounds of the mode, by default a Game's, each asking about
 * another eligible Entry than the ones `asked`; or says why the mode can't
 * make them.
 */
export type RoundPlanner = (
  mode: GameMode,
  ofKind: EligibleOfKind,
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

/** A Round as a Game Mode built it, checked to hold four options with one of them right. */
function checkedRound(mode: GameMode, round: RoundContent): RoundContent {
  const { options, correct } = round;
  if (options.length !== ROUND_OPTIONS || options[correct] === undefined) {
    throw new Error(`The Game Mode «${mode.id}» built a Round without four options and one right`);
  }
  return round;
}

/**
 * Makes the `RoundPlanner` of the Game over History and the Knowledge Marks,
 * for `openGame`. Up to `WEAK_ROUNDS` Rounds of a Game ask about eligible
 * Entries the reader is weak on, marked Unknown or due for Review (ADR
 * 0043); the Rounds already `asked` about such Entries count. The others ask
 * first about the pool, the eligible Entries in History when at least
 * `GAME_ROUNDS` of them make a Round (a place name makes none, ADR 0024),
 * else every eligible one; should the pool make too few
 * fair Rounds, the other eligible Entries fill in, the weak ones left over
 * last. The one place that decides whether a mode can start: its offer and a
 * start both come from it, so they always agree.
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
  return (mode, ofKind, count = GAME_ROUNDS, asked = new Set()) => {
    if ('refusal' in ofKind) return ofKind;
    const eligible = ofKind.entries;
    const met = new Set(history.list.map(({ entryId }) => entryId));
    const inHistory = eligible.filter((entry) => met.has(entry.id));
    /** Whether the mode can ask about the Entry: it makes a Round of it. */
    const askable = (answer: ShownEntry) =>
      mode.buildRound({ answer, eligible, random, edition }) !== undefined;
    const pool = new Set(enough(inHistory, askable, GAME_ROUNDS) ? inHistory : eligible);
    const weak = new Set(knowledge.weak());
    const weakAsked = [...asked].filter((id) => weak.has(id)).length;
    const unasked = eligible.filter((entry) => !asked.has(entry.id));
    const weakDrawn = shuffled(
      unasked.filter((entry) => weak.has(entry.id)),
      random,
    );
    const others = unasked.filter((entry) => !weak.has(entry.id));
    const built: PlannedRound[] = [];
    /** Builds a Round about each answer in turn, until there are `upTo`. */
    function build(answers: readonly ShownEntry[], upTo: number): ShownEntry[] {
      const tried: ShownEntry[] = [];
      for (const answer of answers) {
        if (built.length >= upTo) break;
        tried.push(answer);
        const round = mode.buildRound({ answer, eligible, random, edition });
        if (round !== undefined) built.push({ entry: answer, content: checkedRound(mode, round) });
      }
      return tried;
    }
    const weakTried = new Set(build(weakDrawn, Math.min(count, WEAK_ROUNDS - weakAsked)));
    build(
      [
        ...shuffled(
          others.filter((entry) => pool.has(entry)),
          random,
        ),
        ...shuffled(
          others.filter((entry) => !pool.has(entry)),
          random,
        ),
        ...weakDrawn.filter((entry) => !weakTried.has(entry)),
      ],
      count,
    );
    return built.length === count ? { rounds: built } : { refusal: 'too-few-entries' };
  };
}
