import type { PlayedRound } from './game';
import type { RoundOption } from './game-mode';
import { rowWordOption } from './guess-word';
import { byKind } from '../entries/entry-kinds';

const plain = (text: string): RoundOption => ({ text, stressedVowels: [] });

/**
 * What a row leads with, by the kind of the Entry: a Word's is the Round's own
 * sheet, with its Stress; a Correction's the non-standard form the Round asked
 * about; an idiom's its expression; a Synonym Row's its dominant; a Tip's its title.
 */
const titleOf = ({ entry, answer }: PlayedRound): RoundOption =>
  byKind(entry, {
    word: () => answer.sheet.asked ?? answer.sheet.answer,
    correction: ({ nonStandardForm }) => plain(nonStandardForm),
    idiom: ({ expression }) => plain(expression),
    synonymRow: ({ dominant }) => rowWordOption(dominant),
    tip: ({ title }) => plain(title),
  });

/**
 * A row of the Game Review, «Огляд раундів» (spec #1880, D11; ADR 0139): a Round
 * played, ✓ or ✗ and its word. A row neither expands nor opens the Entry.
 */
export interface GameReviewRow {
  /** Which Round of the Game it was; each pair of «Пари» is a Round of its own. */
  readonly number: number;
  /** Whether the reader answered right. */
  readonly right: boolean;
  /** What the row leads with, a Word's Lemma with its Stress, an idiom's expression. */
  readonly word: RoundOption;
}

/** The Game Review of the Rounds played: one row for each, in their order. */
export function buildGameReview(rounds: readonly PlayedRound[]): GameReviewRow[] {
  return rounds.map((round) => ({
    number: round.number,
    right: round.right,
    word: titleOf(round),
  }));
}
