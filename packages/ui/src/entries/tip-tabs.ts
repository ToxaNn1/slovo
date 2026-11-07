import type { Example, TipCardModel } from '@slovo/core';

/**
 * One tab of a Tip's Entry card (ADR 0088), made only from what a Tip has:
 * «Суть» the standard form, the explanation and the sources, «Приклад» the
 * Example. A Tip has no exceptions, so it has no «Винятки».
 */
export type TipTab =
  | {
      readonly key: 'essence';
      readonly standardForm: string;
      readonly explanation: string;
      readonly sourceNames: readonly string[];
    }
  | { readonly key: 'example'; readonly example: Example };

/**
 * The tabs of a Tip's card, in order: «Суть» always and first, so it is the
 * tab selected on opening, then «Приклад» when the Tip has an Example. A card
 * left with «Суть» alone draws no tab bar.
 */
export function tipTabsOf(card: TipCardModel): readonly [TipTab, ...TipTab[]] {
  const essence: TipTab = {
    key: 'essence',
    standardForm: card.standardForm,
    explanation: card.explanation,
    sourceNames: card.sourceNames,
  };
  return card.example === undefined
    ? [essence]
    : [essence, { key: 'example', example: card.example }];
}
