import type { SynonymRowCardModel } from './synonym-row-card';
import type { TipCardModel } from './tip-card';

/** How many members of a Synonym Row its Share Card shows. */
const SHARED_MEMBERS = 6;

/**
 * What the Share Card of a Synonym Row shows, decided by the Core (ADR 0051):
 * the dominant, the meaning and the first 6 members, each with its Stress. The
 * UI ends the members with «…» when the row has more.
 */
export interface SynonymRowShareCardModel {
  readonly kind: 'synonymRow';
  readonly synonymRowId: string;
  readonly dominant: string;
  readonly meaning: string;
  /** The first 6 members, in the row's order. */
  readonly members: readonly string[];
  /** Whether the row has members beyond those shown. */
  readonly moreMembers: boolean;
}

/**
 * What the Share Card of a Tip shows, decided by the Core (ADR 0051): the
 * title, the non-standard form when the Tip has one, and the standard form.
 */
export interface TipShareCardModel {
  readonly kind: 'tip';
  readonly tipId: string;
  readonly title: string;
  readonly nonStandardForm: string | undefined;
  readonly standardForm: string;
}

/** The Share Card of a Synonym Row, from its card. */
export function buildSynonymRowShareCard(card: SynonymRowCardModel): SynonymRowShareCardModel {
  return {
    kind: 'synonymRow',
    synonymRowId: card.synonymRowId,
    dominant: card.dominant.text,
    meaning: card.meaning,
    members: card.members.slice(0, SHARED_MEMBERS).map(({ text }) => text),
    moreMembers: card.members.length > SHARED_MEMBERS,
  };
}

/** The Share Card of a Tip, from its card. */
export function buildTipShareCard(card: TipCardModel): TipShareCardModel {
  return {
    kind: 'tip',
    tipId: card.tipId,
    title: card.title,
    nonStandardForm: card.nonStandardForm,
    standardForm: card.standardForm,
  };
}
