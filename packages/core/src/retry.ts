import type { Random, RequestFailure, Schedule } from './ports';

/** How many times a request that failed in a way that may pass is tried again, at most. */
export const REQUEST_RETRIES = 3;

/** The longest wait before the first try again, in milliseconds; each next one doubles. */
const FIRST_RETRY_DELAY = 1_000;

type Answer = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const passing: ReadonlySet<string> = new Set<RequestFailure['reason']>([
  'offline',
  'server-error',
  'too-many-requests',
]);

/**
 * Makes a request and, while it fails in a way that may pass (a `RequestFailure`),
 * tries it again, at most `REQUEST_RETRIES` times, and answers the last
 * answer. The waits back off exponentially with jitter: before the nth try
 * again it waits between half and all of 1 s times 2ⁿ⁻¹, drawn from `random`,
 * through `schedule`. Any other answer comes back at once.
 */
export async function withRetries<A extends Answer>(
  request: () => Promise<A>,
  { schedule, random }: { schedule: Schedule; random: Random },
): Promise<A> {
  for (let retry = 0; ; retry += 1) {
    const answer = await request();
    const failure: Answer = answer;
    if (failure.ok || !passing.has(failure.reason) || retry === REQUEST_RETRIES) return answer;
    const longest = FIRST_RETRY_DELAY * 2 ** retry;
    await new Promise<void>((resolve) => {
      schedule(resolve, (longest * (1 + random.next())) / 2);
    });
  }
}
