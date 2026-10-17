import type { Random, RequestFailure, Schedule } from './ports';

/** How many times a request that failed in a way that may pass is tried again, at most. */
const REQUEST_RETRIES = 3;

/** The longest wait before the first try again, in milliseconds; each next one doubles. */
const FIRST_RETRY_DELAY = 1_000;

/** What a request to the backend answers: success, or a failure with its reason. */
export type Answer = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * The reasons of the failures that may pass while the tries wait. Too many
 * requests is not one: a limit of the backend holds for minutes, and a spent
 * Sign-in code until a new one is sent (ADR 0037).
 */
const mayPass: ReadonlySet<string> = new Set<RequestFailure['reason']>(['offline', 'server-error']);

/**
 * Makes a request and, while it fails in a way that may pass (no answer or a 5xx),
 * tries it again, at most `REQUEST_RETRIES` times, and answers the last
 * answer. The waits back off exponentially with jitter: before the nth try
 * again it waits between half and all of 1 s times 2ⁿ⁻¹, drawn from `random`,
 * through `schedule`. Any other answer comes back at once (ADR 0037).
 */
export async function withRetries<A extends Answer>(
  request: () => Promise<A>,
  { schedule, random }: { schedule: Schedule; random: Random },
): Promise<A> {
  for (let retry = 0; ; retry += 1) {
    const answer = await request();
    const reply: Answer = answer;
    if (reply.ok || !mayPass.has(reply.reason) || retry === REQUEST_RETRIES) return answer;
    const longest = FIRST_RETRY_DELAY * 2 ** retry;
    await new Promise<void>((resolve) => {
      schedule(resolve, (longest * (1 + random.next())) / 2);
    });
  }
}
