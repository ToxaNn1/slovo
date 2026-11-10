import { z } from 'zod';

/**
 * The floor an Edition's content must reach before it ships, declared by the
 * Edition in `content/targets.json`. Every target is optional; a missing one
 * is not checked. The counts leave Retired Entries out, as the report does.
 */
export const ContentTargetsSchema = z.strictObject({
  minWords: z.int().nonnegative().optional(),
  minCorrections: z.int().nonnegative().optional(),
  minIdioms: z.int().nonnegative().optional(),
  minWordsPerCategory: z.int().nonnegative().optional(),
  /** A floor of Words for each named Category, taken over `minWordsPerCategory` for it. */
  minWordsByCategory: z.record(z.string(), z.int().nonnegative()).optional(),
  /** A floor of Corrections for each of the Edition's Categories of Corrections. */
  minCorrectionsPerCategory: z.int().nonnegative().optional(),
  /** Every rarity, 1 to 5, has at least one Word. */
  everyRarity: z.boolean().optional(),
  /** Every Word has at least one Stress. */
  everyWordHasStress: z.boolean().optional(),
});

export type ContentTargets = z.infer<typeof ContentTargetsSchema>;
