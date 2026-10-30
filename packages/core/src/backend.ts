import {
  ORPCError,
  safe,
  TooManyRequestsError,
  type ClientPromiseResult,
} from '@slovo/contracts/api';

import type { RequestFailure } from './ports';

/** The errors the contract defines for a procedure that throws `E`, each with its code and data. */
type DefinedError<E> = Extract<E, ORPCError<string, unknown>>;

/**
 * What a call of the backend comes to for a Core module; it never rejects
 * (ADR 0037, 0062). Success carries the call's output. An error the contract
 * defines for the procedure comes to the failure `failureOf` makes of it, if
 * any; its code is typed by the contract, so comparing it with a code the
 * procedure doesn't define, or renaming one in the contract, fails typecheck.
 * Otherwise no answer is `offline`, a 429 `too-many-requests` with the
 * seconds of its `Retry-After`, a 5xx `server-error`, and any other answer
 * `unexpected`, such as a request the backend refuses (400) or an Edition it
 * doesn't serve (404).
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
  if (error.status === 429) {
    const retryAfter = error instanceof TooManyRequestsError ? error.retryAfter : undefined;
    return { ok: false, reason: 'too-many-requests', retryAfter };
  }
  if (error.status >= 500) return { ok: false, reason: 'server-error' };
  return { ok: false, reason: 'unexpected' };
}
