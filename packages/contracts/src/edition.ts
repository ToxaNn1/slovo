import { z } from 'zod';

/** A thematic group of Words, with its display name in the Edition's language. */
export const CategorySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case id'),
  displayName: z.string().min(1),
});

export type Category = z.infer<typeof CategorySchema>;

export const LanguageTraitsSchema = z.strictObject({
  /** Whether the language marks Stress, so every Lemma must carry it. */
  marksStress: z.boolean(),
});

export type LanguageTraits = z.infer<typeof LanguageTraitsSchema>;

/** Everything Edition-specific that the app and the Language Pack build need. */
export const EditionConfigSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Expected a lowercase id'),
  /** A BCP 47 language tag, e.g. `uk-UA`. */
  locale: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Expected a BCP 47 tag such as uk-UA'),
  displayName: z.string().min(1),
  bundleId: z
    .string()
    .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, 'Expected a reverse-DNS bundle id'),
  languageTraits: LanguageTraitsSchema,
  categories: z.array(CategorySchema).min(1),
});

export type EditionConfig = z.infer<typeof EditionConfigSchema>;
