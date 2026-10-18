import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import { procedure } from './procedure';

/** The ETag of the switches answered, which names them; 304 answers it too. */
const SwitchesCachingSchema = z.object({ etag: z.string() });

/** The Edition procedures. They need no Account. */
export const editionContract = {
  switches: procedure
    .route({
      method: 'GET',
      path: '/editions/{editionId}/switches',
      summary: 'The Feature Switches the owner turned off remotely',
      description:
        "A remote switch only turns a feature off: a feature is on when the Edition's config turns it on and it is not off here (ADR 0040).",
      tags: ['edition'],
      inputStructure: 'detailed',
      outputStructure: 'detailed',
    })
    // An Edition the backend doesn't serve.
    .errors({ NOT_FOUND: { message: 'Not found' } })
    .input(
      z.object({
        params: z.strictObject({ editionId: EditionIdSchema }),
        // No query field: an unknown one is refused (ADR 0031).
        query: z.strictObject({}).optional(),
        headers: z
          .object({
            /** The ETag of the switches the app keeps; 304 when it names these. */
            'if-none-match': z.string().optional(),
          })
          .optional(),
      }),
    )
    .output(
      z.union([
        z.object({
          status: z.literal(200),
          headers: SwitchesCachingSchema,
          body: z.object({
            /**
             * The features turned off remotely, by their Feature Switch's
             * name, in name order. A name is a string, so a new Feature
             * Switch keeps `/v1` as it is; an app skips a name it doesn't know.
             */
            off: z.array(z.string()),
          }),
        }),
        z.object({
          status: z.literal(304).describe('The switches the app keeps are these'),
          headers: SwitchesCachingSchema,
        }),
      ]),
    ),
};
