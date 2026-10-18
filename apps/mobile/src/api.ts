import { createApiClient, ORPCError, safe, type ClientPromiseResult } from '@slovo/contracts/api';
import type { RequestFailure } from '@slovo/core';

/**
 * The backend's address: `EXPO_PUBLIC_SLOVO_API_URL`, or in development the
 * backend on this Mac, which the iOS Simulator reaches on its localhost.
 */
const API_URL = process.env.EXPO_PUBLIC_SLOVO_API_URL ?? 'http://localhost:8787';

/** The app's client of the API, built from the contract (spec #333). */
export const apiClient = createApiClient({ url: API_URL });

/** The `fetch` the contract's client sends its requests with. */
export type ClientFetch = NonNullable<Parameters<typeof createApiClient>[0]['fetch']>;

/** The errors the contract defines for a procedure that throws `E`, each with its code and data. */
type DefinedError<E> = Extract<E, ORPCError<string, unknown>>;

/**
 * What a call of the API comes to for the Core; it never rejects. Success
 * carries the call's output. An error the contract defines for the procedure
 * comes to the failure `failureOf` makes of it, if any; its code is typed by
 * the contract, so comparing it with a code the procedure doesn't define, or
 * renaming one in the contract, fails typecheck. Otherwise no answer is
 * `offline`, a 429 `too-many-requests`, a 5xx `server-error`, and any other
 * answer `unexpected`, such as a request the backend refuses (400) or an
 * Edition it doesn't serve (404).
 */
export async function answerOf<O, E, F extends { readonly ok: false } = never>(
  call: ClientPromiseResult<O, E>,
  failureOf?: (error: DefinedError<E>) => F | undefined,
): Promise<{ readonly ok: true; readonly output: O } | F | RequestFailure> {
  const { error, data, isDefined, isSuccess } = await safe(call);
  if (isSuccess) return { ok: true, output: data };
  const failure = isDefined ? failureOf?.(error) : undefined;
  if (failure !== undefined) return failure;
  if (!(error instanceof ORPCError)) return { ok: false, reason: 'offline' };
  if (error.status === 429) return { ok: false, reason: 'too-many-requests' };
  if (error.status >= 500) return { ok: false, reason: 'server-error' };
  return { ok: false, reason: 'unexpected' };
}

/**
 * The client of a device signed in with the Session's token, which it sends as
 * `Authorization: Bearer`; `fetch` replaces the global one.
 */
export const apiClientOf = (token: string, fetch?: ClientFetch) =>
  createApiClient({
    url: API_URL,
    headers: { authorization: `Bearer ${token}` },
    ...(fetch === undefined ? {} : { fetch }),
  });
