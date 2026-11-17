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
  ...serviceMoneyContract,
  ...serviceRateContract,
};
