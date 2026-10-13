import { fill, type EditionStrings } from '@slovo/contracts';
import type { Edition, EntryFeedCard, MixState } from '@slovo/core';

/** One option of the hide choice, with the undo toast it shows when it hides something of the Mix. */
export type HideOption =
  | { readonly kind: 'entry'; readonly label: string }
  | {
      readonly kind: 'category';
      readonly categoryId: string;
      readonly label: string;
      readonly toast: string;
    }
  | { readonly kind: 'corrections'; readonly label: string; readonly toast: string };

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
  edition,
  strings,
}: {
  card: EntryFeedCard;
  mix: MixState;
  edition: Pick<Edition, 'categories'>;
  strings: EditionStrings['hiding'];
}): readonly HideOption[] {
  const entry: HideOption = { kind: 'entry', label: strings.choice.entry };
  if (card.kind === 'correction') {
    return mix.corrections
      ? [
          entry,
          {
            kind: 'corrections',
            label: strings.choice.corrections,
            toast: strings.correctionsHidden,
          },
        ]
      : [entry];
  }
  const { categoryId } = card.wordCard;
  const category = edition.categories.find(({ id }) => id === categoryId);
  if (
    category === undefined ||
    !mix.categoryIds.includes(categoryId) ||
    mix.lastCategoryId === categoryId
  )
    return [entry];
  const name = { category: category.displayName };
  return [
    entry,
    {
      kind: 'category',
      categoryId,
      label: fill(strings.choice.category, name),
      toast: fill(strings.categoryHidden, name),
    },
  ];
}
