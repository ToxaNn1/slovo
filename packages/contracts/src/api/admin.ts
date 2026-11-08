import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import {
  ForceUpdateMinimumSchema,
  ForceUpdateMinimumsSchema,
  PlatformSchema,
  RuleSchema,
  RuleTargetsSchema,
  RuleVerdictSchema,
} from '../feature-switch-rules';
import { procedure } from './procedure';

/** The refusals every admin procedure lists. */
const ADMIN_ERRORS = {
  NOT_FOUND: { message: 'Not found' },
  UNAUTHORIZED: { message: 'The Агент token is unknown or revoked' },
  FORBIDDEN: { message: 'An Агент token writes content only' },
} as const;

/** Why the backend refuses a write of the switches, with the name it refuses. */
export const SwitchRefusalSchema = z.object({
  refusal: z.enum(['unknown-edition', 'unknown-feature', 'unavailable-feature', 'dependency-off']),
  /** The feature refused: the one written, or the switch it depends on that is off for everyone. */
  feature: z.string(),
});

/** The errors of a write of the switches. */
const SWITCH_WRITE_ERRORS = {
  ...ADMIN_ERRORS,
  BAD_REQUEST: { message: 'The switch is refused', data: SwitchRefusalSchema },
} as const;

/** Every admin write names why: the Action log keeps it (ADR 0088). */
const ReasonSchema = z.string().trim().min(1).max(500);

/** The Rules and the force-update minimums of an Edition. */
const SwitchesOfEditionSchema = z.object({
  rules: z.array(RuleSchema),
  minimums: ForceUpdateMinimumsSchema,
});

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

  switches: procedure
    .route({
      method: 'GET',
      path: '/admin/editions/{editionId}/switches',
      summary: 'The Rules and force-update minimums of an Edition',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ editionId: EditionIdSchema }))
    .output(SwitchesOfEditionSchema),

  setRules: procedure
    .route({
      method: 'PUT',
      path: '/admin/editions/{editionId}/switches/{feature}/rules',
      summary: 'Sets the Rules of one feature of an Edition',
      description:
        "The Rules given replace the feature's, tried in the order given. A Rule for an unavailable feature, or for a feature that depends on a switch off for everyone, is refused by name.",
      tags: ['admin'],
    })
    .errors(SWITCH_WRITE_ERRORS)
    .input(
      z.object({
        editionId: EditionIdSchema,
        feature: z.string().min(1),
        rules: z.array(
          z.strictObject({
            /** The Rule's id, which salts the Rollout: kept, it keeps each reader's share. */
            id: z.string().min(1).max(80),
            verdict: RuleVerdictSchema,
            targets: RuleTargetsSchema,
          }),
        ),
        reason: ReasonSchema,
      }),
    )
    .output(SwitchesOfEditionSchema),

  setMinimum: procedure
    .route({
      method: 'PUT',
      path: '/admin/editions/{editionId}/minimums/{platform}',
      summary: 'Sets the force-update minimums of one platform of an Edition',
      tags: ['admin'],
    })
    .errors(SWITCH_WRITE_ERRORS)
    .input(
      z.object({
        editionId: EditionIdSchema,
        platform: PlatformSchema,
        minimum: ForceUpdateMinimumSchema,
        reason: ReasonSchema,
      }),
    )
    .output(SwitchesOfEditionSchema),

  kill: procedure
    .route({
      method: 'POST',
      path: '/admin/switches/{feature}/kill',
      summary: 'The Kill switch: one feature off for every reader',
      description:
        'Turns the feature off over every Rule in one Edition, or in every Edition the backend serves when none is named.',
      tags: ['admin'],
    })
    .errors(SWITCH_WRITE_ERRORS)
    .input(
      z.object({
        feature: z.string().min(1),
        editionId: EditionIdSchema.optional(),
        reason: ReasonSchema,
      }),
    )
    .output(z.object({ editionIds: z.array(EditionIdSchema) })),
};
