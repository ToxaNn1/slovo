import {
  ADMIN_PERIODS,
  EditionIdSchema,
  PERIOD_DAYS,
  type AdminPeriod,
} from '@slovo/contracts/admin-api';
import { z } from 'zod';

/** The periods of the global period filter, shortest first. */
export const PERIODS = ADMIN_PERIODS;

export type PeriodId = AdminPeriod;

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

/** The longest period Якість reads: Sentry keeps 30 days. */
const QUALITY_MAX_DAYS = 30;

/** The hint of a period Якість cuts. */
export const QUALITY_CAP_HINT = 'Sentry зберігає дані 30 днів';

/** The period Якість reads for the one chosen: one over 30 days reads as 30 days. */
export function qualityPeriod(period: PeriodId): PeriodId {
  return PERIOD_DAYS[period] > QUALITY_MAX_DAYS ? '30d' : period;
}
