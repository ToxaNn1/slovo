import { z } from 'zod';

import { ContentTargetsSchema } from '../content-targets';
import { CorrectionTypeSchema } from '../correction';
import { CategorySchema, EditionIdSchema, FeatureSwitchesSchema, LevelsSchema } from '../edition';
import {
  ForceUpdateMinimumSchema,
  ForceUpdateMinimumsSchema,
  PlatformSchema,
  RuleSchema,
  RuleTargetsSchema,
  RuleVerdictSchema,
} from '../feature-switch-rules';
import { IdiomTypeSchema } from '../idiom';
import { MistakeTypeSchema } from '../mistake-report';
import { procedure } from './procedure';

/** An Edition the admin's global Edition filter offers. */
export const AdminEditionSchema = z.object({
  id: EditionIdSchema,
  /** The Edition's `displayName` from its config. */
  displayName: z.string().min(1),
});
export type AdminEdition = z.infer<typeof AdminEditionSchema>;

/** The periods of the admin's global period filter, shortest first. */
export const ADMIN_PERIODS = ['1d', '7d', '30d', '90d'] as const;
export const AdminPeriodSchema = z.enum(ADMIN_PERIODS);
export type AdminPeriod = z.infer<typeof AdminPeriodSchema>;

/** How many days each period covers. */
export const PERIOD_DAYS: Readonly<Record<AdminPeriod, number>> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** One Sentry number of Якість, or none while Sentry can't be read. */
const QualityKpiSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('ok'),
    /** `null` while Sentry keeps no data for it. */
    value: z.number().nullable(),
    /** The same number a day earlier. */
    yesterday: z.number().nullable(),
    /** When the backend read it of Sentry: its freshness. */
    fetchedAt: z.iso.datetime(),
  }),
  z.object({ state: z.literal('unavailable') }),
]);
export type QualityKpi = z.infer<typeof QualityKpiSchema>;

/** One CI run on `main`, as CI pushes it. */
export const CiRunSchema = z.object({
  runId: z.number().int().positive(),
  at: z.iso.datetime(),
  sha: z.string().regex(/^[0-9a-f]{7,40}$/),
  tests: z.number().int().nonnegative(),
  failedTests: z.array(z.string().min(1).max(500)).max(1000),
  coverage: z
    .array(
      z.object({
        package: z.string().min(1).max(100),
        lines: z.number().min(0).max(100),
        branches: z.number().min(0).max(100),
      }),
    )
    .max(100),
  jobs: z
    .array(z.object({ name: z.string().min(1).max(200), seconds: z.number().nonnegative() }))
    .max(100),
});
export type CiRunInput = z.infer<typeof CiRunSchema>;

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

/** What an Аналітика read from PostHog may refuse with: the errors of every admin procedure, and PostHog down. */
const ANALYTICS_ERRORS = {
  ...ADMIN_ERRORS,
  ANALYTICS_UNAVAILABLE: { status: 503, message: 'PostHog недоступний' },
} as const;

/** The Edition id an Аналітика read takes for every Edition the backend serves, summed. */
export const ALL_EDITIONS = 'all';

/** The Edition an Аналітика read is of, or `all`. */
const AnalyticsEditionSchema = EditionIdSchema;

/** A day as `YYYY-MM-DD`. */
const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** A count of one key (a day, a device, a version, a Variant): never a person or an id (ADR 0060). */
export const AnalyticsCountSchema = z
  .object({ key: z.string(), count: z.number().int().min(0) })
  .strict();
export type AnalyticsCount = z.infer<typeof AnalyticsCountSchema>;

/** When the oldest part of a PostHog read was read, as an ISO time. */
const FetchedAtSchema = z.iso.datetime();

/** The Аналітика of an Edition over a period, from PostHog: aggregates only. */
export const AnalyticsOverviewSchema = z
  .object({
    activeByDay: z.array(AnalyticsCountSchema),
    visitsByDay: z.array(AnalyticsCountSchema),
    medianVisitSeconds: z.number().int().min(0),
    devices: z.array(AnalyticsCountSchema),
    appVersions: z.array(AnalyticsCountSchema),
    fetchedAt: FetchedAtSchema,
  })
  .strict();
export type AnalyticsOverview = z.infer<typeof AnalyticsOverviewSchema>;

/** People active in each Variant of an A/B Feature Switch. */
export const VariantResultsSchema = z
  .object({ variants: z.array(AnalyticsCountSchema), fetchedAt: FetchedAtSchema })
  .strict();
export type VariantResults = z.infer<typeof VariantResultsSchema>;

/** The Community Counters sums and the questionnaire counters of an Edition. */
export const CountersSummarySchema = z
  .object({
    known: z.number().int().min(0),
    unknown: z.number().int().min(0),
    saved: z.number().int().min(0),
    answers: z.array(
      z
        .object({ question: z.string(), answer: z.string(), count: z.number().int().min(0) })
        .strict(),
    ),
  })
  .strict();
export type CountersSummary = z.infer<typeof CountersSummarySchema>;

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

/** Why the backend refuses a write of people or Агент tokens, by name. */
export const AccessRefusalSchema = z.object({
  refusal: z.enum(['taken', 'self', 'unknown', 'name-taken']),
});

/** The errors of a Безпека write: a refusal by name answers 409. */
const ACCESS_WRITE_ERRORS = {
  ...ADMIN_ERRORS,
  CONFLICT: { message: 'The write is refused', data: AccessRefusalSchema },
} as const;

/** An Агент's name: lower-case letters, digits and hyphens. */
const AgentNameSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{1,40}$/);

/** What an Edition declares of each feature, its Rules and its force-update minimums. */
const SwitchesOfEditionSchema = z.object({
  states: FeatureSwitchesSchema,
  rules: z.array(RuleSchema),
  minimums: ForceUpdateMinimumsSchema,
});

/** The kinds of record the content write API writes. */
export const ContentRecordKindSchema = z.enum([
  'word',
  'correction',
  'idiom',
  'synonymRow',
  'tip',
  'curatedCollection',
  'crosswordDay',
]);

/** What every content procedure can be refused with. */
const contentProcedure = procedure.errors({
  /** No Власник yet, an Edition the backend doesn't serve, or an unknown batch or record. */
  NOT_FOUND: { message: 'Not found' },
  /** No Агент token, an unknown or revoked one, or the app's Session. */
  UNAUTHORIZED: { message: 'Content is written by an Агент token or an admin session' },
  /** An admin session's write without the admin header. */
  FORBIDDEN: { message: 'An admin session writes content with the admin header' },
  NOT_IMPORTED: { status: 409, message: "The Edition's content is not imported" },
});

/** What a write is refused with besides the common refusals. */
const writeErrors = {
  /** The save breaks the content rules: each refusal names its rule. */
  REFUSED: {
    status: 422,
    message: 'The record breaks a content rule',
    data: z.object({
      refusals: z.array(
        z.object({
          rule: z.string(),
          entryId: z.string().optional(),
          field: z.string().optional(),
          message: z.string(),
        }),
      ),
    }),
  },
  /** The record changed after the version the write saw. */
  STALE: {
    status: 409,
    message: 'The record changed since the version the write saw',
    data: z.object({ currentVersion: z.number().int().positive() }),
  },
} as const;

const recordPath = '/admin/content/{editionId}/records/{kind}';

/** A record as the content editor lists it. */
export const ContentRecordSummarySchema = z.object({
  id: z.string(),
  /** The lemma, expression, form, title, name or date the record is known by. */
  label: z.string(),
  retired: z.boolean(),
  recordVersion: z.number().int().positive(),
});
export type ContentRecordSummary = z.infer<typeof ContentRecordSummarySchema>;

/** The Edition card: what the Edition registry holds of an Edition, shown read-only (story 44). */
export const EditionCardSchema = z.object({
  id: EditionIdSchema,
  displayName: z.string().min(1),
  locale: z.string(),
  categories: z.array(CategorySchema),
  correctionCategories: z.array(CategorySchema),
  levels: LevelsSchema,
});
export type EditionCard = z.infer<typeof EditionCardSchema>;

/** What a write answers: the record's new version and the Edition's content version it published. */
const WrittenSchema = z.object({
  id: z.string(),
  recordVersion: z.number().int().positive(),
  contentVersion: z.number().int().positive(),
  batchId: z.string(),
  /** Words only: whether the Word's Recordings no longer read its text (ADR 0083). */
  needsNewRecording: z.boolean().optional(),
});

/** Every batch's writes name it: one CLI run, or one admin save. */
const BatchIdSchema = z.uuid();

/** The content report: counts of the live records per kind and Category. */
const ContentReportSchema = z.object({
  words: z.number().int(),
  retiredWords: z.number().int(),
  wordsPerCategory: z.array(
    z.object({ categoryId: z.string(), displayName: z.string(), words: z.number().int() }),
  ),
  rarity: z.array(z.object({ rarity: z.number().int(), words: z.number().int() })),
  coverage: z.object({
    examples: z.number().int(),
    synonyms: z.number().int(),
    etymology: z.number().int(),
    stress: z.number().int(),
    region: z.number().int(),
  }),
  corrections: z.number().int(),
  retiredCorrections: z.number().int(),
  correctionsPerType: z.array(
    z.object({ correctionType: CorrectionTypeSchema, corrections: z.number().int() }),
  ),
  correctionsPerCategory: z.array(
    z.object({ categoryId: z.string(), displayName: z.string(), corrections: z.number().int() }),
  ),
  idioms: z.number().int(),
  retiredIdioms: z.number().int(),
  idiomsPerType: z.array(z.object({ idiomType: IdiomTypeSchema, idioms: z.number().int() })),
});

/**
 * The content write API (ADR 0090): every write is checked by the shared
 * content rules and published at once as a new content version.
 */
const contentWriteContract = {
  openBatch: contentProcedure
    .route({
      method: 'POST',
      path: '/admin/content/{editionId}/batches',
      summary: 'Open a batch of content writes',
      description: 'A new batch is «не перевірено» until the Content queue reviews it.',
      tags: ['admin'],
    })
    .input(z.strictObject({ editionId: EditionIdSchema }))
    .output(z.object({ batchId: BatchIdSchema })),
  create: contentProcedure
    .route({
      method: 'POST',
      path: recordPath,
      summary: 'Create a record; the backend issues its id',
      tags: ['admin'],
    })
    .errors(writeErrors)
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        batchId: BatchIdSchema,
        /** The record's fields without its id. */
        fields: z.record(z.string(), z.unknown()),
        reason: z.string().min(1).optional(),
      }),
    )
    .output(WrittenSchema),
  edit: contentProcedure
    .route({
      method: 'PUT',
      path: `${recordPath}/{id}`,
      summary: "Replace a record's fields",
      tags: ['admin'],
    })
    .errors(writeErrors)
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        id: z.string(),
        batchId: BatchIdSchema,
        /** The record version the edit was made from. */
        recordVersion: z.number().int().positive(),
        fields: z.record(z.string(), z.unknown()),
        reason: z.string().min(1).optional(),
      }),
    )
    .output(WrittenSchema),
  retire: contentProcedure
    .route({
      method: 'POST',
      path: `${recordPath}/{id}/retire`,
      summary: 'Retire a record: it stays, marked retired',
      tags: ['admin'],
    })
    .errors(writeErrors)
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        id: z.string(),
        batchId: BatchIdSchema,
        recordVersion: z.number().int().positive(),
        reason: z.string().min(1).optional(),
      }),
    )
    .output(WrittenSchema),
  flag: contentProcedure
    .route({
      method: 'POST',
      path: `${recordPath}/{id}/flag`,
      summary: 'Flag a record for the Content queue',
      description: 'A flag changes no content: it is an Action log row the Content queue lists.',
      tags: ['admin'],
    })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        id: z.string(),
        batchId: BatchIdSchema,
        reason: z.string().min(1),
      }),
    )
    .output(z.object({ id: z.string(), batchId: z.string() })),
  record: contentProcedure
    .route({
      method: 'GET',
      path: `${recordPath}/{id}`,
      summary: "A record's fields and its record version, which an edit is made from",
      tags: ['admin'],
    })
    .input(
      z.strictObject({ editionId: EditionIdSchema, kind: ContentRecordKindSchema, id: z.string() }),
    )
    .output(
      z.object({
        fields: z.record(z.string(), z.unknown()),
        recordVersion: z.number().int().positive(),
        retired: z.boolean(),
        /** Words only: whether the Word's Recordings no longer read its text (ADR 0083). */
        needsNewRecording: z.boolean().optional(),
      }),
    ),
  records: contentProcedure
    .route({
      method: 'GET',
      path: recordPath,
      summary:
        'The records of a kind, for the content editor: by a text query, retired ones on request',
      tags: ['admin'],
    })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        query: z.string().max(200).optional(),
        retired: z.stringbool().optional(),
      }),
    )
    .output(z.object({ records: z.array(ContentRecordSummarySchema) })),
  report: contentProcedure
    .route({
      method: 'GET',
      path: '/admin/content/{editionId}/report',
      summary: "Counts of the content against the Edition's content targets",
      tags: ['admin'],
    })
    .input(z.strictObject({ editionId: EditionIdSchema }))
    .output(
      z.object({
        contentVersion: z.number().int().positive(),
        report: ContentReportSchema,
        targets: ContentTargetsSchema,
        /** Each target the content falls short of. */
        missed: z.array(z.object({ target: z.string(), message: z.string() })),
        /**
         * The quote check (ADR 0084): records changed since their last check, and
         * records whose quote was not found on their source page.
         */
        quoteCheck: z.object({
          unverified: z.number().int().nonnegative(),
          failed: z.number().int().nonnegative(),
        }),
      }),
    ),
};

/** A batch of the Content queue's procedures is named by its id. */
const QueueBatchSchema = z.object({
  id: z.string(),
  editionId: EditionIdSchema,
  /** The Агент token's name the batch came from. */
  author: z.string(),
  createdAt: z.string(),
  /** Records the batch created. */
  added: z.number().int().nonnegative(),
  /** Records the batch edited or retired. */
  changed: z.number().int().nonnegative(),
});

/** An open flag: an Агент's or the quote check's note on a record. */
const QueueFlagSchema = z.object({
  /** The flag's Action log row. */
  id: z.number().int().positive(),
  editionId: EditionIdSchema,
  kind: ContentRecordKindSchema,
  recordId: z.string(),
  /** The Агент's name, or `quote-check`. */
  author: z.string(),
  explanation: z.string(),
  at: z.string(),
});

/** A Mistake Report still to check (ADR 0056). */
const QueueReportSchema = z.object({
  id: z.string(),
  editionId: EditionIdSchema,
  entryId: z.string(),
  type: MistakeTypeSchema,
  comment: z.string(),
  appVersion: z.string(),
  contentVersion: z.number().int(),
  receivedAt: z.string(),
});

const queuePath = '/admin/content-queue';

/**
 * The Content queue (ADR 0090): the Агент batches «не перевірено», their
 * rollback, the open flags and the Mistake Reports. Every write takes the
 * admin header and a reason; an Агент token is refused.
 */
const contentQueueContract = {
  batches: procedure
    .route({
      method: 'GET',
      path: `${queuePath}/batches`,
      summary: 'The Агент batches not reviewed yet, oldest first',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ editionId: EditionIdSchema.optional() }))
    .output(z.object({ batches: z.array(QueueBatchSchema) })),
  review: procedure
    .route({
      method: 'POST',
      path: `${queuePath}/batches/{batchId}/review`,
      summary: 'Marks a batch reviewed: it leaves the queue',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ batchId: BatchIdSchema, reason: ReasonSchema }))
    .output(z.object({ reviewed: z.literal(true) })),
  rollback: procedure
    .route({
      method: 'POST',
      path: `${queuePath}/batches/{batchId}/rollback`,
      summary: 'Rolls a batch back as one publish',
      description:
        'Retires the records the batch created and restores the ones it changed to their version before it; a record changed after the batch is skipped.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ batchId: BatchIdSchema, reason: ReasonSchema }))
    .output(
      z.object({
        contentVersion: z.number().int().positive(),
        retired: z.array(z.string()),
        restored: z.array(z.string()),
        skipped: z.array(z.string()),
      }),
    ),
  flags: procedure
    .route({
      method: 'GET',
      path: `${queuePath}/flags`,
      summary: 'The flags not accepted or rejected yet',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ editionId: EditionIdSchema.optional() }))
    .output(z.object({ flags: z.array(QueueFlagSchema) })),
  resolveFlag: procedure
    .route({
      method: 'POST',
      path: `${queuePath}/flags/{id}`,
      summary: 'Accepts or rejects a flag; the content stays',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
        decision: z.enum(['accept', 'reject']),
        reason: ReasonSchema,
      }),
    )
    .output(z.object({ resolved: z.literal(true) })),
  reports: procedure
    .route({
      method: 'GET',
      path: `${queuePath}/reports`,
      summary: 'The Mistake Reports still to check, oldest first',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ editionId: EditionIdSchema.optional() }))
    .output(z.object({ reports: z.array(QueueReportSchema) })),
  resolveReport: procedure
    .route({
      method: 'POST',
      path: `${queuePath}/reports/{id}/resolve`,
      summary: '«Вирішено»: deletes the Mistake Report (ADR 0056)',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ id: z.uuid(), reason: ReasonSchema }))
    .output(z.object({ resolved: z.literal(true) })),
};

/**
 * The admin API (ADR 0088): what `apps/admin` and an Агент know of the
 * backend. Every procedure answers 404 while no Власник exists. A caller
 * signs in with an emailed code and a TOTP, and is then known by the admin
 * session cookie; every write carries the `x-slovo-admin` header. An Агент
 * token, sent as `Authorization: Bearer <token>`, is taken by the
 * content-writing procedures only: anywhere else a token answers 403, and
 * one that is unknown or revoked answers 401, as any other Bearer does.
 */
/** An open pull request on the repository, as Розробка lists it. */
const PullRequestSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  author: z.string(),
  url: z.string(),
  draft: z.boolean(),
  updatedAt: z.iso.datetime(),
});

/** The latest CI run on `main`: finished green or red, still running, or none yet. */
const MainCiSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.enum(['success', 'failure']),
    url: z.string(),
    finishedAt: z.iso.datetime(),
  }),
  z.object({ state: z.literal('pending'), url: z.string() }),
  z.object({ state: z.literal('none') }),
]);

/** A version milestone (0.1 to 1.0) with its open and closed issues. */
const MilestoneSchema = z.object({
  title: z.string(),
  open: z.number().int(),
  closed: z.number().int(),
  dueOn: z.iso.datetime().nullable(),
});

/** A published release and its tag. */
const ReleaseSchema = z.object({
  tag: z.string(),
  name: z.string(),
  publishedAt: z.iso.datetime(),
  url: z.string(),
});

/** An EAS build of the one app (ADR 0065). */
const EasBuildSchema = z.object({
  id: z.string(),
  platform: z.enum(['ios', 'android']),
  profile: z.string(),
  status: z.enum(['finished', 'errored', 'canceled', 'in-progress']),
  appVersion: z.string().nullable(),
  buildNumber: z.string().nullable(),
  createdAt: z.iso.datetime(),
  url: z.string(),
});

/** What the backend read from GitHub, or that GitHub is unavailable. */
const GitHubBlockSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('ok'),
    fetchedAt: z.iso.datetime(),
    pullRequests: z.array(PullRequestSchema),
    mainCi: MainCiSchema,
    milestones: z.array(MilestoneSchema),
    releases: z.array(ReleaseSchema),
  }),
  z.object({ state: z.literal('unavailable') }),
]);

/** What the backend read from EAS, or that EAS is unavailable. */
const EasBlockSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('ok'),
    fetchedAt: z.iso.datetime(),
    builds: z.array(EasBuildSchema),
  }),
  z.object({ state: z.literal('unavailable') }),
]);

/** The Розробка section: GitHub and EAS, each with the time of its data. */
export const DevelopmentSchema = z.object({ github: GitHubBlockSchema, eas: EasBlockSchema });
export type Development = z.infer<typeof DevelopmentSchema>;
export type PullRequest = z.infer<typeof PullRequestSchema>;
export type MainCi = z.infer<typeof MainCiSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Release = z.infer<typeof ReleaseSchema>;
export type EasBuild = z.infer<typeof EasBuildSchema>;

/** A milestone `0.1` to `1.0`: the version an Owner check belongs to. */
export const OwnerCheckVersionSchema = z.string().regex(/^\d+\.\d+$/);

/** An Owner check; who added or ticked it is an email, an Агент or a server command. */
export const OwnerCheckSchema = z.object({
  id: z.number().int(),
  version: OwnerCheckVersionSchema,
  text: z.string(),
  addedBy: z.string(),
  addedAt: z.iso.datetime(),
  ticked: z.object({ at: z.iso.datetime(), by: z.string() }).nullable(),
});

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
      summary: 'The Action log, newest first, of one Edition when one is named',
      description:
        'A Безпека procedure: a Власник only. Answers the 500 newest rows; under an Edition, only its rows.',
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
            before: z.json(),
            after: z.json(),
            reason: z.string().nullable(),
            editionId: z.string().nullable(),
          }),
        ),
      }),
    ),

  people: procedure
    .route({
      method: 'GET',
      path: '/admin/people',
      summary: 'The active Admin users, by email',
      description: 'A Безпека procedure: a Власник only.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(
      z.object({
        people: z.array(
          z.object({ email: z.string(), role: AdminRoleSchema, signedInYet: z.boolean() }),
        ),
      }),
    ),

  invite: procedure
    .route({
      method: 'POST',
      path: '/admin/people',
      summary: 'Invites a person by email as a Власник or an Адмін',
      description:
        'Emails them a notice; they sign in with an emailed code and set up a TOTP. A removed person comes back afresh. Refused with `taken` for an active email.',
      tags: ['admin'],
    })
    .errors(ACCESS_WRITE_ERRORS)
    .input(z.object({ email: EmailSchema, role: AdminRoleSchema, reason: ReasonSchema }))
    .output(z.object({ invited: z.literal(true) })),

  setRole: procedure
    .route({
      method: 'PUT',
      path: '/admin/people/{email}/role',
      summary: "Changes a person's role",
      description: 'Refused with `self` for the caller, `unknown` for an email with no access.',
      tags: ['admin'],
    })
    .errors(ACCESS_WRITE_ERRORS)
    .input(z.object({ email: EmailSchema, role: AdminRoleSchema, reason: ReasonSchema }))
    .output(z.object({ changed: z.literal(true) })),

  removePerson: procedure
    .route({
      method: 'POST',
      path: '/admin/people/{email}/remove',
      summary: "Removes a person's access and ends their sessions",
      description: 'Refused with `self` for the caller, `unknown` for an email with no access.',
      tags: ['admin'],
    })
    .errors(ACCESS_WRITE_ERRORS)
    .input(z.object({ email: EmailSchema, reason: ReasonSchema }))
    .output(z.object({ removed: z.literal(true) })),

  agentTokens: procedure
    .route({
      method: 'GET',
      path: '/admin/agent-tokens',
      summary: 'The Агент tokens by name, the revoked ones too',
      description: 'A Безпека procedure: a Власник only. A token itself is never answered again.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(
      z.object({
        tokens: z.array(
          z.object({ name: z.string(), createdAt: z.string(), revokedAt: z.string().nullable() }),
        ),
      }),
    ),

  issueAgentToken: procedure
    .route({
      method: 'POST',
      path: '/admin/agent-tokens',
      summary: 'Issues a named Агент token, answered this once',
      description: 'Refused with `name-taken` for a name issued before, revoked or not.',
      tags: ['admin'],
    })
    .errors(ACCESS_WRITE_ERRORS)
    .input(z.object({ name: AgentNameSchema, reason: ReasonSchema }))
    .output(z.object({ name: z.string(), token: z.string() })),

  revokeAgentToken: procedure
    .route({
      method: 'POST',
      path: '/admin/agent-tokens/{name}/revoke',
      summary: "Revokes an Агент's token: it answers 401 from then on",
      description: 'Refused with `unknown` for a name with no token to revoke.',
      tags: ['admin'],
    })
    .errors(ACCESS_WRITE_ERRORS)
    .input(z.object({ name: AgentNameSchema, reason: ReasonSchema }))
    .output(z.object({ revoked: z.literal(true) })),

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
  editionCard: procedure
    .route({
      method: 'GET',
      path: '/admin/editions/{editionId}',
      summary: 'The Edition card, read-only, from the Edition registry',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.strictObject({ editionId: EditionIdSchema }))
    .output(EditionCardSchema),

  analytics: procedure
    .route({
      method: 'GET',
      path: '/admin/editions/{editionId}/analytics',
      summary: 'The Аналітика of an Edition, or of `all`, over a period, from PostHog',
      description:
        'Active people by day, Відвідини by day and their median length, devices and app versions: counts only, cached for 10 minutes.',
      tags: ['admin'],
    })
    .errors(ANALYTICS_ERRORS)
    .input(z.object({ editionId: AnalyticsEditionSchema, from: DaySchema, to: DaySchema }))
    .output(AnalyticsOverviewSchema),

  variantResults: procedure
    .route({
      method: 'GET',
      path: '/admin/editions/{editionId}/switches/{feature}/variants',
      summary: 'The people active in each Variant of an A/B Feature Switch, from PostHog',
      tags: ['admin'],
    })
    .errors(ANALYTICS_ERRORS)
    .input(z.object({ editionId: AnalyticsEditionSchema, feature: z.string().min(1) }))
    .output(VariantResultsSchema),

  counters: procedure
    .route({
      method: 'GET',
      path: '/admin/editions/{editionId}/counters',
      summary:
        'The Community Counters sums and the questionnaire counters of an Edition, or of `all`',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ editionId: AnalyticsEditionSchema }))
    .output(CountersSummarySchema),
  content: contentWriteContract,
  contentQueue: contentQueueContract,
  development: procedure
    .route({
      method: 'GET',
      path: '/admin/development',
      summary:
        'Розробка: open pull requests, CI on main, version milestones, releases and EAS builds',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(DevelopmentSchema),
  ownerChecks: procedure
    .route({
      method: 'GET',
      path: '/admin/owner-checks',
      summary: 'The Owner checks, of one version or of all, with the open count per version',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ version: OwnerCheckVersionSchema.optional() }))
    .output(
      z.object({
        checks: z.array(OwnerCheckSchema),
        open: z.record(z.string(), z.number().int()),
      }),
    ),

  tickOwnerCheck: procedure
    .route({
      method: 'POST',
      path: '/admin/owner-checks/{id}/tick',
      summary: 'Ticks an Owner check: who and when, no reason',
      description:
        'The one admin write that takes no reason (ADR 0088). A ticked check keeps its first tick.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ id: z.coerce.number<number>().int().positive() }))
    .output(z.object({ check: OwnerCheckSchema })),

  addOwnerCheck: procedure
    .route({
      method: 'POST',
      path: '/admin/owner-checks',
      summary: 'Adds an Owner check to a version',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ version: OwnerCheckVersionSchema, text: z.string().trim().min(1).max(2000) }))
    .output(z.object({ check: OwnerCheckSchema })),
  quality: procedure
    .route({
      method: 'GET',
      path: '/admin/quality',
      summary: 'Якість: the Sentry numbers of a period, with the day before',
      description:
        'Crash-free rate, crashes, errors, new issues, backend p95 and app start times. Sentry keeps 30 days, so a longer period is cut to 30 days and answers `capped`.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ editionId: EditionIdSchema.optional(), period: AdminPeriodSchema }))
    .output(
      z.object({
        capped: z.boolean(),
        from: z.iso.datetime(),
        to: z.iso.datetime(),
        kpis: z.object({
          crashFree: QualityKpiSchema,
          crashes: QualityKpiSchema,
          errors: QualityKpiSchema,
          newIssues: QualityKpiSchema,
          backendP95: QualityKpiSchema,
          appStart: QualityKpiSchema,
        }),
      }),
    ),

  ciHistory: procedure
    .route({
      method: 'GET',
      path: '/admin/quality/ci',
      summary: 'Якість: the CI runs on main of a period, oldest first',
      description:
        'Each run with its coverage per package, job durations and its flaky tests: failed in it and passed in another run of the period.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.object({ period: AdminPeriodSchema }))
    .output(
      z.object({
        runs: z.array(CiRunSchema.extend({ flakyTests: z.array(z.string()) })),
      }),
    ),

  pushCiRun: procedure
    .route({
      method: 'POST',
      path: '/admin/ci-runs',
      summary: 'CI pushes a run on main to the history',
      description:
        'Called by CI after each run on main, with the CI history token as Bearer (ADR 0095). A run already kept stays as it is.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(CiRunSchema)
    .output(z.object({ kept: z.literal(true) })),
};
