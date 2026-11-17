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
};
