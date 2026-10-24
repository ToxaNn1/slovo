import { createHmac } from 'node:crypto';

import type { RateLimits } from '@slovo/server-core';
import { lte, sql } from 'drizzle-orm';

import type { Database } from './database/database';
import { rateLimits } from './database/schema';

/**
 * The windows of the sign-in limits and of Sync's requests, kept in the
 * `rate_limits` table under the HMAC-SHA256 of their key (ADR 0030), so the
 * table names no email and no IP address. The HMAC's key is derived from the
 * secret, so it is not the one that signs the Sessions' tokens.
 */
export function createRateLimits({ db }: Database, { secret }: { secret: string }): RateLimits {
  const hmacKey = createHmac('sha256', secret).update('rate-limits').digest();
  const keyOf = (key: string) => createHmac('sha256', hmacKey).update(key).digest('base64url');
  return {
    async count(subject, windowSeconds, now) {
      const key = keyOf(subject);
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
