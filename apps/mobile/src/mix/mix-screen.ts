import type { EditionStrings, Plural } from '@slovo/contracts';
import {
  featureOfKind,
  MIX_KINDS,
  type CategoriesInMix,
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
  /** The Rarity Floor choice, left out while the Edition turns its rarityFloor switch off. */
  readonly rarity: { readonly floor: number; readonly floors: readonly number[] } | undefined;
}

/** The floors on offer: every rarity of a Word, 1 to 5. */
const RARITY_FLOORS = [1, 2, 3, 4, 5] as const;

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
    ...categoriesModel(mix),
    allOn: mix.hiddenCategories.length === 0,
    kinds,
    correctionCategories: kinds.some(({ entryKind, on }) => entryKind === 'correction' && on)
      ? categoriesModel(mix.correctionCategories)
      : undefined,
    rarity: edition.isFeatureEnabled('rarityFloor')
      ? { floor: mix.rarityFloor, floors: RARITY_FLOORS }
      : undefined,
  };
}

/** The chips of one list of Categories, the Words' or the Corrections'. */
function categoriesModel(list: CategoriesInMix): MixCategoriesModel {
  return {
    chips: list.allCategories.map(({ id, displayName }) => ({
      id,
      name: displayName,
      on: list.categoryIds.includes(id),
      disabled: list.lastCategoryId === id,
    })),
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
