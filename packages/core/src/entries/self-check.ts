import type { SynonymRowCardModel } from './synonym-row-card';
import type { TipCardModel } from './tip-card';

/**
 * An Entry card under Self-check: until the reader reveals it, the card shows
 * only the concealed model and its Knowledge Mark buttons do not work; once
 * revealed, it shows the whole card model and the buttons work (ADR 0051).
 */
export type SelfCheckCardModel<Card, Concealed> =
  | { readonly concealed: true; readonly marksActive: false; readonly card: Concealed }
  | { readonly concealed: false; readonly marksActive: true; readonly card: Card };

/** What a Synonym Row card shows before the reveal: its dominant alone («іти → ?»). */
export type ConcealedSynonymRowCardModel = Pick<
  SynonymRowCardModel,
  'kind' | 'synonymRowId' | 'dominant'
>;

/**
 * What a Tip card shows before the reveal: its title and its non-standard
 * form, or its title alone when the Tip has no non-standard form.
 */
export type ConcealedTipCardModel = Pick<
  TipCardModel,
  'kind' | 'tipId' | 'title' | 'nonStandardForm'
>;

/** The Synonym Row card as Self-check shows it, concealed or revealed. */
export function selfCheckSynonymRowCard({
  card,
  concealed,
}: {
  card: SynonymRowCardModel;
  concealed: boolean;
}): SelfCheckCardModel<SynonymRowCardModel, ConcealedSynonymRowCardModel> {
  if (!concealed) return { concealed, marksActive: true, card };
  const { kind, synonymRowId, dominant } = card;
  return { concealed, marksActive: false, card: { kind, synonymRowId, dominant } };
}

/** The Tip card as Self-check shows it, concealed or revealed. */
export function selfCheckTipCard({
  card,
  concealed,
}: {
  card: TipCardModel;
  concealed: boolean;
}): SelfCheckCardModel<TipCardModel, ConcealedTipCardModel> {
  if (!concealed) return { concealed, marksActive: true, card };
  const { kind, tipId, title, nonStandardForm } = card;
  return { concealed, marksActive: false, card: { kind, tipId, title, nonStandardForm } };
}
