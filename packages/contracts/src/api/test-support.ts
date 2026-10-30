import {
  isContractProcedure,
  type AnyContractProcedure,
  type ContractProcedure,
  type InferSchemaInput,
  type InferSchemaOutput,
} from '@orpc/contract';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { implement, ORPCError, type ProcedureHandler } from '@orpc/server';
import { ResponseHeadersPlugin, type ResponseHeadersPluginContext } from '@orpc/server/plugins';
import { z } from 'zod';

import { apiContract } from '../api';

// A helper for tests of either side of the API. No app and no backend code imports it.

/**
 * What a request brings to a procedure served in process: its headers, where
 * a Session travels, and the headers the answer gets (`resHeaders`, as on the
 * backend), such as a 429's `Retry-After`.
 */
interface InProcessContext extends ResponseHeadersPluginContext {
  readonly headers: Headers;
}

/** The handler of a procedure of the contract, typed by it. */
type HandlerOf<Procedure> =
  Procedure extends ContractProcedure<infer Input, infer Output, infer Errors, infer Meta>
    ? ProcedureHandler<
        InProcessContext,
        InferSchemaOutput<Input>,
        InferSchemaInput<Output>,
        Errors,
        Meta
      >
    : never;

type AnyHandler = HandlerOf<AnyContractProcedure>;

type Contract = typeof apiContract;

/**
 * A test's procedures of the API contract: any of them, each a handler typed
 * by the contract, which gets the procedure's `input`, the request's
 * `context.headers` and the contract's `errors` for the procedure, and
 * returns its output or throws. A procedure the test leaves out fails.
 */
export type ApiProcedures = {
  readonly [Domain in keyof Contract]?: {
    readonly [Name in keyof Contract[Domain]]?: HandlerOf<Contract[Domain][Name]>;
  };
};

/** Every error code the contract lists, on any of its procedures. */
export type ApiErrorCode = {
  [Domain in keyof Contract]: {
    [Name in keyof Contract[Domain]]: Contract[Domain][Name] extends ContractProcedure<
      infer _Input,
      infer _Output,
      infer Errors,
      infer _Meta
    >
      ? keyof Errors & string
      : never;
  }[keyof Contract[Domain]];
}[keyof Contract];

/**
 * The API contract served in process by `procedures`: the `fetch` of a test's
 * backend, for `createApiClient`. Each request goes through oRPC's OpenAPI
 * handler, as the backend's do, so a client crosses the contract's addresses,
 * input, output and error codes, and no port is opened. A failure that is no
 * refusal (4xx), such as a procedure the test leaves out, is the backend's
 * bare `500 { code: "INTERNAL" }` (ADR 0031).
 */
export function serveApi(procedures: ApiProcedures): (request: Request) => Promise<Response> {
  const handlers = procedures as Partial<Record<string, Partial<Record<string, AnyHandler>>>>;
  const router = Object.fromEntries(
    Object.entries(apiContract).map(([domain, contracts]) => [
      domain,
      Object.fromEntries(
        Object.entries(contracts as Record<string, AnyContractProcedure>).map(
          ([name, contract]) => [
            name,
            implement<AnyContractProcedure, InProcessContext>(contract).handler(
              handlers[domain]?.[name] ??
                (() => {
                  throw new Error(`The test serves no ${domain}.${name}`);
                }),
            ),
          ],
        ),
      ),
    ]),
  );
  const handler = new OpenAPIHandler<InProcessContext>(router, {
    plugins: [new ResponseHeadersPlugin()],
    interceptors: [
      async (options) => {
        try {
          return await options.next();
        } catch (error) {
          if (error instanceof ORPCError && error.status < 500) throw error;
          return {
            matched: true,
            response: { status: 500, headers: {}, body: { code: 'INTERNAL' } },
          };
        }
      },
    ],
  });
  return async (request) => {
    const { matched, response } = await handler.handle(request, {
      context: { headers: request.headers },
    });
    if (!matched) throw new Error(`No procedure of the API contract at ${request.url}`);
    return response;
  };
}

/** The status an error code has on a procedure, read from the contract's error map. */
const ErrorStatusesSchema = z.record(
  z.string(),
  z.object({ status: z.number().optional() }).optional(),
);

/**
 * The status the contract gives the error code, on whichever procedure lists
 * it: a code keeps one meaning across `/v1` (ADR 0031). A code no procedure
 * gives a status has oRPC's status of the code.
 */
function statusOf(code: ApiErrorCode): number | undefined {
  const routers: unknown[] = Object.values(apiContract);
  for (const router of routers) {
    if (typeof router !== 'object' || router === null) continue;
    const procedures: unknown[] = Object.values(router);
    for (const procedure of procedures) {
      if (!isContractProcedure(procedure)) continue;
      const statuses = ErrorStatusesSchema.safeParse(procedure['~orpc'].errorMap);
      const status = statuses.success ? statuses.data[code]?.status : undefined;
      if (status !== undefined) return status;
    }
  }
  return undefined;
}

/**
 * The error a procedure of a test's backend throws to refuse the request
 * with `code`, whether or not the procedure lists it, with the status the
 * code has; a 429 also sets `Retry-After` to `retryAfter` seconds on the
 * answer, through the request's `context`, as the backend's limits do.
 */
export function refusal(
  code: ApiErrorCode,
  context?: ResponseHeadersPluginContext,
  { retryAfter }: { readonly retryAfter?: number } = {},
): ORPCError<ApiErrorCode, undefined> {
  if (retryAfter !== undefined) context?.resHeaders?.set('retry-after', String(retryAfter));
  const status = statusOf(code);
  return new ORPCError(code, status === undefined ? {} : { status });
}

/**
 * A `fetch` that answers every request with the status and the body, as a
 * proxy in front of the backend does, which is no answer of the contract.
 */
export function answeringWith(
  status: number,
  body: string,
): (request: Request) => Promise<Response> {
  return () => Promise.resolve(new Response(body, { status }));
}

/**
 * A file as a procedure of a test's backend answers one, such as the file of
 * a Language Pack: `File` is a web global that the Core's own lib doesn't name.
 */
export function fileOf(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type });
}

/**
 * Every procedure of the contract, each refusing with the error `code` names,
 * whether or not the procedure lists it, with the status the code has.
 */
export function failingWith(code: ApiErrorCode): ApiProcedures {
  const fail = () => {
    throw refusal(code);
  };
  return Object.fromEntries(
    Object.entries(apiContract).map(([domain, contracts]) => [
      domain,
      Object.fromEntries(Object.keys(contracts).map((name) => [name, fail])),
    ]),
  );
}
