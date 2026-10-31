import type { Clock, RateLimits } from '../ports';
import { countRequest, ipSubject, type TooManyRequests } from '../rate-limit';

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
  /** Apple sign-ins from one IP address: each costs a check of the token against Apple's keys. */
  appleSignInsPerIp: { requests: 30, windowSeconds: 10 * 60 },
} as const;

/** Counts the sign-in requests against their limits. */
export interface SignInLimits {
  /** Counts a Sign-in code request from the IP address for the email; none when it may be sent. */
  codeRequest(email: string, ip: string): Promise<TooManyRequests | undefined>;
  /** Counts a Sign-in code check from the IP address for the email; none when it may be checked. */
  codeCheck(email: string, ip: string): Promise<TooManyRequests | undefined>;
  /** Counts a Google sign-in from the IP address; none when its token may be verified. */
  googleSignIn(ip: string): Promise<TooManyRequests | undefined>;
  /** Counts an Apple sign-in from the IP address; none when its token may be verified. */
  appleSignIn(ip: string): Promise<TooManyRequests | undefined>;
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
    appleSignIn: (ip) => count('appleSignInsPerIp', ipSubject(ip)),
  };
}
