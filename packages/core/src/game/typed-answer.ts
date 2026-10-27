import { STRESS_MARK } from '../entries/stress';

/** Every apostrophe a reader's keyboard may type, compared as one. */
const APOSTROPHES = /['ʼ’]/g;

/**
 * The text as a typed answer is compared: lower case, without Stress marks,
 * one kind of apostrophe and no spaces at the ends. Letters stay distinct
 * otherwise, so г and ґ, е and ё never match: decomposing first takes out a
 * Stress mark typed over a precomposed letter and keeps the diaeresis of ё.
 */
export function typedAnswerKey(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(STRESS_MARK, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(APOSTROPHES, 'ʼ')
    .trim();
}

/** Whether the reader's typed text is the Round's right answer (spec #772). */
export function typedAnswerMatches(typed: string, right: string): boolean {
  return typedAnswerKey(typed) === typedAnswerKey(right);
}
