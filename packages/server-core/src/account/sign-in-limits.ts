import type { Clock, RateLimits } from '../ports';

/**
 * The limits of signing in (spec #333): how many requests a window of time
 * takes, per email and per IP address. A request over a limit is refused.
 */
const SIGN_IN_LIMITS = {
  /** Sign-in codes sent to one email. */
  codesPerEmail: { requests: 5, windowSeconds: 60 * 60 },
  /** Sign-in code requests from one IP address. */
  codeRequestsPerIp: { requests: 20, windowSeconds: 10 * 60 },
  /** Sign-in code checks from one IP address. */
  codeChecksPerIp: { requests: 30, windowSeconds: 10 * 60 },
} as const;

/** What a request over a limit gets: when, in whole seconds, it may come again. */
export interface TooManyRequests {
  readonly ok: false;
  readonly reason: 'too-many-requests';
  readonly retryAfterSeconds: number;
}

/** Counts the sign-in requests against their limits. */
export interface SignInLimits {
  /** Counts a Sign-in code request from the IP address for the email; none when it may be sent. */
  codeRequest(email: string, ip: string): Promise<TooManyRequests | undefined>;
  /** Counts a Sign-in code check from the IP address; none when it may be checked. */
  codeCheck(ip: string): Promise<TooManyRequests | undefined>;
}

export function createSignInLimits({
  rateLimits,
  clock,
}: {
  rateLimits: RateLimits;
  clock: Clock;
}): SignInLimits {
  async function count(
    limit: keyof typeof SIGN_IN_LIMITS,
    subject: string,
  ): Promise<TooManyRequests | undefined> {
    const { requests, windowSeconds } = SIGN_IN_LIMITS[limit];
    const now = clock.now();
    const { count, windowEnds } = await rateLimits.count(`${limit}:${subject}`, windowSeconds, now);
    if (count <= requests) return undefined;
    const left = Math.ceil((windowEnds.getTime() - now.getTime()) / 1000);
    return { ok: false, reason: 'too-many-requests', retryAfterSeconds: Math.max(1, left) };
  }

  return {
    // A request the IP address may not make leaves the email's codes uncounted.
    codeRequest: async (email, ip) =>
      (await count('codeRequestsPerIp', ip)) ?? count('codesPerEmail', email),
    codeCheck: (ip) => count('codeChecksPerIp', ip),
  };
}
