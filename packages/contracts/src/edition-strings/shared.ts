import { z } from 'zod';

import { TextSchema } from '../shared';

/** A label in two forms: short for the screen, full for VoiceOver. */
export const LabelSchema = z.strictObject({
  /** The dictionary abbreviation the card shows, e.g. "ім.". */
  short: TextSchema,
  /** The whole word VoiceOver reads, e.g. "іменник". */
  full: TextSchema,
});

/** Text with `{name}` placeholders that must all be present. */
export const templateOf = (...names: readonly string[]) =>
  TextSchema.refine(
    (text) => names.every((name) => text.includes(`{${name}}`)),
    `Expected the placeholders ${names.map((name) => `{${name}}`).join(', ')}`,
  );

/** The text of a count, with the `{count}` placeholder for the number. */
const CountTextSchema = templateOf('count');

/**
 * A count in every plural form the Edition's language has, by CLDR plural
 * category, which the app picks with `Intl.PluralRules` (e.g. «1 запис»,
 * «2 записи», «17 записів»). `other` is required, as every language has it.
 */
export const PluralSchema = z.strictObject({
  zero: CountTextSchema.optional(),
  one: CountTextSchema.optional(),
  two: CountTextSchema.optional(),
  few: CountTextSchema.optional(),
  many: CountTextSchema.optional(),
  other: CountTextSchema,
});

export type Plural = z.infer<typeof PluralSchema>;
