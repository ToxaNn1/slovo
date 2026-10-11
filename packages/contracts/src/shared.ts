import { z } from 'zod';

/** Non-empty text in the Edition's language. */
export const TextSchema = z.string().min(1);

const WebAddressSchema = z.url({ protocol: /^https?$/ });

/** Where content was taken from: a citation, its web address and an archived copy. */
export const SourceSchema = z.strictObject({
  title: TextSchema,
  url: WebAddressSchema.optional(),
  archivedUrl: WebAddressSchema.optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const hasNoRepeats = (items: readonly unknown[]) => new Set(items).size === items.length;
