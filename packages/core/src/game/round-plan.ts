import type { EligibleOfKind } from '../entries/entries';
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

/** A Round of the Game in play, with the Entry it asks about. */
export interface PlannedRound {
  readonly answerId: string;
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

/** A Round as a Game Mode built it, checked to hold four options with one of them right. */
function checkedRound(mode: GameMode, round: RoundContent): RoundContent {
  const { options, correct } = round;
  if (options.length !== ROUND_OPTIONS || options[correct] === undefined) {
    throw new Error(`The Game Mode «${mode.id}» built a Round without four options and one right`);
  }
  return round;
}

/**
 * Makes the `RoundPlanner` of the Game over History, for `openGame`. The
 * Rounds ask first about the pool, the eligible Entries in History when there
 * are at least `GAME_ROUNDS`, else every eligible one; should the pool make
 * too few fair Rounds, the other eligible Entries fill in. The one place that
 * decides whether a mode can start: its offer and a start both come from it,
 * so they always agree.
 */
export function createRoundPlanner({
  history,
  random,
  edition,
}: {
  history: Pick<History, 'list'>;
  random: Random;
  edition: GameEdition;
}): RoundPlanner {
  return (mode, ofKind, count = GAME_ROUNDS, asked = new Set()) => {
    if ('refusal' in ofKind) return ofKind;
    const eligible = ofKind.entries;
    const met = new Set(history.list.map(({ entryId }) => entryId));
    const inHistory = eligible.filter((entry) => met.has(entry.id));
    const pool = new Set(inHistory.length >= GAME_ROUNDS ? inHistory : eligible);
    const unasked = eligible.filter((entry) => !asked.has(entry.id));
    const built: PlannedRound[] = [];
    for (const answer of [
      ...shuffled(
        unasked.filter((entry) => pool.has(entry)),
        random,
      ),
      ...shuffled(
        unasked.filter((entry) => !pool.has(entry)),
        random,
      ),
    ]) {
      if (built.length === count) break;
      const round = mode.buildRound({ answer, eligible, random, edition });
      if (round !== undefined)
        built.push({ answerId: answer.id, content: checkedRound(mode, round) });
    }
    return built.length === count ? { rounds: built } : { refusal: 'too-few-entries' };
  };
}
