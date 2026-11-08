import { createORPCClient } from '@orpc/client';
import { oc, type ContractRouterClient, type InferContractRouterOutputs } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { z } from 'zod';

import { procedure } from './api/procedure';
import { EditionIdSchema } from './edition';

export { EditionIdSchema };

/** An Edition the admin's global Edition filter offers. */
export const AdminEditionSchema = z.object({
  id: EditionIdSchema,
  /** The Edition's `displayName` from its config. */
  displayName: z.string().min(1),
});
export type AdminEdition = z.infer<typeof AdminEditionSchema>;

/**
 * The admin API: everything `apps/admin` knows about the backend, called over
 * HTTP on the same origin, under `/admin/api` (ADR 0088). It is apart from the
 * app's `/v1` and carries no promise to old apps.
 */
export const adminApiContract = oc.prefix('/admin/api').router({
  editions: procedure
    .route({
      method: 'GET',
      path: '/editions',
      summary: 'The Editions the backend serves, for the global Edition filter',
      tags: ['admin'],
    })
    .output(z.object({ editions: z.array(AdminEditionSchema) })),
});

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
