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

/** The days of a period in the admin's time zone. */
const PERIOD_DAYS: Readonly<Record<PeriodId, number>> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };

/** A day as `YYYY-MM-DD` in Kyiv, where the owner reads the admin. */
const kyivDay = (instant: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(instant);

/** The first and the last day of a period that ends today in Kyiv, both included. */
export function periodDays(period: PeriodId, now: Date): { from: string; to: string } {
  const to = kyivDay(now);
  const first = new Date(`${to}T12:00:00.000Z`);
  first.setUTCDate(first.getUTCDate() - (PERIOD_DAYS[period] - 1));
  return { from: first.toISOString().slice(0, 10), to };
}
