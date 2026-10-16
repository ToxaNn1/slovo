import { fill, type EditionStrings } from '@slovo/contracts';
import type { WordCardModel } from '@slovo/core';

/**
 * A Word's part of speech with its gender, if it has one: in the short form
 * the card shows («ім., ж. р.») or in the full words VoiceOver reads.
 */
export function partOfSpeechText(
  strings: Pick<EditionStrings['wordCard'], 'partsOfSpeech' | 'genders' | 'partOfSpeechWithGender'>,
  { partOfSpeech, gender }: Pick<WordCardModel, 'partOfSpeech' | 'gender'>,
  form: 'short' | 'full',
): string {
  const part = strings.partsOfSpeech[partOfSpeech][form];
  return gender === undefined
    ? part
    : fill(strings.partOfSpeechWithGender, {
        partOfSpeech: part,
        gender: strings.genders[gender][form],
      });
}
