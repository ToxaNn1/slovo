import { fill, type EditionStrings } from '@slovo/contracts';
import type { EntryRowModel } from '@slovo/core';

/**
 * The Edition's label of a row, its kind or an Idiom's Idiom Type, as the Core's Entry row keys it:
 * «слово», «виправлення», «фразеологізм», «топонім», «синоніми» or «порада» (ADR 0017). The one
 * place a screen turns the key into the word.
 */
export function entryLabel(
  kinds: EditionStrings['history']['kinds'],
  { labelKey }: Pick<EntryRowModel, 'labelKey'>,
): string {
  return kinds[labelKey];
}

/**
 * The text on the right of a row that puts the row's label beside a time, as
 * Collections and «Вчу» say it: «фразеологізм · сьогодні».
 */
export function entryLabelBeside(
  strings: Pick<EditionStrings['history'], 'kinds' | 'kindBeside'>,
  row: Pick<EntryRowModel, 'labelKey'>,
  time: string,
): string {
  return fill(strings.kindBeside, { kind: entryLabel(strings.kinds, row), time });
}

/**
 * The text on the right of a Favorites row: when the Entry went in, after the
 * label of a Synonym Row or a Tip, whose title would read as a Word's or a
 * Correction's without it (spec #730): «синоніми · сьогодні».
 */
export function favoriteTrailing(
  strings: Pick<EditionStrings['history'], 'kinds' | 'kindBeside'>,
  row: Pick<EntryRowModel, 'kind' | 'labelKey'>,
  added: string,
): string {
  return row.kind === 'synonymRow' || row.kind === 'tip'
    ? entryLabelBeside(strings, row, added)
    : added;
}

/**
 * The line under a row's title in the Edition's words: a Word's or an
 * Idiom's Definition, a Synonym Row's meaning or a Tip's standard form as the
 * Entry row says it, or «замість «{form}»» around the
 * form a Correction replaces.
 */
export function entryRowSubtitle(
  { insteadOf }: Pick<EditionStrings['correctionCard'], 'insteadOf'>,
  row: Pick<EntryRowModel, 'kind' | 'secondLine'>,
): string {
  return row.kind === 'correction' ? fill(insteadOf, { form: row.secondLine }) : row.secondLine;
}
