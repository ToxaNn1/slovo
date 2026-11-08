import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import { procedure } from './procedure';

/** An Edition the admin's global Edition filter offers. */
export const AdminEditionSchema = z.object({
  id: EditionIdSchema,
  /** The Edition's `displayName` from its config. */
  displayName: z.string().min(1),
});
export type AdminEdition = z.infer<typeof AdminEditionSchema>;

/** What every admin procedure may refuse with. */
const ADMIN_ERRORS = {
  NOT_FOUND: { message: 'Not found' },
  UNAUTHORIZED: { message: 'The Агент token is unknown or revoked' },
  FORBIDDEN: { message: 'An Агент token writes content only' },
} as const;

/**
 * The admin API (ADR 0088): what `apps/admin` and an Агент know of the
 * backend. Every procedure answers 404 while no Власник exists. An Агент
 * token, sent as `Authorization: Bearer <token>`, is taken by the
 * content-writing procedures only: anywhere else a token answers 403, and
 * one that is unknown or revoked answers 401.
 */
export const adminContract = {
  status: procedure
    .route({
      method: 'GET',
      path: '/admin/status',
      summary: 'Whether the owner admin is on',
      description: 'The admin is on once a Власник exists; until then it answers 404.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(z.object({ on: z.literal(true) })),
  editions: procedure
    .route({
      method: 'GET',
      path: '/admin/editions',
      summary: 'The Editions the backend serves, for the global Edition filter',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(z.object({ editions: z.array(AdminEditionSchema) })),
};
