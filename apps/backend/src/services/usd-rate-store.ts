import type { Clock, NbuRate, UsdRateStore } from '@slovo/server-core';
import { and, desc, eq, like } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../database/database';
import { sourcingCache } from '../database/schema';
import { NBU_RATE_PAGES, nbuRateUrl } from './nbu-client';

/** A kept rate, as the store wrote it. */
const KeptRateSchema = z.object({ uahPerUsd: z.number().positive(), on: z.iso.date() });

/**
 * The NBU reads in the sourcing cache, a row a Kyiv day under the day's NBU
 * page: a found rate is a 200 with the rate as its body, a failed
 * read a 0 with none.
 */
export function createUsdRateStore(database: Database, clock: Clock): UsdRateStore {
  const { db } = database;
  const rateOf = (body: string): NbuRate => KeptRateSchema.parse(JSON.parse(body));

  return {
    async readOf(day) {
      const [row] = await db
        .select()
        .from(sourcingCache)
        .where(eq(sourcingCache.pageUrl, nbuRateUrl(day)));
      if (row === undefined) return undefined;
      return row.httpStatus === 200 ? rateOf(row.body) : 'failed';
    },

    async keep(day, read) {
      const row =
        read === 'failed'
          ? { pageUrl: nbuRateUrl(day), httpStatus: 0, body: '', fetchedAt: clock.now() }
          : {
              pageUrl: nbuRateUrl(day),
              httpStatus: 200,
              body: JSON.stringify(read),
              fetchedAt: clock.now(),
            };
      await db
        .insert(sourcingCache)
        .values(row)
        .onConflictDoUpdate({ target: sourcingCache.pageUrl, set: row });
    },

    async lastKnown() {
      // A day's page ends with its date: the latest day with a rate sorts first.
      const [row] = await db
        .select()
        .from(sourcingCache)
        .where(
          and(like(sourcingCache.pageUrl, `${NBU_RATE_PAGES}%`), eq(sourcingCache.httpStatus, 200)),
        )
        .orderBy(desc(sourcingCache.pageUrl))
        .limit(1);
      return row === undefined ? undefined : rateOf(row.body);
    },
  };
}
