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

/**
 * Where a text sends the reader to change their Mix: the tab «Теми» while
 * the mixTab switch is in effect, Settings' «Мої Теми» while it is not (ADR 0201).
 */
export type MixPlace = 'tab' | 'settings';

/** A text that names where the Mix is, in a version for each {@link MixPlace}. */
export const byMixPlaceOf = <T extends z.ZodType<string>>(text: T) =>
  z.strictObject({ tab: text, settings: text });

/** A text that names no place, or one in a version for each {@link MixPlace}. */
export const MaybeByMixPlaceSchema = TextSchema.or(byMixPlaceOf(TextSchema));

/** The version of a text for the place the Mix is; a text that names no place is itself. */
export function inMixPlace(
  text: string | { readonly tab: string; readonly settings: string },
  place: MixPlace,
): string {
  return typeof text === 'string' ? text : text[place];
}

/** `{name}` placeholders of a template filled from `values`. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

/**
 * The plural form the language of `locale` takes for a count, by
 * `Intl.PluralRules`, its placeholders left unfilled, e.g. «{count} записів».
 */
export function pluralForm(locale: string): (forms: Plural, count: number) => string {
  const pluralRules = new Intl.PluralRules(locale);
  return (forms, count) => forms[pluralRules.select(count)] ?? forms.other;
}

/**
 * Fills a count into the plural form the language of `locale` takes for it,
 * by `Intl.PluralRules`, e.g. «17 записів» in `uk`.
 */
export function pluralCount(locale: string): (forms: Plural, count: number) => string {
  const form = pluralForm(locale);
  return (forms, count) => fill(form(forms, count), { count: String(count) });
}

/**
 * A count in every plural form, like `PluralSchema`, each form also holding
 * the placeholders `names`, e.g. «Найкраще у Грі: {count} з {total}».
 */
export function pluralOf(...names: readonly string[]) {
  const form = templateOf('count', ...names);
  return z.strictObject({
    zero: form.optional(),
    one: form.optional(),
    two: form.optional(),
    few: form.optional(),
    many: form.optional(),
    other: form,
  });
}

/**
 * A count in every plural form the Edition's language has, by CLDR plural
 * category, which the app picks with `Intl.PluralRules` (e.g. «1 запис»,
 * «2 записи», «17 записів»). `other` is required, as every language has it.
 */
export const PluralSchema = pluralOf();

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
