import type { TipCardModel } from '@slovo/core';

/**
 * One tab of a Tip's Entry card (ADR 0091, board e9), made only from what a
 * Tip has: «Правило» the explanation, the chips of its standard form and its
 * Example, and the sources; «Винятки» the text of its exceptions and their
 * words in chips, for a Tip with exceptions while `tipExceptions` is on
 * (ADR 0120).
 */
export type TipTab =
  | {
      readonly key: 'rule';
      readonly explanation: string;
      /** The standard form, then the Example's text when the Tip has one, each in a chip. */
      readonly chips: readonly [string, ...string[]];
      readonly sourceNames: readonly string[];
    }
  | {
      readonly key: 'exceptions';
      readonly explanation: string;
      /** The words where the rule does not hold, each in a chip. */
      readonly chips: readonly string[];
    };

/**
 * The tabs of a Tip's card: «Правило», then «Винятки» when the Tip has
 * exceptions and `exceptions` (its Feature Switch) is on; «Правило» alone
 * draws no tab bar.
 */
export function tipTabsOf(
  card: TipCardModel,
  { exceptions }: { exceptions: boolean },
): readonly [TipTab, ...TipTab[]] {
  const rule: TipTab = {
    key: 'rule',
    explanation: card.explanation,
    chips:
      card.example === undefined ? [card.standardForm] : [card.standardForm, card.example.text],
    sourceNames: card.sourceNames,
  };
  if (!exceptions || card.exceptions === undefined) return [rule];
  return [
    rule,
    { key: 'exceptions', explanation: card.exceptions.explanation, chips: card.exceptions.words },
  ];
}
