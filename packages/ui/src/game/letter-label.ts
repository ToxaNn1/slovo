import type { EditionStrings } from '@slovo/contracts';

import { fill } from '../providers/EditionProvider';

/**
 * What VoiceOver reads for a letter at its place among a Word's letters from
 * 0, «а, третя літера»; past the Edition's ordinals, the place's number.
 */
export function letterLabel(
  texts: EditionStrings['game']['letters'],
  letter: string,
  place: number,
): string {
  return fill(texts.label, { letter, place: texts.ordinals[place] ?? String(place + 1) });
}
