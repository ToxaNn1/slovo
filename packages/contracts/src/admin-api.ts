import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient, InferContractRouterOutputs } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';

import { apiContract } from './api';
import { EditionIdSchema } from './edition';

export { EditionIdSchema };
export { AdminEditionSchema, type AdminEdition } from './api/admin';

/**
 * The admin API: everything `apps/admin` knows about the backend, called over
 * HTTP on the same origin, under `/v1/admin` (ADR 0088). It is the `admin`
 * router of the API contract.
 */
export const adminApiContract = apiContract.admin;

/** The admin API as `apps/admin` calls it: one function per procedure. */
export type AdminApiClient = JsonifiedClient<ContractRouterClient<typeof adminApiContract>>;

/**
 * The admin's client of the admin API. `url` is the origin the admin is served
 * from: the Deployment, Vite's proxy, or the mock handlers in development.
 */
export function createAdminApiClient(url: string): AdminApiClient {
  // The global `fetch` looked up on every call, not kept: a test or a mock
  // that replaces it after the client is made is still the one called.
  const fetch = (request: Request, init: RequestInit) => globalThis.fetch(request, init);
  return createORPCClient(new OpenAPILink(adminApiContract, { url, fetch }));
}

/** What each admin API procedure answers, by procedure name. */
export type AdminApiOutputs = InferContractRouterOutputs<typeof adminApiContract>;
