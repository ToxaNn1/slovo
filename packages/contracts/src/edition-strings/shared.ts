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

/** `{name}` placeholders of a template filled from `values`. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

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

const LabelTextSchema = TextSchema.refine(
  (text) => !text.includes('{count}'),
  'Expected no {count}: the number is drawn apart',
);

/**
 * The word beside a number that the screen draws apart (a big «12» and
 * «днів поспіль» next to it), in every plural form the Edition's language has.
 * The forms hold no `{count}`, since the number is not part of the text.
 */
export const PluralLabelSchema = z.strictObject({
  zero: LabelTextSchema.optional(),
  one: LabelTextSchema.optional(),
  two: LabelTextSchema.optional(),
  few: LabelTextSchema.optional(),
  many: LabelTextSchema.optional(),
  other: LabelTextSchema,
});

export type PluralLabel = z.infer<typeof PluralLabelSchema>;
