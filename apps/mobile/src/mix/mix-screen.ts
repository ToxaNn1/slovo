import type { EditionStrings, Plural } from '@slovo/contracts';
import {
  categoryPlace,
  featureOfKind,
  MIX_KINDS,
  categoriesInMix,
  type CategoryKind,
  type Edition,
  type MixKind,
  type MixState,
} from '@slovo/core';

/** A Category's chip on the Mix screen. */
export interface MixChipModel {
  readonly id: string;
  readonly name: string;
  readonly on: boolean;
  /** The last Category left in the Mix: its chip can't be turned off (ADR 0019). */
  readonly disabled: boolean;
}

/** The chips of one list of Categories, and whether to say why one is disabled. */
export interface MixCategoriesModel {
  /** The chip of every Category of the list in the Language Pack, in its order. */
  readonly chips: readonly MixChipModel[];
  /** Whether to say why a chip is disabled. */
  readonly lastCategoryHint: boolean;
}

/** What the Mix screen draws, from the Mix and the Edition. */
export interface MixScreenModel extends MixCategoriesModel {
  /** Whether every Category of Words is in the Mix, which is when «Усі» is on. */
  readonly allOn: boolean;
  /**
   * The switch of each kind of Entry in the Mix as a whole (Corrections,
   * Idioms), in the Mix's order, leaving out a kind the Edition doesn't turn on.
   */
  readonly kinds: readonly { readonly entryKind: MixKind; readonly on: boolean }[];
  /**
   * The chips of the Categories of Corrections, under the Corrections switch
   * (ADR 0033), left out while Corrections are out of the Mix or the Edition
   * doesn't turn them on.
   */
  readonly correctionCategories: MixCategoriesModel | undefined;
  /**
   * The Mix kind weight of each kind, chosen under its switch while the kind
   * is in the Mix; left out while the Edition turns its mixKindWeights switch off.
   */
  readonly kindWeights: MixState['kindWeights'] | undefined;
}

export function mixScreenModel({
  edition,
  mix,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  mix: MixState;
}): MixScreenModel {
  const kinds = MIX_KINDS.filter((kind) => edition.isFeatureEnabled(featureOfKind(kind))).map(
    (entryKind) => ({ entryKind, on: mix.kinds[entryKind] }),
  );
  return {
    ...categoriesModel(mix, 'word'),
    allOn: mix.hiddenCategories.length === 0,
    kinds,
    correctionCategories: kinds.some(({ entryKind, on }) => entryKind === 'correction' && on)
      ? categoriesModel(mix, 'correction')
      : undefined,
    kindWeights: edition.isFeatureEnabled('mixKindWeights') ? mix.kindWeights : undefined,
  };
}

/** The chips of one list of Categories, the Words' or the Corrections'. */
function categoriesModel(mix: MixState, of: CategoryKind): MixCategoriesModel {
  const list = categoriesInMix(mix, of);
  return {
    chips: list.allCategories.map(({ id, displayName }) => {
      const place = categoryPlace(mix, of, id);
      return { id, name: displayName, on: place !== 'out', disabled: place === 'last' };
    }),
    lastCategoryHint: list.lastCategoryId !== undefined,
  };
}

/** The value of the «Мій Мікс» row of Settings: «Усі», or how many Categories are in the Mix. */
export function mixSummary({
  mix,
  strings,
  count,
}: {
  mix: MixState;
  strings: EditionStrings['mix'];
  count: (forms: Plural, count: number) => string;
}): string {
  return mix.hiddenCategories.length === 0
    ? strings.all
    : count(strings.categories, mix.categoryIds.length);
}
