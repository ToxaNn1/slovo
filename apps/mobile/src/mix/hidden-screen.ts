import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import {
  categoryTarget,
  featureOfKind,
  withoutStress,
  type HiddenEntry,
  type HideTarget,
  type MixKind,
  type OutOfMix,
} from '@slovo/core';

/** A row of the Hidden screen's one list: something hidden and what «Показати» shows. */
export interface HiddenRowModel {
  /** Its row's test ID, e.g. `hidden-entry-w_one`, `hidden-category-nature`, `hidden-corrections`. */
  readonly testID: string;
  /** What «Показати» unhides: the Entry, the Category, or the kind as a whole. */
  readonly target: HideTarget;
  /** What the row leads with: the Entry's title, the Category's name, the kind's name. */
  readonly name: string;
  /** What it is, in the Edition's words: «запис», «категорія», «тип карток». */
  readonly kindLabel: string;
  /** What VoiceOver reads for its «Показати» button. */
  readonly showLabel: string;
}

/** What the Hidden screen draws, from the Hidden Entries and the Mix. */
export interface HiddenScreenModel {
  /**
   * Everything hidden, in one list: the Hidden Categories in the Language
   * Pack's order, the Words' and then the Corrections'; each kind
   * of Entry out of the Mix as a whole, in the Mix's order; then
   * the Hidden Entries newest first. Empty is when the screen says nothing is
   * hidden.
   */
  readonly rows: readonly HiddenRowModel[];
}

/**
 * What the Hidden screen draws, from the Hidden Entries, what the Mix in
 * effect has out of it (`Mix.outOfMix`) and the kinds the Edition in effect
 * turns on (`Mix.kindsOn`). The Corrections' Categories are already left out
 * of `outOfMix` while Corrections as a whole are out or the Edition turns
 * them off, as on the Mix screen.
 */
export function hiddenScreenModel({
  hiddenEntries,
  outOfMix,
  kindsOn,
  strings,
}: {
  hiddenEntries: readonly HiddenEntry[];
  outOfMix: OutOfMix;
  kindsOn: readonly MixKind[];
  strings: EditionStrings;
}): HiddenScreenModel {
  const { hidden, mix } = strings;
  const row = (
    testID: string,
    target: HideTarget,
    name: string,
    kindLabel: string,
  ): HiddenRowModel => ({
    testID,
    target,
    name,
    kindLabel,
    showLabel: fill(hidden.showLabel, { title: withoutStress(name) }),
  });
  const categories = outOfMix.categories.map(({ of, category: { id, displayName } }) =>
    of === 'word'
      ? row(`hidden-category-${id}`, categoryTarget(id, of), displayName, hidden.kinds.category)
      : row(
          `hidden-correction-category-${id}`,
          categoryTarget(id, of),
          fill(mix.corrections.category, { category: displayName }),
          hidden.kinds.category,
        ),
  );
  const kinds = outOfMix.kinds.map((entryKind) =>
    row(
      `hidden-${featureOfKind(entryKind)}`,
      { kind: 'whole-kind', entryKind },
      mix[featureOfKind(entryKind)].title,
      hidden.kinds.kind,
    ),
  );
  const entries = hiddenEntries
    // Synonym Rows and Tips are listed only while the Edition turns the kind on (spec #730).
    .filter(
      ({ row: { kind } }) => (kind !== 'synonymRow' && kind !== 'tip') || kindsOn.includes(kind),
    )
    .map(({ entryId, row: { title } }) =>
      row(`hidden-entry-${entryId}`, { kind: 'entry', entryId }, title, hidden.kinds.entry),
    );
  return { rows: [...categories, ...kinds, ...entries] };
}

/**
 * The value of the rows that open the Hidden screen («Приховане» of «Мої Теми»
 * and «Приховані записи» of Settings), from the screen's own rows, so it counts
 * exactly what the screen lists: each part in the list's order, e.g.
 * «4 типи карток · 1 запис»; only Entries, or nothing, as «N записів».
 */
export function hiddenSummary({
  rows,
  strings,
  count,
}: {
  rows: readonly HiddenRowModel[];
  strings: EditionStrings['hidden'];
  count: (forms: Plural, count: number) => string;
}): string {
  const of = (kind: HideTarget['kind']) => rows.filter(({ target }) => target.kind === kind).length;
  const parts = (
    [
      [strings.countCategories, of('category')],
      [strings.countKinds, of('whole-kind')],
      [strings.count, of('entry')],
    ] as const
  ).filter(([, each]) => each > 0);
  return parts.length === 0
    ? count(strings.count, 0)
    : parts.map(([forms, each]) => count(forms, each)).join(strings.countSeparator);
}
