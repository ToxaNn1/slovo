import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import { procedure } from './procedure';

/**
 * The ETag of the switches answered, which names them, and the backend's
 * clock, which the app keeps with the Rules so a schedule holds by the
 * backend's clock (ADR 0089); 304 answers both too.
 */
const SwitchesCachingSchema = z.object({ etag: z.string(), date: z.string() });

/**
 * A Rule as `/v1` answers it, read leniently: the verdict and the targets stay
 * unparsed, so a new verdict or target keeps `/v1` as it is and an app skips
 * the Rule alone (ADR 0089). The Rules come in their order.
 */
const RemoteRuleSchema = z.object({
  id: z.string(),
  feature: z.string(),
  verdict: z.unknown(),
  targets: z.record(z.string(), z.unknown()),
});

/** Force-update minimums as `/v1` answers them; a new platform keeps `/v1` as it is. */
const RemoteMinimumSchema = z.object({ soft: z.string().optional(), hard: z.string().optional() });

/** The Edition procedures. They need no Account. */
export const editionContract = {
  switches: procedure
    .route({
      method: 'GET',
      path: '/editions/{editionId}/switches',
      summary: 'The remote Feature Switch Rules and force-update minimums of the Edition',
      description:
        "The first Rule of a feature that matches the device decides its value, the Edition's state when none does; an unavailable feature is never on (ADR 0089).",
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
             * The Rules of the Edition, by feature name and then order. A
             * feature is a string, so a new Feature Switch keeps `/v1` as it
             * is; an app skips a Rule of a feature it doesn't know.
             */
            rules: z.array(RemoteRuleSchema),
            /** The force-update minimums of the Edition, by platform. */
            minimums: z.object({
              ios: RemoteMinimumSchema.optional(),
              android: RemoteMinimumSchema.optional(),
            }),
          }),
        }),
        z.object({
          status: z.literal(304).describe('The switches the app keeps are these'),
          headers: SwitchesCachingSchema,
        }),
      ]),
    ),
};
