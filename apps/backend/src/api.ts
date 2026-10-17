import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { implement, ORPCError } from '@orpc/server';
import { ResponseHeadersPlugin, type ResponseHeadersPluginContext } from '@orpc/server/plugins';
import { apiContract } from '@slovo/contracts/api';
import { apiDescriptionOptions } from '@slovo/contracts/api-description';
import type { Accounts, ContentPacks } from '@slovo/server-core';
import type { Logger } from 'pino';

import { accountProcedures } from './account/account-procedures';
import { contentProcedures } from './content/content-procedures';

/** What every unexpected failure answers, with status 500: nothing internal (spec #333). */
export const INTERNAL_FAILURE = { code: 'INTERNAL' } as const;

/** Logs an unexpected failure with its stack; the logger carries the request id. */
export function logUnexpectedFailure(logger: Logger, error: unknown): void {
  logger.error({ err: error }, 'unexpected failure');
}

/** What a request brings to the API. */
interface ApiContext extends ResponseHeadersPluginContext {
  /** The request's logger, which carries its request id. */
  logger: Logger;
  /** The request's headers, where a Session travels. */
  headers: Headers;
  /** The IP address the request came from; none when it came on no connection. */
  ip: string | undefined;
}

/**
 * The API contract served over HTTP: each procedure at its REST address
 * under `/v1`, and the OpenAPI description at `/docs` (`/docs/openapi.json`
 * for the document itself, the one `describeApi` gives and the repo
 * commits). A procedure answers the error codes the contract lists; anything
 * else is a bare `500 { code: "INTERNAL" }`.
 */
export function createApiHandler({
  accounts,
  contentPacks,
}: {
  accounts: Accounts;
  contentPacks: ContentPacks;
}) {
  const router = implement(apiContract)
    .$context<ApiContext>()
    .router({
      account: accountProcedures(accounts),
      content: contentProcedures(contentPacks),
    });
  return new OpenAPIHandler(router, {
    interceptors: [
      async (options) => {
        try {
          return await options.next();
        } catch (error) {
          // A refused request (4xx) is an answer the contract lists.
          if (error instanceof ORPCError && error.status < 500) throw error;
          logUnexpectedFailure(options.context.logger, error);
          return {
            matched: true,
            response: { status: 500, headers: {}, body: INTERNAL_FAILURE },
          };
        }
      },
    ],
    plugins: [
      new ResponseHeadersPlugin(),
      new OpenAPIReferencePlugin({
        docsPath: '/docs',
        specPath: '/docs/openapi.json',
        docsTitle: apiDescriptionOptions.specGenerateOptions.info.title,
        ...apiDescriptionOptions,
      }),
    ],
  });
}
