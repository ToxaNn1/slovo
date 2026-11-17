import { createApiClient, ORPCError, type ApiClient } from '@slovo/contracts/api';
import { serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';

// A helper for the tests: no command imports it.

/** The procedures of the admin's content API a test serves, by name. */
type ContentProcedure = 'openBatch' | 'create' | 'edit' | 'retire' | 'flag' | 'record' | 'report';

/** A procedure's handler: its input, the path's parameters with the body's fields; its output, or a thrown ORPCError. */
type Handler = (input: Record<string, unknown>) => unknown;

const ROUTES: readonly (readonly [string, RegExp, ContentProcedure, readonly string[]])[] = [
  ['POST', /^\/v1\/admin\/content\/([^/]+)\/batches$/, 'openBatch', ['editionId']],
  ['POST', /^\/v1\/admin\/content\/([^/]+)\/records\/([^/]+)$/, 'create', ['editionId', 'kind']],
  [
    'PUT',
    /^\/v1\/admin\/content\/([^/]+)\/records\/([^/]+)\/([^/]+)$/,
    'edit',
    ['editionId', 'kind', 'id'],
  ],
  [
    'GET',
    /^\/v1\/admin\/content\/([^/]+)\/records\/([^/]+)\/([^/]+)$/,
    'record',
    ['editionId', 'kind', 'id'],
  ],
  [
    'POST',
    /^\/v1\/admin\/content\/([^/]+)\/records\/([^/]+)\/([^/]+)\/retire$/,
    'retire',
    ['editionId', 'kind', 'id'],
  ],
  [
    'POST',
    /^\/v1\/admin\/content\/([^/]+)\/records\/([^/]+)\/([^/]+)\/flag$/,
    'flag',
    ['editionId', 'kind', 'id'],
  ],
  ['GET', /^\/v1\/admin\/content\/([^/]+)\/report$/, 'report', ['editionId']],
];

/** One call the backend got: the procedure and its input. */
export interface Call {
  readonly procedure: string;
  readonly input: Record<string, unknown>;
}

/**
 * A client of a backend in process: the admin's content procedures `content`
 * names, answered over the contract's addresses, and the rest of the API as
 * `procedures` serve it (`serveApi`). Every call is kept in `calls`; a
 * procedure the test leaves out answers 500.
 */
export function backend(
  content: Partial<Record<ContentProcedure, Handler>>,
  procedures: ApiProcedures = {},
): { api: ApiClient; calls: Call[] } {
  const calls: Call[] = [];
  const rest = serveApi(procedures);
  const api = createApiClient({
    url: 'http://backend.test',
    fetch: async (request) => {
      const path = decodeURIComponent(new URL(request.url).pathname);
      for (const [method, pattern, procedure, names] of ROUTES) {
        const match = request.method === method ? pattern.exec(path) : null;
        if (match === null) continue;
        const text = await request.text();
        const body: unknown = text === '' ? {} : JSON.parse(text);
        const input: Record<string, unknown> = {
          ...(typeof body === 'object' && body !== null ? body : {}),
          ...Object.fromEntries(names.map((name, index) => [name, match[index + 1]])),
        };
        calls.push({ procedure, input });
        return answer(content[procedure], input);
      }
      calls.push({ procedure: path, input: {} });
      return rest(request);
    },
  });
  return { api, calls };
}

function answer(handler: Handler | undefined, input: Record<string, unknown>): Response {
  try {
    if (handler === undefined) throw new Error('The test serves no such procedure');
    return Response.json(handler(input));
  } catch (error) {
    if (error instanceof ORPCError) return Response.json(error.toJSON(), { status: error.status });
    return Response.json({ code: 'INTERNAL' }, { status: 500 });
  }
}

/** A refusal of the backend, as a handler throws it. */
export function refused(code: string, status: number, data?: unknown): ORPCError<string, unknown> {
  return new ORPCError(code, { status, data, defined: true });
}

/** The lines a command prints and the problems it reports. */
export function fakeIo(): {
  io: { print(line: string): void; problem(line: string): void };
  printed: string[];
  problems: string[];
} {
  const printed: string[] = [];
  const problems: string[] = [];
  return {
    io: { print: (line) => printed.push(line), problem: (line) => problems.push(line) },
    printed,
    problems,
  };
}

/** A batch id as the backend issues them. */
export const BATCH = '0b0a7c1e-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
