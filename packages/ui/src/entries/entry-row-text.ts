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
 * Favorites, Collections and «Вчу» say it: «фразеологізм · сьогодні».
 */
export function entryLabelBeside(
  strings: Pick<EditionStrings['history'], 'kinds' | 'kindBeside'>,
  row: Pick<EntryRowModel, 'labelKey'>,
  time: string,
): string {
  return fill(strings.kindBeside, { kind: entryLabel(strings.kinds, row), time });
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
