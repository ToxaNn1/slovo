import type { RateLimits } from './ports';

/** How many requests a window of time takes. */
export interface RequestLimit {
  readonly requests: number;
  readonly windowSeconds: number;
}

/** What a request over a limit gets: when, in whole seconds, it may come again. */
export interface TooManyRequests {
  readonly ok: false;
  readonly reason: 'too-many-requests';
  readonly retryAfterSeconds: number;
}

/**
 * Counts one request under the key at `now` against the limit, and answers
 * when it may come again if it is over; none when it may go on.
 */
export async function countRequest(
  rateLimits: RateLimits,
  key: string,
  { requests, windowSeconds }: RequestLimit,
  now: Date,
): Promise<TooManyRequests | undefined> {
  const { count, windowEnds } = await rateLimits.count(key, windowSeconds, now);
  if (count <= requests) return undefined;
  const left = Math.ceil((windowEnds.getTime() - now.getTime()) / 1000);
  return { ok: false, reason: 'too-many-requests', retryAfterSeconds: Math.max(1, left) };
}
