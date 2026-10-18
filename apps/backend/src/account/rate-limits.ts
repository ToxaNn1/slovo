import type { RateLimits } from '@slovo/server-core';
import { lte, sql } from 'drizzle-orm';

import type { Database } from '../database/database';
import { rateLimits } from '../database/schema';

/** The windows of the sign-in limits and of Sync's requests, kept in the `rate_limits` table. */
export function createRateLimits({ db }: Database): RateLimits {
  return {
    async count(key, windowSeconds, now) {
      // Windows that have ended count nothing any more.
      await db.delete(rateLimits).where(lte(rateLimits.windowEnds, now));
      // One statement, so requests that come together each count. A window
      // that ended since the line above opens anew here.
      const ended = sql`${rateLimits.windowEnds} <= ${now}`;
      const [window] = await db
        .insert(rateLimits)
        .values({ key, count: 1, windowEnds: new Date(now.getTime() + windowSeconds * 1000) })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            count: sql`case when ${ended} then 1 else ${rateLimits.count} + 1 end`,
            windowEnds: sql`case when ${ended} then excluded.window_ends else ${rateLimits.windowEnds} end`,
          },
        })
        .returning({ count: rateLimits.count, windowEnds: rateLimits.windowEnds });
      if (window === undefined) throw new Error('the window of a rate limit came back empty');
      return window;
    },
  };
}
