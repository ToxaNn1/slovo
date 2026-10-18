import { createORPCClient, type ClientContext } from '@orpc/client';
import { oc, type ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink, type OpenAPILinkOptions } from '@orpc/openapi-client/fetch';

import { accountContract } from './api/account';
import { contentContract } from './api/content';
import { editionContract } from './api/edition';
import { syncContract } from './api/sync';

export { PACK_MEDIA_TYPE } from './api/content';

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
 * The API contract: the only description of the backend's API (spec #333).
 * The backend implements it and the app calls it through `createApiClient`,
 * so a mismatch fails typecheck. One router per domain. Within `/v1` it only
 * grows (ADR 0031).
 */
export const apiContract = oc.prefix('/v1').router({
  account: accountContract,
  content: contentContract,
  edition: editionContract,
  sync: syncContract,
});

/** The API as the app calls it: one function per procedure. */
export type ApiClient = JsonifiedClient<ContractRouterClient<typeof apiContract>>;

/**
 * A client of the API built from the contract. `url` is the backend's origin,
 * such as `http://localhost:8787`; `fetch` replaces the global one, as a test
 * does to reach the backend in process. A client that acts on an Account
 * sends its Session in `headers`, as `authorization: Bearer <token>`.
 */
export function createApiClient(options: OpenAPILinkOptions<ClientContext>): ApiClient {
  return createORPCClient(new OpenAPILink(apiContract, options));
}
