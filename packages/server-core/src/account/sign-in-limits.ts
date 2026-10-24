import type { Clock, RateLimits } from '../ports';
import { countRequest, type TooManyRequests } from '../rate-limit';

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/**
 * The limits of signing in (spec #333): how many requests a window of time
 * takes, per email and per IP address. A request over a limit is refused.
 * The day's limits per email (#649) cap how many guesses one email takes:
 * each code has 5 tries, so 10 codes and 25 checks a day leave a guesser 25
 * tries a day against a million codes.
 */
const SIGN_IN_LIMITS = {
  /** Sign-in codes sent to one email. */
  codesPerEmail: { requests: 5, windowSeconds: HOUR },
  /** Sign-in codes sent to one email in a day. */
  codesPerEmailPerDay: { requests: 10, windowSeconds: DAY },
  /** Sign-in code checks for one email in a day. */
  codeChecksPerEmailPerDay: { requests: 25, windowSeconds: DAY },
  /** Sign-in code requests from one IP address. */
  codeRequestsPerIp: { requests: 20, windowSeconds: 10 * 60 },
  /** Sign-in code checks from one IP address. */
  codeChecksPerIp: { requests: 30, windowSeconds: 10 * 60 },
  /** Google sign-ins from one IP address: each costs a check of the token against Google's keys. */
  googleSignInsPerIp: { requests: 30, windowSeconds: 10 * 60 },
} as const;

/**
 * What a per-IP limit counts for the address: an IPv4 address itself, an
 * IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) as its IPv4, and any other IPv6
 * address as its /64 prefix, since a host normally owns the whole /64 and would
 * skip the limits by rotating addresses in it. An address that is neither is
 * counted as written.
 */
function ipSubject(ip: string): string {
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

/** Counts the sign-in requests against their limits. */
export interface SignInLimits {
  /** Counts a Sign-in code request from the IP address for the email; none when it may be sent. */
  codeRequest(email: string, ip: string): Promise<TooManyRequests | undefined>;
  /** Counts a Sign-in code check from the IP address for the email; none when it may be checked. */
  codeCheck(email: string, ip: string): Promise<TooManyRequests | undefined>;
  /** Counts a Google sign-in from the IP address; none when its token may be verified. */
  googleSignIn(ip: string): Promise<TooManyRequests | undefined>;
}

export function createSignInLimits({
  rateLimits,
  clock,
}: {
  rateLimits: RateLimits;
  clock: Clock;
}): SignInLimits {
  const count = (limit: keyof typeof SIGN_IN_LIMITS, subject: string) =>
    countRequest(rateLimits, `${limit}:${subject}`, SIGN_IN_LIMITS[limit], clock.now());

  return {
    // A request the IP address may not make leaves the email's codes uncounted,
    // and one the hour refuses leaves the day's uncounted.
    codeRequest: async (email, ip) =>
      (await count('codeRequestsPerIp', ipSubject(ip))) ??
      (await count('codesPerEmail', email)) ??
      count('codesPerEmailPerDay', email),
    codeCheck: async (email, ip) =>
      (await count('codeChecksPerIp', ipSubject(ip))) ?? count('codeChecksPerEmailPerDay', email),
    googleSignIn: (ip) => count('googleSignInsPerIp', ipSubject(ip)),
  };
}
