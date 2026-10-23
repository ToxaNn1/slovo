import { fill, type EditionStrings } from '@slovo/contracts';
import {
  entryIdOf,
  type EntryFeedCard,
  type HideTarget,
  type HidingChange,
  type MixState,
} from '@slovo/core';

/** One option of the hide choice, with what it hides and the undo toast it shows when it hides something of the Mix. */
export type HideOption =
  | {
      readonly kind: 'entry';
      readonly target: Extract<HideTarget, { readonly kind: 'entry' }>;
      readonly label: string;
    }
  | {
      readonly kind: 'category';
      readonly target: Extract<HideTarget, { readonly kind: 'category' }>;
      readonly label: string;
      readonly toast: string;
    }
  | {
      readonly kind: 'corrections';
      readonly target: Extract<HideTarget, { readonly kind: 'corrections' }>;
      readonly label: string;
      readonly toast: string;
    };

/**
 * The options of the hide choice a card's hide button opens: always its
 * Entry; on a Word card its Category too, and on a Correction card
 * Corrections as a whole, each left out when it is out of the Mix already.
 * The last Category in the Mix is left out, as it can't be taken out (ADR
 * 0019).
 */
export function hideChoice({
  card,
  mix,
  strings,
}: {
  card: EntryFeedCard;
  mix: MixState;
  strings: EditionStrings['hiding'];
}): readonly HideOption[] {
  const entry: HideOption = {
    kind: 'entry',
    target: { kind: 'entry', entryId: entryIdOf(card) },
    label: strings.choice.entry,
  };
  // An Idiom offers only itself until Idioms get their Mix option (0.8.8).
  if (card.kind === 'idiom') return [entry];
  if (card.kind === 'correction') {
    return mix.corrections
      ? [
          entry,
          {
            kind: 'corrections',
            target: { kind: 'corrections' },
            label: strings.choice.corrections,
            toast: strings.correctionsHidden,
          },
        ]
      : [entry];
  }
  const { categoryId, categoryName } = card.wordCard;
  if (
    categoryName === undefined ||
    !mix.categoryIds.includes(categoryId) ||
    mix.lastCategoryId === categoryId
  )
    return [entry];
  const name = { category: categoryName };
  return [
    entry,
    {
      kind: 'category',
      target: { kind: 'category', categoryId },
      label: fill(strings.choice.category, name),
      toast: fill(strings.categoryHidden, name),
    },
  ];
}

/**
 * The undo toast's text for a hide that changed something: the Entry's title,
 * or the option's own toast for a Category or Corrections. Nothing for a
 * change the option didn't ask for.
 */
export function hideToast({
  option,
  changed,
  strings,
}: {
  option: HideOption;
  changed: HidingChange;
  strings: EditionStrings['hiding'];
}): string | undefined {
  if (changed.kind === 'entry') return fill(strings.entryHidden, { title: changed.row.title });
  return option.kind === 'entry' ? undefined : option.toast;
}
