import { fill, type EditionStrings } from '@slovo/contracts';
import {
  featureOfKind,
  type AnyEntryCard,
  type Composition,
  type EntryToHide,
  type HideOption as CoreHideOption,
  type HideTarget,
  type HidingChange,
  type MixKind,
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

/** The Entry a card's hide button is for, as the Mix reads it. */
function entryToHide(card: AnyEntryCard): EntryToHide {
  switch (card.kind) {
    case 'word':
    case 'correction':
      return { kind: card.kind, entryId: card.entryId, categoryId: card.model.categoryId };
    default:
      return { kind: card.kind, entryId: card.entryId };
  }
}

/** The option of the hide choice in the Edition's words. */
function optionOf(option: CoreHideOption, strings: EditionStrings): HideOption {
  switch (option.kind) {
    case 'entry':
      return { kind: 'entry', target: option.target, label: strings.hiding.choice.entry };
    case 'category':
    case 'last-category': {
      const name = { category: option.category.displayName };
      return {
        kind: 'category',
        target: option.target,
        label: fill(strings.hiding.choice.category, name),
        toast: fill(strings.hiding.categoryHidden, name),
        ...(option.kind === 'last-category' && {
          disabledHint: strings.mix.corrections.lastCategoryHint,
        }),
      };
    }
    case 'whole-kind':
      return {
        kind: 'whole-kind',
        target: option.target,
        ...wholeKindStrings(option.target.entryKind, strings.hiding),
      };
  }
}

/**
 * The options of the hide choice a card's hide button opens, as the Mix in
 * effect offers them (`Mix.hideOptions`), in the Edition's words: the last
 * Category of Corrections in the Mix is offered disabled with the reason.
 */
export function hideChoice({
  card,
  mix,
  strings,
}: {
  card: AnyEntryCard;
  mix: Pick<Composition['mix'], 'hideOptions'>;
  strings: EditionStrings;
}): readonly HideOption[] {
  return mix.hideOptions(entryToHide(card)).map((option) => optionOf(option, strings));
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
