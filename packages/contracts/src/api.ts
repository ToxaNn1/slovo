import { createORPCClient, type ClientContext } from '@orpc/client';
import { oc, type ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink, type OpenAPILinkOptions } from '@orpc/openapi-client/fetch';

import { contentContract } from './api/content';

/**
 * The API contract: the only description of the backend's API (spec #333).
 * The backend implements it and the app calls it through `createApiClient`,
 * so a mismatch fails typecheck. One router per domain. Within `/v1` it only
 * grows (ADR 0031).
 */
export const apiContract = oc.prefix('/v1').router({
  content: contentContract,
});

/** The API as the app calls it: one function per procedure. */
export type ApiClient = JsonifiedClient<ContractRouterClient<typeof apiContract>>;

/**
 * A client of the API built from the contract. `url` is the backend's origin,
 * such as `http://localhost:8787`; `fetch` replaces the global one, as a test
 * does to reach the backend in process.
 */
export function createApiClient(options: OpenAPILinkOptions<ClientContext>): ApiClient {
  return createORPCClient(new OpenAPILink(apiContract, options));
}
