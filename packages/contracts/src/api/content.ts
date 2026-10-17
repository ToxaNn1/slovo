import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import { PublishedPackSchema } from '../language-pack';
import { procedure } from './procedure';

/** The content procedures of an Edition. They need no Account. */
export const contentContract = {
  latest: procedure
    .route({
      method: 'GET',
      path: '/editions/{editionId}/content/latest',
      summary: 'The newest published Language Pack the app can read',
      tags: ['content'],
    })
    // An Edition the backend doesn't serve.
    .errors({ NOT_FOUND: { message: 'Not found' } })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        /** The highest pack format the app reads. */
        packFormat: z.coerce.number<number>().int().positive(),
      }),
    )
    .output(
      z.object({
        /** None when nothing of the pack format is published. */
        pack: PublishedPackSchema.nullable(),
      }),
    ),
};
