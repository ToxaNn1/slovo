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
    .output(z.object({ services: z.array(ServiceSchema) })),
  ...serviceEntriesContract,
};
