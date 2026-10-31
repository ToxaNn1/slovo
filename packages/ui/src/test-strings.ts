import type { EditionStrings } from '@slovo/contracts';

/** The Edition strings with every key optional at every depth. */
export type PartialStrings<T> = {
  readonly [K in keyof T]?: T[K] extends string ? T[K] : PartialStrings<T[K]>;
};

/**
 * The Edition strings of a UI test: only those its component reads, each
 * checked against the shape of the Edition strings, so a renamed or mistyped
 * key fails the typecheck. The UI is Edition-neutral and has no Edition's
 * strings to fill the rest from: a string the test leaves out is missing.
 */
export function testStrings(strings: PartialStrings<EditionStrings>): EditionStrings {
  // The one place a test's partial strings stand for the whole.
  return strings as EditionStrings;
}
