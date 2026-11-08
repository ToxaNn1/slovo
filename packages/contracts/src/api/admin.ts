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

/** An Edition the admin's global Edition filter offers. */
export const AdminEditionSchema = z.object({
  id: EditionIdSchema,
  /** The Edition's `displayName` from its config. */
  displayName: z.string().min(1),
});
export type AdminEdition = z.infer<typeof AdminEditionSchema>;

/**
 * The custom header every admin write carries (a CSRF guard, ADR 0088): a
 * page of another site cannot set it on a request that sends the cookie.
 */
export const ADMIN_WRITE_HEADER = 'x-slovo-admin';

/** The cookie of an admin session: `HttpOnly`, `Secure`, `SameSite=Strict`, under the admin API's path. */
export const ADMIN_SESSION_COOKIE = 'slovo_admin_session';

/** What every admin procedure may refuse with. */
const ADMIN_ERRORS = {
  NOT_FOUND: { message: 'Not found' },
  UNAUTHORIZED: { message: 'No admin session, or the Агент token is unknown or revoked' },
  FORBIDDEN: {
    message:
      'Refused for this caller: an Агент writes content only, an Адмін has no Безпека, a write needs the admin header',
  },
} as const;

/** A role of an Admin user: Власник (`owner`) or Адмін (`admin`). */
const AdminRoleSchema = z.enum(['owner', 'admin']);

/** The signed-in Admin user. */
const SignedInAdminSchema = z.object({ email: z.string(), role: AdminRoleSchema });

/** What a sign-in step may refuse with: a wrong code with the attempts left, or the email blocked. */
const SIGN_IN_ERRORS = {
  NOT_FOUND: ADMIN_ERRORS.NOT_FOUND,
  FORBIDDEN: ADMIN_ERRORS.FORBIDDEN,
  UNAUTHORIZED: {
    message: 'The code is wrong or has expired',
    data: z.object({ attemptsLeft: z.number().int().min(0) }),
  },
  TOO_MANY_REQUESTS: {
    message: 'Too many failed attempts: the email is blocked for a while',
    data: z.object({ retryAfterSeconds: z.number().int().positive() }),
  },
} as const;

const EmailSchema = z.string().trim().min(3).max(320);
const CodeSchema = z.string().trim().min(1).max(20);

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
 * backend. Every procedure answers 404 while no Власник exists. A caller
 * signs in with an emailed code and a TOTP, and is then known by the admin
 * session cookie; every write carries the `x-slovo-admin` header. An Агент
 * token, sent as `Authorization: Bearer <token>`, is taken by the
 * content-writing procedures only: anywhere else a token answers 403, and
 * one that is unknown or revoked answers 401, as any other Bearer does.
 */
export const adminContract = {
  requestCode: procedure
    .route({
      method: 'POST',
      path: '/admin/sign-in/code',
      summary: 'Emails a sign-in code to an Admin user',
      description:
        'The code lives 10 minutes. The answer is the same whether the email has an Admin user or not.',
      tags: ['admin'],
    })
    .errors({ NOT_FOUND: ADMIN_ERRORS.NOT_FOUND, FORBIDDEN: ADMIN_ERRORS.FORBIDDEN })
    .input(z.object({ email: EmailSchema }))
    .output(z.object({ sent: z.literal(true) })),

  verifyCode: procedure
    .route({
      method: 'POST',
      path: '/admin/sign-in/code/verify',
      summary: 'Checks the emailed code and answers the next step',
      description:
        'The next step is the TOTP, or its set-up: the secret, its otpauth URL and ten recovery codes, shown this once. Three failed attempts on a code or a TOTP block the email for 15 minutes.',
      tags: ['admin'],
    })
    .errors(SIGN_IN_ERRORS)
    .input(z.object({ email: EmailSchema, code: CodeSchema }))
    .output(
      z.discriminatedUnion('next', [
        z.object({ next: z.literal('totp') }),
        z.object({
          next: z.literal('enrol'),
          secret: z.string(),
          otpauthUrl: z.string(),
          recoveryCodes: z.array(z.string()),
        }),
      ]),
    ),

  signIn: procedure
    .route({
      method: 'POST',
      path: '/admin/sign-in',
      summary: 'Signs in with the emailed code and a TOTP or a recovery code',
      description:
        'Sets the admin session cookie. A recovery code signs in once, in place of the TOTP.',
      tags: ['admin'],
    })
    .errors(SIGN_IN_ERRORS)
    .input(
      z.object({
        email: EmailSchema,
        code: CodeSchema,
        factor: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('totp'), totp: CodeSchema }),
          z.object({ kind: z.literal('recovery'), recoveryCode: CodeSchema }),
        ]),
      }),
    )
    .output(SignedInAdminSchema),

  me: procedure
    .route({
      method: 'GET',
      path: '/admin/me',
      summary: 'The signed-in Admin user',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(SignedInAdminSchema),

  sessions: procedure
    .route({
      method: 'GET',
      path: '/admin/sessions',
      summary: '«Мої сесії»: the sessions of the signed-in Admin user',
      description: 'A session ends after 8 idle hours, and 30 days after it began.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(
      z.object({
        sessions: z.array(
          z.object({ createdAt: z.string(), lastSeenAt: z.string(), current: z.boolean() }),
        ),
      }),
    ),

  signOut: procedure
    .route({
      method: 'POST',
      path: '/admin/sign-out',
      summary: 'Ends this session',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(z.object({ signedOut: z.literal(true) })),

  signOutEverywhere: procedure
    .route({
      method: 'POST',
      path: '/admin/sessions/sign-out',
      summary: '«Вийти всюди»: ends every session of the signed-in Admin user',
      description: "Another Admin user's sessions go on.",
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(z.object({ signedOut: z.literal(true) })),

  actions: procedure
    .route({
      method: 'GET',
      path: '/admin/actions',
      summary: 'The Action log, oldest first, of one Edition when one is named',
      description: 'A Безпека procedure: a Власник only.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ editionId: EditionIdSchema.optional() }))
    .output(
      z.object({
        actions: z.array(
          z.object({
            at: z.string(),
            who: z.discriminatedUnion('kind', [
              z.object({ kind: z.literal('admin-user'), email: z.string() }),
              z.object({ kind: z.literal('agent'), name: z.string() }),
              z.object({ kind: z.literal('command'), command: z.string() }),
            ]),
            what: z.string(),
            reason: z.string().nullable(),
            editionId: z.string().nullable(),
          }),
        ),
      }),
    ),

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
