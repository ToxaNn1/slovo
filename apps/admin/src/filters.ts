import { EditionIdSchema } from '@slovo/contracts/admin-api';
import { z } from 'zod';

/** The periods of the global period filter, shortest first. */
export const PERIODS = ['1d', '7d', '30d', '90d'] as const;

export type PeriodId = (typeof PERIODS)[number];

export const PERIOD_LABELS: Readonly<Record<PeriodId, string>> = {
  '1d': '24 години',
  '7d': '7 днів',
  '30d': '30 днів',
  '90d': '90 днів',
};

/** The period a section reads while the URL names none. */
export const DEFAULT_PERIOD: PeriodId = '7d';

/**
 * The global filters, kept in the URL so every section and a copied link read
 * the same choice. No `edition` is «Усі Editions»; a value the URL can't hold
 * falls back to the default instead of failing the page.
 */
export const FiltersSchema = z.object({
  edition: EditionIdSchema.optional().catch(undefined),
  period: z.enum(PERIODS).optional().catch(undefined),
});

export type Filters = z.infer<typeof FiltersSchema>;
