import type { Example, Tip, TipExceptions } from '@slovo/contracts';

import { sourceNamesOf } from './source-names';

/**
 * What a Tip card shows, decided by the Core: the UI draws it and never picks
 * sections itself. It carries data and keys only; the UI turns the kind into
 * the Edition's chip «порада» and labels the forms as on a Correction card
 * (ADR 0051). A section without data is left out: `undefined`.
 */
export interface TipCardModel {
  readonly kind: 'tip';
  readonly tipId: string;
  /** The rule in a few words («Котра година?»). */
  readonly title: string;
  /**
   * The non-standard form the Tip replaces; nothing for a Tip that shows only
   * the right way, which invents no wrong form.
   */
  readonly nonStandardForm: string | undefined;
  readonly standardForm: string;
  readonly explanation: string;
  readonly example: Example | undefined;
  /** Where the rule does not hold, for the tab «Винятки» (ADR 0120); nothing for a Tip without. */
  readonly exceptions: TipExceptions | undefined;
  /** The names of the Tip's sources, in their order: each one's short name, or its title without one; the card names them in a line. */
  readonly sourceNames: readonly string[];
}

/** The Tip card of a Tip. */
export function buildTipCard({ tip }: { tip: Tip }): TipCardModel {
  return {
    kind: 'tip',
    tipId: tip.id,
    title: tip.title,
    nonStandardForm: tip.nonStandardForm,
    standardForm: tip.standardForm,
    explanation: tip.explanation,
    example: tip.example,
    exceptions: tip.exceptions,
    sourceNames: sourceNamesOf(tip.sources),
  };
}
