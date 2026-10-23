import { fill, type EditionStrings } from '@slovo/contracts';
import type { EntryRowModel } from '@slovo/core';

/**
 * The Edition's name of a row's kind, as the Core's Entry row keys it:
 * «слово», «виправлення», «фразеологізм» or «топонім» (ADR 0017). The one
 * place a screen turns the key into the word.
 */
export function entryKindLabel(
  kinds: EditionStrings['history']['kinds'],
  { kindKey }: Pick<EntryRowModel, 'kindKey'>,
): string {
  return kinds[kindKey];
}

/**
 * The line under a row's title in the Edition's words: a Word's or an
 * Idiom's Definition as the Entry row says it, or «замість «{form}»» around the
 * form a Correction replaces.
 */
export function entryRowSubtitle(
  { insteadOf }: Pick<EditionStrings['correctionCard'], 'insteadOf'>,
  row: Pick<EntryRowModel, 'kind' | 'secondLine'>,
): string {
  return row.kind === 'correction' ? fill(insteadOf, { form: row.secondLine }) : row.secondLine;
}
