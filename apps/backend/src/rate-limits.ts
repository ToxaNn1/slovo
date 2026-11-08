import { createHmac } from 'node:crypto';

import type { RateLimits } from '@slovo/server-core';
import { and, eq, gt, lte, sql } from 'drizzle-orm';

import type { Database } from './database/database';
import { rateLimits } from './database/schema';

/** How often the ended windows are removed. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * The windows of the sign-in limits, of Sync's requests, of Mistake Reports,
 * of counter events and of new Collection Links, kept in the `rate_limits` table under the HMAC-SHA256 of their key (ADR 0030), so the
 * table names no email and no IP address. The HMAC's key is derived from the
 * secret, so it is not the one that signs the Sessions' tokens. A request
 * touches only its own window; the ended windows of every key are removed
 * by a request at most once an hour.
 */
export function createRateLimits({ db }: Database, { secret }: { secret: string }): RateLimits {
  const hmacKey = createHmac('sha256', secret).update('rate-limits').digest();
  const keyOf = (key: string) => createHmac('sha256', hmacKey).update(key).digest('base64url');
  // When the ended windows go next; the first request removes them.
  let nextSweep: Date | undefined;
  const take: RateLimits['take'] = async (subject, { requests, windowSeconds }, now, weight) => {
    const key = keyOf(subject);
    // A weight over the limit fits in no window, a fresh one included, so it
    // is refused whole here: the statement below checks only a running window.
    if (weight > requests) {
      const [running] = await db
        .select({ windowEnds: rateLimits.windowEnds })
        .from(rateLimits)
        .where(eq(rateLimits.key, key));
      return { taken: false, windowEnds: running?.windowEnds ?? now };
    }
    // Windows that have ended count nothing any more, so they go, at most
    // once an hour rather than on every request.
    if (nextSweep === undefined || now >= nextSweep) {
      nextSweep = new Date(now.getTime() + SWEEP_INTERVAL_MS);
      await db.delete(rateLimits).where(lte(rateLimits.windowEnds, now));
    }
    // One statement, so requests that come together each count, and only
    // when they fit: a request that would cross the limit leaves its window
    // as it was. An ended window of the key opens anew here.
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
  return {
    take,
    async peek(subject, now) {
      const [running] = await db
        .select({ count: rateLimits.count, windowEnds: rateLimits.windowEnds })
        .from(rateLimits)
        .where(and(eq(rateLimits.key, keyOf(subject)), gt(rateLimits.windowEnds, now)));
      return running;
    },
    async clear(subject) {
      await db.delete(rateLimits).where(eq(rateLimits.key, keyOf(subject)));
    },
  };
}
