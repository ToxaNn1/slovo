import type { RateLimits, RequestLimit } from './ports';

/** What a request over a limit gets: when, in whole seconds, it may come again. */
export interface TooManyRequests {
  readonly ok: false;
  readonly reason: 'too-many-requests';
  readonly retryAfterSeconds: number;
}

/**
 * Takes a request under the key at `now` within the limit, as `weight`
 * requests (one unless told), and answers when it may come again if it does
 * not fit; none when it may go on. A request that would cross the limit is
 * refused whole and counts nothing.
 */
export async function countRequest(
  rateLimits: RateLimits,
  key: string,
  limit: RequestLimit,
  now: Date,
  weight = 1,
): Promise<TooManyRequests | undefined> {
  const { taken, windowEnds } = await rateLimits.take(key, limit, now, weight);
  if (taken) return undefined;
  const left = Math.ceil((windowEnds.getTime() - now.getTime()) / 1000);
  return { ok: false, reason: 'too-many-requests', retryAfterSeconds: Math.max(1, left) };
}

/** The limits of attempts under a key: `attempts` in a row block it for `blockSeconds`. */
export interface AttemptLimit {
  readonly attempts: number;
  readonly blockSeconds: number;
  readonly now: Date;
}

const blockKeyOf = (key: string) => `${key}:blocked`;

function tooManyUntil(windowEnds: Date, now: Date): TooManyRequests {
  return {
    ok: false,
    reason: 'too-many-requests',
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnds.getTime() - now.getTime()) / 1000)),
  };
}

/** Blocks the key for `blockSeconds` from `now`, or answers the block it has. */
async function block(
  rateLimits: RateLimits,
  key: string,
  { blockSeconds, now }: AttemptLimit,
): Promise<TooManyRequests> {
  const { windowEnds } = await rateLimits.take(
    blockKeyOf(key),
    { requests: 1, windowSeconds: blockSeconds },
    now,
    1,
  );
  return tooManyUntil(windowEnds, now);
}

/**
 * Takes an attempt under the key (a code to check, say) before it is checked,
 * so attempts that come together each count and no more than `attempts` are
 * ever checked: one past them is refused, and blocks the key. An attempt
 * that turns out right is given back (`giveBackAttempt`) or clears the
 * attempts (`clearFailures`); a wrong one stays counted (`attemptFailed`).
 * Answers when a blocked key may try again; none when the attempt may go on.
 */
export async function takeAttempt(
  rateLimits: RateLimits,
  key: string,
  limit: AttemptLimit,
): Promise<TooManyRequests | undefined> {
  const blocked = await rateLimits.peek(blockKeyOf(key), limit.now);
  if (blocked !== undefined) return tooManyUntil(blocked.windowEnds, limit.now);
  const { taken } = await rateLimits.take(
    key,
    { requests: limit.attempts, windowSeconds: limit.blockSeconds },
    limit.now,
    1,
  );
  return taken ? undefined : block(rateLimits, key, limit);
}

/**
 * Answers what an attempt taken under the key earns once it turned out wrong:
 * the attempts left, or, when it was the last, the block it starts.
 */
export async function attemptFailed(
  rateLimits: RateLimits,
  key: string,
  limit: AttemptLimit,
): Promise<{ readonly attemptsLeft: number } | TooManyRequests> {
  const count = (await rateLimits.peek(key, limit.now))?.count ?? 0;
  if (count < limit.attempts) return { attemptsLeft: limit.attempts - count };
  return block(rateLimits, key, limit);
}

/** Gives back an attempt taken under the key that turned out right. */
export function giveBackAttempt(rateLimits: RateLimits, key: string): Promise<void> {
  return rateLimits.giveBack(key, 1);
}

/** Clears the failed attempts under the key, after a success. */
export function clearFailures(rateLimits: RateLimits, key: string): Promise<void> {
  return rateLimits.clear(key);
}

/**
 * What a per-IP limit counts for the address: an IPv4 address itself, an
 * IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) as its IPv4, and any other IPv6
 * address as its /64 prefix, since a host normally owns the whole /64 and would
 * skip the limits by rotating addresses in it. An address that is neither is
 * counted as written.
 */
export function ipSubject(ip: string): string {
  if (!ip.includes(':')) return ip;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped?.[1] !== undefined) return mapped[1];
  const groups = ipv6Groups(ip);
  if (groups === undefined) return ip;
  return `${groups.slice(0, 4).join(':')}::/64`;
}

/** The eight groups of an IPv6 address in lowercase hex without leading zeros; none for an address that doesn't parse. */
function ipv6Groups(ip: string): readonly string[] | undefined {
  const halves = ip.split('::');
  if (halves.length > 2) return undefined;
  const parse = (half: string | undefined) =>
    half === undefined || half === '' ? [] : half.split(':');
  const head = parse(halves[0]);
  const tail = parse(halves[1]);
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return undefined;
  const groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return undefined;
  return groups.map((group) => parseInt(group, 16).toString(16));
}
