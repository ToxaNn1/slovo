import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import type { Edition, EntryRowModel, HiddenEntry, MixState } from '@slovo/core';

/** A Hidden Entry's row on the Hidden screen. */
export interface HiddenEntryModel {
  readonly entryId: string;
  readonly row: EntryRowModel;
  /** The line under the Lemma, and as VoiceOver reads it in whole words. */
  readonly labels: { readonly text: string; readonly spoken: string };
}

/** A Hidden Category's row on the Hidden screen. */
export interface HiddenCategoryModel {
  readonly id: string;
  readonly name: string;
}

/** What the Hidden screen draws, from the Hidden Entries and the Mix. */
export interface HiddenScreenModel {
  /** The Hidden Entries, newest first. */
  readonly entries: readonly HiddenEntryModel[];
  /** The Hidden Categories, in the Language Pack's order: the Categories out of the Mix (ADR 0019). */
  readonly categories: readonly HiddenCategoryModel[];
  /**
   * Corrections as a whole, when they are out of the Mix (ADR 0019) and the
   * Edition turns them on; nothing otherwise.
   */
  readonly corrections: { readonly name: string } | undefined;
  /**
   * Idioms as a whole, when they are out of the Mix and the Edition turns
   * them on; nothing otherwise.
   */
  readonly idioms: { readonly name: string } | undefined;
  /** Whether nothing is hidden, which is when the screen says so. */
  readonly empty: boolean;
}

/** The labels of a row in the Edition's words, as short forms and as whole words. */
function labelParts(
  row: EntryRowModel,
  strings: EditionStrings,
): { short: string[]; full: string[] } {
  // The kind before the labels already names the Idiom Type.
  if (row.kind === 'idiom') return { short: [], full: [] };
  if (row.kind === 'correction') {
    const type = strings.correctionCard.correctionTypes[row.correctionType];
    return { short: [type], full: [type] };
  }
  const { partsOfSpeech, genders, partOfSpeechWithGender, registers } = strings.wordCard;
  const partOfSpeech = partsOfSpeech[row.partOfSpeech];
  const gender = row.gender === undefined ? undefined : genders[row.gender];
  const withGender = (form: 'short' | 'full') =>
    gender === undefined
      ? partOfSpeech[form]
      : fill(partOfSpeechWithGender, { partOfSpeech: partOfSpeech[form], gender: gender[form] });
  return {
    short: [withGender('short'), ...row.registers.map((register) => registers[register].short)],
    full: [withGender('full'), ...row.registers.map((register) => registers[register].full)],
  };
}

function entryModel({ entryId, row }: HiddenEntry, strings: EditionStrings): HiddenEntryModel {
  const { hidden, history } = strings;
  const kind = history.kinds[row.kind === 'idiom' ? row.idiomType : row.kind];
  const parts = labelParts(row, strings);
  const join = (forms: readonly string[]) => forms.join(hidden.labelSeparator);
  const label = (template: string, forms: readonly string[]) =>
    forms.length === 0 ? kind : fill(template, { kind, labels: join(forms) });
  return {
    entryId,
    row,
    labels: {
      text: label(hidden.rowLabels, parts.short),
      spoken: label(hidden.rowLabelsSpoken, parts.full),
    },
  };
}

export function hiddenScreenModel({
  edition,
  hiddenEntries,
  mix,
  strings,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  hiddenEntries: readonly HiddenEntry[];
  mix: MixState;
  strings: EditionStrings;
}): HiddenScreenModel {
  const entries = hiddenEntries.map((hiddenEntry) => entryModel(hiddenEntry, strings));
  const categories = mix.hiddenCategories.map(({ id, displayName }) => ({
    id,
    name: displayName,
  }));
  const corrections =
    edition.isFeatureEnabled('corrections') && !mix.corrections
      ? { name: strings.correctionCard.title }
      : undefined;
  const idioms =
    edition.isFeatureEnabled('idioms') && !mix.idioms
      ? { name: strings.mix.idioms.title }
      : undefined;
  return {
    entries,
    categories,
    corrections,
    idioms,
    empty:
      entries.length === 0 &&
      categories.length === 0 &&
      corrections === undefined &&
      idioms === undefined,
  };
}

/** The value of the «Приховані записи» row of Settings: how many Entries are hidden. */
export function hiddenSummary({
  hiddenEntries,
  strings,
  count,
}: {
  hiddenEntries: readonly HiddenEntry[];
  strings: EditionStrings['hidden'];
  count: (forms: Plural, count: number) => string;
}): string {
  return count(strings.count, hiddenEntries.length);
}
