import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import type { EntryRowModel, HiddenEntry, MixState } from '@slovo/core';

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
  /** The Hidden Categories, in the Edition's order: the Categories out of the Mix (ADR 0019). */
  readonly categories: readonly HiddenCategoryModel[];
  /** Whether nothing is hidden, which is when the screen says so. */
  readonly empty: boolean;
}

/** The labels of a row in the Edition's words, as short forms and as whole words. */
function labelParts(
  row: EntryRowModel,
  strings: EditionStrings,
): { short: string[]; full: string[] } {
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
  const kind = history.kinds[row.kind];
  const parts = labelParts(row, strings);
  const join = (forms: readonly string[]) => forms.join(hidden.labelSeparator);
  return {
    entryId,
    row,
    labels: {
      text: fill(hidden.rowLabels, { kind, labels: join(parts.short) }),
      spoken: fill(hidden.rowLabelsSpoken, { kind, labels: join(parts.full) }),
    },
  };
}

export function hiddenScreenModel({
  hiddenEntries,
  mix,
  strings,
}: {
  hiddenEntries: readonly HiddenEntry[];
  mix: MixState;
  strings: EditionStrings;
}): HiddenScreenModel {
  const entries = hiddenEntries.map((hiddenEntry) => entryModel(hiddenEntry, strings));
  const categories = mix.hiddenCategories.map(({ id, displayName }) => ({
    id,
    name: displayName,
  }));
  return { entries, categories, empty: entries.length === 0 && categories.length === 0 };
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
