import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { implement, ORPCError } from '@orpc/server';
import { ResponseHeadersPlugin, type ResponseHeadersPluginContext } from '@orpc/server/plugins';
import { apiContract } from '@slovo/contracts/api';
import { apiDescriptionOptions } from '@slovo/contracts/api-description';
import type {
  Accounts,
  CommunityCounters,
  ContentPacks,
  EditionRegistry,
  MistakeReports,
  Sync,
} from '@slovo/server-core';
import type { Logger } from 'pino';

import { accountProcedures } from './account/account-procedures';
import { collectionLinksProcedures } from './collection-links/collection-links-procedures';
import { contentProcedures } from './content/content-procedures';
import { countersProcedures } from './counters/counters-procedures';
import { reportOf, type ErrorReporter } from './error-reporter';
import { editionProcedures } from './edition/edition-procedures';
import { reportsProcedures } from './reports/reports-procedures';
import { syncProcedures } from './sync/sync-procedures';

/** What every unexpected failure answers, with status 500: nothing internal (spec #333). */
export const INTERNAL_FAILURE = { code: 'INTERNAL' } as const;

/** What a request knows to tell of an unexpected failure. */
interface FailureContext {
  /** The request's logger, which carries its request id. */
  logger: Logger;
  requestId: string;
  reporter: ErrorReporter;
}

/**
 * Logs an unexpected failure with its stack, and reports it with no personal
 * data (spec #603); a refused request (4xx) is neither.
 */
export function onUnexpectedFailure(
  { logger, requestId, reporter }: FailureContext,
  error: unknown,
): void {
  logger.error({ err: error }, 'unexpected failure');
  reporter.report(reportOf(error, requestId));
}

/** What a request brings to the API. */
interface ApiContext extends ResponseHeadersPluginContext, FailureContext {
  /** The request's headers, where a Session travels. */
  headers: Headers;
  /** The IP address of the request's connection. */
  ip: string;
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
  communityCounters,
  contentPacks,
  editions,
  mistakeReports,
  sync,
}: {
  accounts: Accounts;
  communityCounters: CommunityCounters;
  contentPacks: ContentPacks;
  editions: EditionRegistry;
  mistakeReports: MistakeReports;
  sync: Sync;
}) {
  const router = implement(apiContract)
    .$context<ApiContext>()
    .router({
      account: accountProcedures(accounts),
      collectionLinks: collectionLinksProcedures(),
      content: contentProcedures(contentPacks),
      counters: countersProcedures(communityCounters),
      edition: editionProcedures(editions),
      reports: reportsProcedures(mistakeReports),
      sync: syncProcedures(sync, accounts),
    });
  return new OpenAPIHandler(router, {
    interceptors: [
      async (options) => {
        try {
          return await options.next();
        } catch (error) {
          // A refused request (4xx) is an answer the contract lists.
          if (error instanceof ORPCError && error.status < 500) throw error;
          onUnexpectedFailure(options.context, error);
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
