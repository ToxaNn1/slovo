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

/** Where content was taken from: a citation, its web address and an archived copy. */
export const SourceSchema = z.strictObject({
  title: TextSchema,
  url: WebAddressSchema.optional(),
  archivedUrl: WebAddressSchema.optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const hasNoRepeats = (items: readonly unknown[]) => new Set(items).size === items.length;
