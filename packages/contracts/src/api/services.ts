import { z } from 'zod';

import { ADMIN_ERRORS } from './admin-errors';
import { procedure } from './procedure';

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

/** How much of one limit of its plan a Service used in the current period (ADR 0164). */
export const LimitUsageSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  used: z.number().min(0),
  limit: z.number().positive(),
});
export type LimitUsage = z.infer<typeof LimitUsageSchema>;

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
    .output(z.object({ services: z.array(ServiceSchema) })),
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
};
