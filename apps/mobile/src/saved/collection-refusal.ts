import type { EditionStrings } from '@slovo/contracts';
import type { CollectionNameRefusal } from '@slovo/core';

/** The Edition's words for why the Core refused a Collection's name. */
export function refusalText(
  refusals: EditionStrings['collections']['sheet']['refusal'],
  reason: CollectionNameRefusal,
): string {
  switch (reason) {
    case 'empty':
      return refusals.empty;
    case 'too-long':
      return refusals.tooLong;
    case 'duplicate':
      return refusals.duplicate;
  }
}
