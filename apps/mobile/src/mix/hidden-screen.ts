import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import {
  featureOfKind,
  MIX_KINDS,
  type CategoryKind,
  type Edition,
  type EntryRowModel,
  type HiddenEntry,
  type MixKind,
  type MixState,
} from '@slovo/core';
import { entryLabel } from '@slovo/ui/entry-row-text';

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
  /** The list the Category is of, the Words' or the Corrections' (ADR 0050). */
  readonly of: CategoryKind;
  /** Its display name; a Category of Corrections says so. */
  readonly name: string;
}

/** The row of a kind of Entry out of the Mix as a whole on the Hidden screen. */
export interface HiddenKindModel {
  readonly entryKind: MixKind;
  readonly name: string;
  /** What VoiceOver reads for its «Увімкнути» button. */
  readonly turnOnLabel: string;
}

/** What the Hidden screen draws, from the Hidden Entries and the Mix. */
export interface HiddenScreenModel {
  /** The Hidden Entries, newest first. */
  readonly entries: readonly HiddenEntryModel[];
  /**
   * The Hidden Categories, in the Language Pack's order: the Categories out of
   * the Mix (ADR 0019), the Words' and then the Corrections' (ADR 0050). The
   * Corrections' are left out while Corrections as a whole are out or the
   * Edition turns them off, as on the Mix screen.
   */
  readonly categories: readonly HiddenCategoryModel[];
  /**
   * Each kind of Entry as a whole (Corrections, Idioms) that is out of the
   * Mix (ADR 0019) while the Edition turns it on, in the Mix's order.
   */
  readonly kinds: readonly HiddenKindModel[];
  /** Whether nothing is hidden, which is when the screen says so. */
  readonly empty: boolean;
}

/** The labels of a row in the Edition's words, as short forms and as whole words. */
function labelParts(
  row: EntryRowModel,
  strings: EditionStrings,
): { short: string[]; full: string[] } {
  // The row's label before the labels already names the Idiom Type, the Synonym Row or the Tip.
  if (row.kind === 'idiom' || row.kind === 'synonymRow' || row.kind === 'tip') {
    return { short: [], full: [] };
  }
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

/** The row of the kind as a whole, in the Edition's words. */
function kindModel(entryKind: MixKind, strings: EditionStrings): HiddenKindModel {
  const { hidden, mix } = strings;
  const turnOnLabels: Record<MixKind, string> = {
    correction: hidden.turnOnCorrectionsLabel,
    idiom: hidden.turnOnIdiomsLabel,
  };
  return {
    entryKind,
    name: mix[featureOfKind(entryKind)].title,
    turnOnLabel: turnOnLabels[entryKind],
  };
}

function entryModel({ entryId, row }: HiddenEntry, strings: EditionStrings): HiddenEntryModel {
  const { hidden, history } = strings;
  const rowLabel = entryLabel(history.kinds, row);
  const parts = labelParts(row, strings);
  const join = (forms: readonly string[]) => forms.join(hidden.labelSeparator);
  const label = (template: string, forms: readonly string[]) =>
    forms.length === 0 ? rowLabel : fill(template, { kind: rowLabel, labels: join(forms) });
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
  const correctionsIn = edition.isFeatureEnabled('corrections') && mix.kinds.correction;
  const categories: HiddenCategoryModel[] = [
    ...mix.hiddenCategories.map(({ id, displayName }) => ({
      id,
      of: 'word' as const,
      name: displayName,
    })),
    ...(correctionsIn ? mix.correctionCategories.hiddenCategories : []).map(
      ({ id, displayName }) => ({
        id,
        of: 'correction' as const,
        name: fill(strings.mix.corrections.category, { category: displayName }),
      }),
    ),
  ];
  const kinds = MIX_KINDS.filter(
    (kind) => edition.isFeatureEnabled(featureOfKind(kind)) && !mix.kinds[kind],
  ).map((kind) => kindModel(kind, strings));
  return {
    entries,
    categories,
    kinds,
    empty: entries.length === 0 && categories.length === 0 && kinds.length === 0,
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
