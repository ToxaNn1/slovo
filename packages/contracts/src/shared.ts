import { z } from 'zod';

/** Non-empty text in the Edition's language. */
export const TextSchema = z.string().min(1);

/** A colour as six hex digits, e.g. `#F5EEE2`. */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Expected a six-digit hex colour such as #F5EEE2');

/** `#RRGGBB`, or `rgba(r, g, b, a)` for a colour drawn over others. */
export const ColorSchema = z.union(
  [
    HexColorSchema,
    z.string().regex(/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/),
  ],
  'Expected #RRGGBB or rgba(r, g, b, a)',
);

/** A web address, `http` or `https`. */
export const WebAddressSchema = z.url({ protocol: /^https?$/ });

/**
 * Where content was taken from: a citation, its web address and an archived
 * copy. `shortName` names the source in the card's «Джерело:» line; a card
 * names a source without one by its `title`.
 */
export const SourceSchema = z.strictObject({
  title: TextSchema,
  shortName: TextSchema.optional(),
  url: WebAddressSchema.optional(),
  archivedUrl: WebAddressSchema.optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const hasNoRepeats = (items: readonly unknown[]) => new Set(items).size === items.length;

/** The rarities of Words, the commonest first: 1 ("heard it, never use it") to 5 ("almost nobody knows it"). */
export const RARITIES = [1, 2, 3, 4, 5] as const;

/** A rarity of Words, from 1 ("heard it, never use it") to 5 ("almost nobody knows it"). */
export const RaritySchema = z.literal(RARITIES, { error: 'Expected a whole number from 1 to 5' });

export type Rarity = z.infer<typeof RaritySchema>;
