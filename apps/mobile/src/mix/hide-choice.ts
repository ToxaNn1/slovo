import { fill, type EditionStrings } from '@slovo/contracts';
import {
  categoriesInMix,
  featureOfKind,
  type CategoryKind,
  type Edition,
  type AnyEntryCard,
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
      /** Why the option is offered but can't be chosen: the last Category of Corrections in the Mix. */
      readonly disabledHint?: string;
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
    synonymRow: strings.synonymRowsHidden,
    tip: strings.tipsHidden,
  };
  return { label: strings.choice[featureOfKind(entryKind)], toast: toasts[entryKind] };
}

/**
 * The option that hides the card's Category of its kind's list, or nothing
 * while it is out of the Mix already or the Language Pack doesn't name it.
 * The last Category of Words in the Mix is left out (ADR 0019); the last of
 * Corrections is offered disabled with the reason, as Corrections as a whole
 * can still be hidden beside it.
 */
function categoryOption(
  categoryId: string,
  categoryName: string | undefined,
  of: CategoryKind,
  mix: MixState,
  strings: EditionStrings,
): HideOption | undefined {
  const list = categoriesInMix(mix, of);
  if (categoryName === undefined || !list.categoryIds.includes(categoryId)) return undefined;
  const last = list.lastCategoryId === categoryId;
  if (last && of === 'word') return undefined;
  const name = { category: categoryName };
  return {
    kind: 'category',
    target: of === 'word' ? { kind: 'category', categoryId } : { kind: 'category', categoryId, of },
    label: fill(strings.hiding.choice.category, name),
    toast: fill(strings.hiding.categoryHidden, name),
    ...(last && { disabledHint: strings.mix.corrections.lastCategoryHint }),
  };
}

/**
 * The options of the hide choice a card's hide button opens: always its
 * Entry; on a Word or a Correction card its Category; on any card but a
 * Word's its kind as a whole (Corrections, Idioms, Synonym Rows, Tips). Each is left out when it
 * is out of the Mix already, and everything of a kind the Edition in effect
 * turns off (ADR 0040), as the Mix screen then doesn't offer it back.
 */
export function hideChoice({
  card,
  mix,
  edition,
  strings,
}: {
  card: AnyEntryCard;
  mix: MixState;
  edition: Pick<Edition, 'isFeatureEnabled'>;
  strings: EditionStrings;
}): readonly HideOption[] {
  const entry: HideOption = {
    kind: 'entry',
    target: { kind: 'entry', entryId: card.entryId },
    label: strings.hiding.choice.entry,
  };
  if (card.kind === 'word') {
    const { categoryId, categoryName } = card.model;
    const category = categoryOption(categoryId, categoryName, 'word', mix, strings);
    return category === undefined ? [entry] : [entry, category];
  }
  const entryKind = card.kind;
  if (!edition.isFeatureEnabled(featureOfKind(entryKind)) || !mix.kinds[entryKind]) {
    return [entry];
  }
  const target = { kind: 'whole-kind', entryKind } as const;
  const wholeKind: HideOption = {
    kind: 'whole-kind',
    target,
    ...wholeKindStrings(entryKind, strings.hiding),
  };
  if (card.kind !== 'correction') return [entry, wholeKind];
  const { categoryId, categoryName } = card.model;
  const category = categoryOption(categoryId, categoryName, 'correction', mix, strings);
  return category === undefined ? [entry, wholeKind] : [entry, category, wholeKind];
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
