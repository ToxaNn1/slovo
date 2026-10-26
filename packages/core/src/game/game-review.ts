import type { Example } from '@slovo/contracts';

import type { PlayedRound } from './game-in-play';
import type { RoundOption } from './game-mode';
import { rowWordOption } from './guess-word';

/** What an item of the Game Review expands into, by the kind of the Entry the Round asked about. */
export type GameReviewDetails =
  | {
      readonly kind: 'word' | 'idiom';
      /** The primary Definition. */
      readonly definition: string;
      readonly example: Example | undefined;
      readonly etymology: string | undefined;
    }
  | {
      readonly kind: 'correction';
      /** The standard form the Round's answer named. */
      readonly standardForm: string;
      readonly explanation: string;
    }
  | {
      readonly kind: 'synonymRow';
      /** Every member of the row, in its order, with its Stress. */
      readonly members: readonly RoundOption[];
    }
  | { readonly kind: 'tip'; readonly explanation: string };

/**
 * A Round of the Game just over as the Game Review lists it, decided by the
 * Core. The first tap expands the item into its `details`; the second opens
 * the Entry `entryId` (spec #730).
 */
export interface GameReviewItem {
  /** Which Round of the Game it was. */
  readonly number: number;
  /** The Entry the Round asked about, which the second tap opens. */
  readonly entryId: string;
  /**
   * What the item leads with: a Word's Lemma, an idiom's expression, a
   * Correction's non-standard form, a Synonym Row's dominant, or a Tip's
   * title. A Correction's is the form the Round asked about, not the standard
   * equivalent its Entry row leads with; a row's is the Round's prompt.
   */
  readonly title: RoundOption;
  /** Whether the reader chose the right option. */
  readonly right: boolean;
  /** The option the reader chose instead; nothing for a Round answered right. */
  readonly picked: RoundOption | undefined;
  readonly details: GameReviewDetails;
}

const plain = (text: string): RoundOption => ({ text, stressedVowels: [] });

function titleOf({ entry, answer }: PlayedRound): RoundOption {
  switch (entry.kind) {
    case 'word':
      return answer.sheet.answer;
    case 'idiom':
      return plain(entry.expression);
    case 'correction':
      return plain(entry.nonStandardForm);
    case 'synonymRow':
      return rowWordOption(entry.dominant);
    case 'tip':
      return plain(entry.title);
  }
}

function detailsOf({ entry, answer }: PlayedRound): GameReviewDetails {
  switch (entry.kind) {
    case 'word':
    case 'idiom':
      return {
        kind: entry.kind,
        definition: entry.primaryDefinition,
        example: entry.examples[0],
        etymology: entry.etymology,
      };
    case 'correction':
      return {
        kind: 'correction',
        standardForm: answer.sheet.answer.text,
        explanation: entry.explanation,
      };
    case 'synonymRow':
      return { kind: 'synonymRow', members: entry.members.map(rowWordOption) };
    case 'tip':
      return { kind: 'tip', explanation: entry.explanation };
  }
}

/** The option the reader picked instead of the right one; nothing on a right answer. Other answer forms: #777. */
function pickedOf(round: PlayedRound): RoundOption | undefined {
  if (round.right || round.form !== 'pick' || round.answer.form !== 'pick') return undefined;
  return round.options[round.answer.chosen];
}

/** The Game Review of the Rounds played: one item for each, in their order. */
export function buildGameReview(rounds: readonly PlayedRound[]): GameReviewItem[] {
  return rounds.map((round) => ({
    number: round.number,
    entryId: round.entry.id,
    title: titleOf(round),
    right: round.right,
    picked: pickedOf(round),
    details: detailsOf(round),
  }));
}
