import { createHmac } from 'node:crypto';

import type { RateLimits } from '@slovo/server-core';
import { eq, lte, sql } from 'drizzle-orm';

import type { Database } from './database/database';
import { rateLimits } from './database/schema';

/**
 * The windows of the sign-in limits, of Sync's requests, of Mistake Reports,
 * of counter events and of new Collection Links, kept in the `rate_limits` table under the HMAC-SHA256 of their key (ADR 0030), so the
 * table names no email and no IP address. The HMAC's key is derived from the
 * secret, so it is not the one that signs the Sessions' tokens.
 */
export function createRateLimits({ db }: Database, { secret }: { secret: string }): RateLimits {
  const hmacKey = createHmac('sha256', secret).update('rate-limits').digest();
  const keyOf = (key: string) => createHmac('sha256', hmacKey).update(key).digest('base64url');
  const take: RateLimits['take'] = async (subject, { requests, windowSeconds }, now, weight) => {
    const key = keyOf(subject);
    // Windows that have ended count nothing any more.
    await db.delete(rateLimits).where(lte(rateLimits.windowEnds, now));
    // One statement, so requests that come together each count, and only
    // when they fit: a request that would cross the limit leaves its window
    // as it was. A window that ended since the line above opens anew here.
    const ended = sql`${rateLimits.windowEnds} <= ${now}`;
    const [taken] = await db
      .insert(rateLimits)
      .values({ key, count: weight, windowEnds: new Date(now.getTime() + windowSeconds * 1000) })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${ended} then excluded.count else ${rateLimits.count} + excluded.count end`,
          windowEnds: sql`case when ${ended} then excluded.window_ends else ${rateLimits.windowEnds} end`,
        },
        setWhere: sql`${ended} or ${rateLimits.count} + excluded.count <= ${requests}`,
      })
      .returning({ windowEnds: rateLimits.windowEnds });
    if (taken !== undefined) return { taken: true, windowEnds: taken.windowEnds };
    const [full] = await db
      .select({ windowEnds: rateLimits.windowEnds })
      .from(rateLimits)
      .where(eq(rateLimits.key, key));
    // The full window ended and went since the statement above: take it anew.
    if (full === undefined) return take(subject, { requests, windowSeconds }, now, weight);
    return { taken: false, windowEnds: full.windowEnds };
  };
  return { take };
}
