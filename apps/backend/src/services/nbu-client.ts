import type { NbuPort } from '@slovo/server-core';
import { z } from 'zod';

/** The NBU's page of the dollar's official rate for a day `YYYY-MM-DD`: about 150 bytes of JSON. */
export const nbuRateUrl = (day: string) => `${NBU_RATE_PAGES}${day.replaceAll('-', '')}&json`;

/** The start every day's NBU page of the dollar shares. */
export const NBU_RATE_PAGES =
  'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&date=';

/** The NBU's answer: one row for the dollar, its day as `DD.MM.YYYY`. */
const NbuAnswerSchema = z.tuple([
  z.object({
    cc: z.literal('USD'),
    rate: z.number().positive(),
    exchangedate: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/),
  }),
]);

/**
 * Reads the dollar's official rate from the NBU's open API, which takes no
 * key. It answers that it can't when the NBU refuses, is unreachable or
 * answers something else.
 */
export function createNbuClient(fetch: typeof globalThis.fetch = globalThis.fetch): NbuPort {
  return {
    async usdRate(day) {
      try {
        const response = await fetch(nbuRateUrl(day), { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return { ok: false };
        const parsed = NbuAnswerSchema.safeParse(await response.json());
        if (!parsed.success) return { ok: false };
        const [{ rate, exchangedate }] = parsed.data;
        const [dd, mm, yyyy] = exchangedate.split('.');
        return { ok: true, rate: { uahPerUsd: rate, on: `${yyyy ?? ''}-${mm ?? ''}-${dd ?? ''}` } };
      } catch {
        return { ok: false };
      }
    },
  };
}
