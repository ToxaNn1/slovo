import { fill, type EditionStrings } from '@slovo/contracts';
import {
  featureOfKind,
  type Edition,
  type EntryFeedCard,
  type HideTarget,
  type HidingChange,
  type MixKind,
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
      readonly kind: 'whole-kind';
      readonly target: Extract<HideTarget, { readonly kind: 'whole-kind' }>;
      readonly label: string;
      readonly toast: string;
    };

/** The words of the option that takes the kind of Entry as a whole out of the Mix, and of its toast. */
function wholeKindStrings(
  entryKind: MixKind,
  strings: EditionStrings['hiding'],
): { label: string; toast: string } {
  const toasts: Record<MixKind, string> = {
    correction: strings.correctionsHidden,
    idiom: strings.idiomsHidden,
  };
  return { label: strings.choice[featureOfKind(entryKind)], toast: toasts[entryKind] };
}

/**
 * The options of the hide choice a card's hide button opens: always its
 * Entry; on a Word card its Category too, and on any other card its kind as a
 * whole (Corrections, Idioms), each left out when it is out of the Mix
 * already; the kind as a whole also while the Edition in effect turns it off
 * (ADR 0040), as the Mix screen then doesn't offer it back. The last Category in the Mix is left out, as it can't be taken out
 * (ADR 0019).
 */
export function hideChoice({
  card,
  mix,
  edition,
  strings,
}: {
  card: EntryFeedCard;
  mix: MixState;
  edition: Pick<Edition, 'isFeatureEnabled'>;
  strings: EditionStrings['hiding'];
}): readonly HideOption[] {
  const entry: HideOption = {
    kind: 'entry',
    target: { kind: 'entry', entryId: card.entryId },
    label: strings.choice.entry,
  };
  if (card.kind !== 'word') {
    const entryKind = card.kind;
    if (!edition.isFeatureEnabled(featureOfKind(entryKind)) || !mix.kinds[entryKind]) {
      return [entry];
    }
    const target = { kind: 'whole-kind', entryKind } as const;
    return [entry, { kind: 'whole-kind', target, ...wholeKindStrings(entryKind, strings) }];
  }
  const { categoryId, categoryName } = card.model;
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
 * or the option's own toast for a Category or a kind as a whole. Nothing for
 * a change the option didn't ask for.
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
