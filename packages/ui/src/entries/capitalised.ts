/**
 * A text as an Entry card shows it: starting with a capital (owner decision
 * 11), whatever the content holds. The first letter after any leading quotes,
 * dashes and spaces becomes a capital in `locale` (the Edition's language);
 * the rest, and a text that starts with a digit or has no letter, stays as it
 * is. A Stress mark on the first letter stays on it.
 */
export function capitalised(text: string, locale?: string): string {
  const first = FIRST_LETTER_OR_DIGIT.exec(text);
  if (first === null || !LETTER.test(first[0])) return text;
  return (
    text.slice(0, first.index) +
    first[0].toLocaleUpperCase(locale) +
    text.slice(first.index + first[0].length)
  );
}

const FIRST_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/u;
