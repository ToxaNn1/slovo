import type { EditionStrings, Plural } from '@slovo/contracts';
import type { Edition, MixState } from '@slovo/core';

/** A Category's chip on the Mix screen. */
export interface MixChipModel {
  readonly id: string;
  readonly name: string;
  readonly on: boolean;
  /** The last Category left in the Mix: its chip can't be turned off (ADR 0019). */
  readonly disabled: boolean;
}

/** What the Mix screen draws, from the Mix and the Edition. */
export interface MixScreenModel {
  /** The chip of every Category of the Edition, in its order. */
  readonly chips: readonly MixChipModel[];
  /** Whether every Category is in the Mix, which is when «Усі» is on. */
  readonly allOn: boolean;
  /** Whether to say why a chip is disabled. */
  readonly lastCategoryHint: boolean;
  /** The Corrections switch, left out when the Edition doesn't turn Corrections on. */
  readonly corrections: { readonly on: boolean } | undefined;
}

export function mixScreenModel({
  edition,
  mix,
}: {
  edition: Pick<Edition, 'categories' | 'isFeatureEnabled'>;
  mix: MixState;
}): MixScreenModel {
  return {
    chips: edition.categories.map(({ id, displayName }) => ({
      id,
      name: displayName,
      on: mix.categoryIds.includes(id),
      disabled: mix.lastCategoryId === id,
    })),
    allOn: mix.hiddenCategories.length === 0,
    lastCategoryHint: mix.lastCategoryId !== undefined,
    corrections: edition.isFeatureEnabled('corrections') ? { on: mix.corrections } : undefined,
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
