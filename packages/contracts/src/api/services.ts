import { z } from 'zod';

import { ADMIN_ERRORS } from './admin-errors';
import { procedure } from './procedure';
import { ReasonSchema } from './reason';

/**
 * What a Service's block shows (ADR 0164): a Railway service its Online or
 * Offline, a Cron its last and next run, any other Service its usage bar.
 */
export const SERVICE_KINDS = ['railway', 'cron', 'metered'] as const;
export const ServiceKindSchema = z.enum(SERVICE_KINDS);
export type ServiceKind = z.infer<typeof ServiceKindSchema>;

/** A line on the canvas: a constant link is solid, a scheduled run is dashed. */
export const SERVICE_LINK_KINDS = ['constant', 'scheduled'] as const;
export const ServiceLinkKindSchema = z.enum(SERVICE_LINK_KINDS);

const ServiceIdSchema = z.uuid();

/** A link from a Service to another, by the other's id. */
export const ServiceLinkSchema = z.object({ to: ServiceIdSchema, kind: ServiceLinkKindSchema });

/** One limit of a Service's plan, as `limit` of `unit`. */
export const ServiceLimitSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  limit: z.number().positive(),
});

/** A block's fixed place on the canvas, its top left corner in CSS pixels. */
export const CanvasPositionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

/** An outside provider SLOVO pays for or depends on, with its block on the canvas. */
export const ServiceSchema = z.object({
  id: ServiceIdSchema,
  name: z.string().min(1),
  kind: ServiceKindSchema,
  /** The plan's name, `null` until the Власник enters it. */
  plan: z.string().nullable(),
  monthlyPriceUsdCents: z.number().int().min(0).nullable(),
  /** The day of the month the Service charges on. */
  billingDay: z.number().int().min(1).max(31).nullable(),
  limits: z.array(ServiceLimitSchema),
  position: CanvasPositionSchema,
  links: z.array(ServiceLinkSchema),
});
export type Service = z.infer<typeof ServiceSchema>;

/** The types of a Service entry: a login and a link stay open, the rest are sealed in the Vault (ADR 0164). */
export const OPEN_ENTRY_TYPES = ['login', 'link'] as const;
export const SEALED_ENTRY_TYPES = ['password', 'token', 'recovery-codes'] as const;
export const ServiceEntryTypeSchema = z.enum([...OPEN_ENTRY_TYPES, ...SEALED_ENTRY_TYPES]);
export type ServiceEntryType = z.infer<typeof ServiceEntryTypeSchema>;

const ServiceEntryIdSchema = z.uuid();
const EntryLabelSchema = z.string().trim().min(1).max(120);
/** «Де використовується»: where the entry is used. */
const EntryNoteSchema = z.string().trim().max(500).nullable();
const EntryValueSchema = z.string().min(1).max(10_000);

const ServiceEntryFieldsSchema = z.object({
  id: ServiceEntryIdSchema,
  serviceId: ServiceIdSchema,
  label: z.string(),
  note: z.string().nullable(),
});

/**
 * One login, link, password, token or recovery-codes item of a Service. A
 * login and a link come with their value; a sealed entry never does: no read
 * answers a sealed value.
 */
export const ServiceEntrySchema = z.discriminatedUnion('type', [
  ServiceEntryFieldsSchema.extend({ type: z.enum(OPEN_ENTRY_TYPES), value: z.string() }),
  ServiceEntryFieldsSchema.extend({ type: z.enum(SEALED_ENTRY_TYPES) }),
]);
export type ServiceEntry = z.infer<typeof ServiceEntrySchema>;

/** Whether the Deployment has a `VAULT_KEY`: without it no entry is written. */
export const VaultStateSchema = z.enum(['on', 'off']);

/** The errors of an entry write: `VAULT_OFF` while `VAULT_KEY` is unset. */
const ENTRY_WRITE_ERRORS = {
  ...ADMIN_ERRORS,
  VAULT_OFF: { status: 503, message: 'The Vault is off: the Deployment has no VAULT_KEY' },
} as const;

/** The errors of a reveal or a copy: `LOCKED` outside the 15 minutes a TOTP opens. */
const ENTRY_READ_ERRORS = {
  ...ENTRY_WRITE_ERRORS,
  LOCKED: { status: 423, message: 'The Vault is locked: enter a fresh TOTP code to open it' },
} as const;

/** The errors of an unlock: a wrong code with the attempts left, or too many wrong ones. */
const UNLOCK_ERRORS = {
  ...ENTRY_WRITE_ERRORS,
  WRONG_CODE: {
    status: 400,
    message: 'The TOTP code is wrong or already used',
    data: z.object({ attemptsLeft: z.number().int().min(0) }),
  },
  TOO_MANY_REQUESTS: {
    message: 'Too many wrong codes: the unlock is blocked for a while',
    data: z.object({ retryAfterSeconds: z.number().int().positive() }),
  },
} as const;

/** One entry's value as a reveal or a copy answers it. */
const EntryValueAnswerSchema = z.object({ value: z.string() });

/** The Service entries of «Сервіси»: a Власник only, every write with a reason (ADR 0122, 0164). */
const serviceEntriesContract = {
  entries: procedure
    .route({
      method: 'GET',
      path: '/admin/services/{serviceId}/entries',
      summary: "A Service's entries: logins and links with their values, sealed ones without",
      description: 'A «Сервіси» procedure: a Власник only. No read answers a sealed value.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.strictObject({ serviceId: ServiceIdSchema }))
    .output(z.object({ vault: VaultStateSchema, entries: z.array(ServiceEntrySchema) })),
  addEntry: procedure
    .route({
      method: 'POST',
      path: '/admin/services/{serviceId}/entries',
      summary: 'Adds an entry to a Service, sealing a password, token or recovery codes',
      description:
        'A «Сервіси» procedure: a Власник only. The Action log row names the fields, never a value.',
      tags: ['admin'],
    })
    .errors(ENTRY_WRITE_ERRORS)
    .input(
      z.strictObject({
        serviceId: ServiceIdSchema,
        type: ServiceEntryTypeSchema,
        label: EntryLabelSchema,
        note: EntryNoteSchema,
        value: EntryValueSchema,
        reason: ReasonSchema,
      }),
    )
    .output(z.object({ entry: ServiceEntrySchema })),
  editEntry: procedure
    .route({
      method: 'POST',
      path: '/admin/services/entries/{id}',
      summary: "Changes an entry's label, note or value; its type stays",
      description:
        'A «Сервіси» procedure: a Власник only. The Action log row names the changed fields, never a value.',
      tags: ['admin'],
    })
    .errors(ENTRY_WRITE_ERRORS)
    .input(
      z
        .strictObject({
          id: ServiceEntryIdSchema,
          label: EntryLabelSchema.optional(),
          note: EntryNoteSchema.optional(),
          value: EntryValueSchema.optional(),
          reason: ReasonSchema,
        })
        .refine(
          ({ label, note, value }) =>
            label !== undefined || note !== undefined || value !== undefined,
          'names a field to change',
        ),
    )
    .output(z.object({ entry: ServiceEntrySchema })),
  deleteEntry: procedure
    .route({
      method: 'POST',
      path: '/admin/services/entries/{id}/delete',
      summary: 'Deletes an entry of a Service',
      description: 'A «Сервіси» procedure: a Власник only.',
      tags: ['admin'],
    })
    .errors(ENTRY_WRITE_ERRORS)
    .input(z.strictObject({ id: ServiceEntryIdSchema, reason: ReasonSchema }))
    .output(z.object({ deleted: z.literal(true) })),
  unlockVault: procedure
    .route({
      method: 'POST',
      path: '/admin/services/vault/unlock',
      summary: 'Opens «Показати» and «Копіювати» for 15 minutes on a fresh TOTP code',
      description:
        'A «Сервіси» procedure: a Власник only. It opens the calling admin session alone; a code that signed in or opened before is refused.',
      tags: ['admin'],
    })
    .errors(UNLOCK_ERRORS)
    .input(z.strictObject({ code: z.string().trim().min(1).max(20) }))
    .output(z.object({ openUntil: z.iso.datetime() })),
  revealEntry: procedure
    .route({
      method: 'POST',
      path: '/admin/services/entries/{id}/reveal',
      summary: "Answers one entry's plain value to show («Показати»)",
      description:
        'A «Сервіси» procedure: a Власник only, inside the 15 minutes an unlock opens. The Action log row names the entry, never the value.',
      tags: ['admin'],
    })
    .errors(ENTRY_READ_ERRORS)
    .input(z.strictObject({ id: ServiceEntryIdSchema }))
    .output(EntryValueAnswerSchema),
  copyEntry: procedure
    .route({
      method: 'POST',
      path: '/admin/services/entries/{id}/copy',
      summary: "Answers one entry's plain value to copy without showing it («Копіювати»)",
      description:
        'A «Сервіси» procedure: a Власник only, inside the 15 minutes an unlock opens. The Action log row names the entry, never the value.',
      tags: ['admin'],
    })
    .errors(ENTRY_READ_ERRORS)
    .input(z.strictObject({ id: ServiceEntryIdSchema }))
    .output(EntryValueAnswerSchema),
};

/** A block's size on the canvas in CSS pixels: a new Service takes a place where it overlaps none. */
export const SERVICE_BLOCK = { width: 200, height: 88 } as const;

/** What SLOVO pays: the monthly total and the next charge, by the Kyiv day (ADR 0164). */
export const ServiceCostsSchema = z.object({
  /** The monthly prices summed, the Services with no price left out. */
  monthlyTotalUsdCents: z.number().int().min(0),
  /** The nearest Kyiv day a priced Service with a billing day charges, `null` when none does. */
  nextCharge: z
    .object({
      /** The Kyiv day `YYYY-MM-DD`; a billing day past the month's end charges on its last day. */
      on: z.iso.date(),
      amountUsdCents: z.number().int().positive(),
      /** The Services that charge that day. */
      serviceIds: z.array(ServiceIdSchema).min(1),
    })
    .nullable(),
});
export type ServiceCosts = z.infer<typeof ServiceCostsSchema>;

/** The money fields of a Service the Власник enters by hand. */
const ServiceMoneyFields = {
  plan: z.string().trim().min(1).max(80).nullable(),
  monthlyPriceUsdCents: z.number().int().min(0).max(100_000_000).nullable(),
  billingDay: z.number().int().min(1).max(31).nullable(),
};

/** The money fields by name, as an edit's Action log row and answer name them. */
export const SERVICE_MONEY_FIELDS = ['plan', 'monthlyPriceUsdCents', 'billingDay'] as const;
export const ServiceMoneyFieldSchema = z.enum(SERVICE_MONEY_FIELDS);
export type ServiceMoneyField = z.infer<typeof ServiceMoneyFieldSchema>;

/** Why a write of a Service is refused, by name. */
export const ServiceRefusalSchema = z.object({ refusal: z.enum(['unknown', 'name-taken']) });

/** The errors of a «Сервіси» write. */
const SERVICE_WRITE_ERRORS = {
  ...ADMIN_ERRORS,
  CONFLICT: { message: 'The Service write is refused', data: ServiceRefusalSchema },
} as const;

/** The «Сервіси» writes of a Service's money and of a new Service: a Власник only, with a reason. */
export const serviceMoneyContract = {
  add: procedure
    .route({
      method: 'POST',
      path: '/admin/services',
      summary: 'Adds a Service at a free place on the canvas',
      description:
        'A Власник only, with a reason; the Action log row names the fields entered. Refused with `name-taken` for a name a Service has.',
      tags: ['admin'],
    })
    .errors(SERVICE_WRITE_ERRORS)
    .input(
      z.strictObject({
        name: z.string().trim().min(1).max(80),
        kind: ServiceKindSchema,
        ...ServiceMoneyFields,
        reason: ReasonSchema,
      }),
    )
    .output(z.object({ service: ServiceSchema })),

  editMoney: procedure
    .route({
      method: 'PUT',
      path: '/admin/services/{id}/money',
      summary: "Sets a Service's plan, monthly price and billing day",
      description:
        'A Власник only, with a reason. `changed` names the fields that changed; the Action log row holds them alone, and none when nothing changed. Refused with `unknown` for an id with no Service.',
      tags: ['admin'],
    })
    .errors(SERVICE_WRITE_ERRORS)
    .input(z.strictObject({ id: ServiceIdSchema, ...ServiceMoneyFields, reason: ReasonSchema }))
    .output(z.object({ service: ServiceSchema, changed: z.array(ServiceMoneyFieldSchema) })),
};
/** How much of one limit of its plan a Service used in the current period (ADR 0164). */
export const LimitUsageSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  used: z.number().min(0),
  limit: z.number().positive(),
});
export type LimitUsage = z.infer<typeof LimitUsageSchema>;

/** The share of a limit from which a Service is near it: a yellow mark and an Alert (ADR 0164). */
export const NEAR_LIMIT_SHARE = 0.9;

/** Whether a limit is used to `NEAR_LIMIT_SHARE` or more. */
export const nearLimit = ({ used, limit }: { readonly used: number; readonly limit: number }) =>
  used >= limit * NEAR_LIMIT_SHARE;

/** What a Service's provider answered, by the Service's kind. */
export const ServiceReadingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('metered'), usage: z.array(LimitUsageSchema) }),
  z.object({
    kind: z.literal('railway'),
    state: z.enum(['online', 'offline']),
    usage: z.array(LimitUsageSchema),
  }),
  z.object({
    kind: z.literal('cron'),
    lastRun: z.object({ at: z.iso.datetime(), succeeded: z.boolean() }).nullable(),
    nextRunAt: z.iso.datetime().nullable(),
  }),
]);
export type ServiceReading = z.infer<typeof ServiceReadingSchema>;

/**
 * A Service's usage, read from its provider's API and kept for an hour: the
 * reading and its read time, `stale` when the latest read failed and this is
 * the last good one, or `unavailable` while no read has succeeded.
 */
export const ServiceUsageSchema = z.object({
  serviceId: ServiceIdSchema,
  read: z.discriminatedUnion('state', [
    z.object({
      state: z.literal('read'),
      reading: ServiceReadingSchema,
      readAt: z.iso.datetime(),
      stale: z.boolean(),
    }),
    z.object({ state: z.literal('unavailable') }),
  ]),
});
export type ServiceUsage = z.infer<typeof ServiceUsageSchema>;

/** The official NBU rate of the dollar the UAH figures are counted at (ADR 0164). */
export const UsdRateSchema = z.object({
  /** Hryvnias for one dollar, as the NBU sets it. */
  uahPerUsd: z.number().positive(),
  /** The day `YYYY-MM-DD` the NBU set the rate for. */
  on: z.iso.date(),
  /** `today` for the rate of the Kyiv day; `last-known` when the day's read failed and an older rate stands in. */
  state: z.enum(['today', 'last-known']),
});
export type UsdRate = z.infer<typeof UsdRateSchema>;

/** The «Сервіси» read of the NBU rate: a Власник only. */
export const serviceRateContract = {
  usdRate: procedure
    .route({
      method: 'GET',
      path: '/admin/services/usd-rate',
      summary: 'The official NBU rate of the dollar, for the money in hryvnias',
      description:
        'A Власник only. The NBU is read at most once a Kyiv day and the rate kept; when that read fails, the last known rate answers with its day. `rate` is `null` while no read has ever found one.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(z.object({ rate: UsdRateSchema.nullable() })),
};

/** The «Сервіси» procedures of the admin API: a Власник only (ADR 0164). */
export const servicesContract = {
  list: procedure
    .route({
      method: 'GET',
      path: '/admin/services',
      summary: 'Every Service with its place and links on the canvas',
      description: 'A «Сервіси» procedure: a Власник only.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(z.object({ services: z.array(ServiceSchema), costs: ServiceCostsSchema })),
  ...serviceEntriesContract,
  ...serviceMoneyContract,
  usage: procedure
    .route({
      method: 'GET',
      path: '/admin/services/usage',
      summary: 'The usage of every Service read from its provider',
      description: 'A «Сервіси» procedure: a Власник only. Each reading is kept for an hour.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .output(z.object({ usage: z.array(ServiceUsageSchema) })),
  refreshUsage: procedure
    .route({
      method: 'POST',
      path: '/admin/services/usage/refresh',
      summary: "Reads one Service's usage from its provider now («Оновити»)",
      description:
        'A «Сервіси» procedure: a Власник only. NOT_FOUND for a Service without a usage read.',
      tags: ['admin'],
    })
    .errors(ADMIN_ERRORS)
    .input(z.strictObject({ serviceId: ServiceIdSchema }))
    .output(z.object({ usage: ServiceUsageSchema })),
  ...serviceRateContract,
};
