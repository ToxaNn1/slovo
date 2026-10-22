import { fill, type EditionStrings, type Register } from '@slovo/contracts';
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

/**
 * A register label as the card shows it («діал.») or VoiceOver reads it
 * («діалектне»), the dialectal one followed by the Word's region when it
 * names one: «діал., Гуцульщина».
 */
export function registerText(
  strings: Pick<EditionStrings['wordCard'], 'registers' | 'registerWithRegion'>,
  register: Register,
  region: string | undefined,
  form: 'short' | 'full',
): string {
  const label = strings.registers[register][form];
  return register === 'dialectal' && region !== undefined
    ? fill(strings.registerWithRegion, { register: label, region })
    : label;
}

/** What sits between the part of speech and each register on the short line. */
const REGISTER_SEPARATOR = ' · ';

/**
 * A Word's part of speech with its gender and then its registers, in the
 * Word's order, the dialectal one with the Word's region, on one line: the
 * short form a Share Card shows («ім., ж. р. · розм.»), where the Entry card
 * draws the registers as chips, or the full words VoiceOver reads. Without a
 * register it is the part of speech alone.
 */
export function wordGrammarText(
  strings: Pick<
    EditionStrings['wordCard'],
    'partsOfSpeech' | 'genders' | 'partOfSpeechWithGender' | 'registers' | 'registerWithRegion'
  >,
  word: Pick<WordCardModel, 'partOfSpeech' | 'gender' | 'registers' | 'region'>,
  form: 'short' | 'full',
): string {
  return [
    partOfSpeechText(strings, word, form),
    ...word.registers.map((register) => registerText(strings, register, word.region, form)),
  ].join(form === 'short' ? REGISTER_SEPARATOR : ', ');
}
