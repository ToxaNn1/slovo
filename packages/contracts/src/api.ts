import { createORPCClient, isORPCErrorJson, ORPCError } from '@orpc/client';
import {
  isContractProcedure,
  oc,
  ValidationError,
  type ContractRouterClient,
  type Schema,
} from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';

import { accountContract } from './api/account';
import { adminContract } from './api/admin';
import { collectionLinksContract } from './api/collection-links';
import { contentContract } from './api/content';
import { countersContract } from './api/counters';
import { editionContract } from './api/edition';
import { reportsContract } from './api/reports';
import { syncContract } from './api/sync';

export {
  ContentSnapshotSchema,
  PACK_MEDIA_TYPE,
  PATCH_FORMAT,
  PatchSchema,
  type ContentSnapshot,
  type Patch,
} from './api/content';

/**
 * What a call throws when the backend answers with an error: its `code`, as
 * the contract names it, and its HTTP `status`. A call that gets no answer
 * throws the error of its `fetch` instead.
 */
export { ORPCError } from '@orpc/client';

/**
 * Settles a call into its output or the error it threw, with the errors the
 * contract defines for its procedure typed by their codes and data.
 */
export { safe, type ClientPromiseResult } from '@orpc/client';

/**
 * What a call throws when the backend answers 2xx with a body its
 * procedure's output doesn't take, such as a proxy's page of HTML.
 */
export { ValidationError } from '@orpc/contract';

/**
 * The API contract: the only description of the backend's API (spec #333).
 * The backend implements it and the app calls it through `createApiClient`,
 * so a mismatch fails typecheck. One router per domain. Within `/v1` it only
 * grows (ADR 0031).
 */
export const apiContract = oc.prefix('/v1').router({
  account: accountContract,
  admin: adminContract,
  collectionLinks: collectionLinksContract,
  content: contentContract,
  counters: countersContract,
  edition: editionContract,
  reports: reportsContract,
  sync: syncContract,
});

/**
 * What a call carries besides its input: the Session it acts with, when it
 * acts on an Account, which the client sends as `Authorization: Bearer`.
 */
export interface ApiCallContext {
  readonly token?: string;
}

/**
 * The API as the app calls it: one function per procedure, each taking its
 * input and, as its options, the `context` of the call.
 */
export type ApiClient = JsonifiedClient<ContractRouterClient<typeof apiContract, ApiCallContext>>;

/** The `fetch` the client sends its requests with: the global one, or a test's backend in process. */
export type ApiFetch = (request: Request) => Promise<Response>;

export interface ApiClientOptions {
  /** The backend's origin, such as `http://localhost:8787`. */
  readonly url: string;
  /** Replaces the global `fetch`, as a test does to reach the backend in process. */
  readonly fetch?: ApiFetch;
  /** Headers every request carries, such as a test's address of the device. */
  readonly headers?: Readonly<Record<string, string>>;
}

/** The seconds of a `Retry-After` header; none when the answer has no such header or it says anything else. */
function secondsOf(header: string | readonly string[] | undefined): number | undefined {
  const value = typeof header === 'string' ? header : header?.[0];
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : undefined;
}

/** Whether a body is a contract error other than `TOO_MANY_REQUESTS`, such as `CODE_SPENT`. */
function isOtherCode(body: unknown): boolean {
  return isORPCErrorJson(body) && body.defined && body.code !== 'TOO_MANY_REQUESTS';
}

/**
 * What a call throws on a 429 that is no other code of the contract: the
 * contract's `TOO_MANY_REQUESTS`, with the seconds of the answer's
 * `Retry-After`, which the backend sets on every limit; none when the answer
 * has no such header or it says anything else.
 */
export class TooManyRequestsError extends ORPCError<'TOO_MANY_REQUESTS', unknown> {
  readonly retryAfter: number | undefined;

  constructor(body: unknown, retryAfter: number | undefined) {
    const json = isORPCErrorJson(body) ? body : undefined;
    super('TOO_MANY_REQUESTS', {
      status: 429,
      defined: json?.defined ?? false,
      message: json?.message ?? 'Too many requests',
      data: json?.data,
    });
    this.retryAfter = retryAfter;
  }
}

/**
 * The output of a call that succeeded, parsed with the output of the
 * contract's procedure at `path`; throws `ValidationError` when it doesn't
 * take it. An error the call throws never gets here, so it stays as thrown.
 */
async function validOutput(path: readonly string[], output: unknown): Promise<unknown> {
  const procedure = path.reduce(childOf, apiContract);
  const schema = isContractProcedure(procedure)
    ? childOf(childOf(procedure, '~orpc'), 'outputSchema')
    : undefined;
  if (!isSchema(schema)) return output;
  const result = await schema['~standard'].validate(output);
  if (result.issues !== undefined) {
    throw new ValidationError({
      message: `The answer of ${path.join('.')} is no output of the contract`,
      issues: result.issues,
      data: output,
    });
  }
  return result.value;
}

/** The value under `key` of an object of the contract, none of anything else. */
function childOf(node: unknown, key: string): unknown {
  return typeof node === 'object' && node !== null ? Reflect.get(node, key) : undefined;
}

/** Whether the value is a schema of the contract, which validates the Standard Schema way. */
function isSchema(value: unknown): value is Schema<unknown, unknown> {
  return typeof value === 'object' && value !== null && '~standard' in value;
}

/**
 * A client of the API built from the contract. A call that acts on an
 * Account names its Session as `context.token`, which the client sends as
 * `authorization: Bearer <token>`; a 429 throws `TooManyRequestsError`. A
 * 2xx answer is parsed with its procedure's output, and one it doesn't take
 * throws `ValidationError`: no answer outside the contract reaches a caller
 * as its output.
 */
export function createApiClient({ url, fetch, headers = {} }: ApiClientOptions): ApiClient {
  return createORPCClient(
    new OpenAPILink(apiContract, {
      url,
      ...(fetch === undefined ? {} : { fetch }),
      interceptors: [async (options) => validOutput(options.path, await options.next())],
      headers: ({ context }) =>
        context.token === undefined
          ? headers
          : { ...headers, authorization: `Bearer ${context.token}` },
      customErrorResponseBodyDecoder: (body, response) =>
        response.status === 429 && !isOtherCode(body)
          ? new TooManyRequestsError(body, secondsOf(response.headers['retry-after']))
          : undefined,
    }),
  );
}
