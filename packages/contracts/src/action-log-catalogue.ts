import { z } from 'zod';

/**
 * The catalogue of the Action log keys (ADR 0209): every `what` a writer
 * writes, with the shape of the `before` and `after` it writes under that key.
 * The writers are typed over `ActionKey`, and the admin's texts over the
 * catalogue, so a key without a text fails typecheck. The shapes are loose: a
 * row is kept for years, so a field added later never hides it, and a row
 * whose side no longer fits still reads, as plain text (ADR 0088).
 */

/** The kinds of record the content writes write, one table each (ADR 0090). */
export const CONTENT_RECORD_KINDS = [
  'word',
  'correction',
  'idiom',
  'synonymRow',
  'tip',
  'curatedCollection',
  'crosswordDay',
] as const;
export type ContentRecordKind = (typeof CONTENT_RECORD_KINDS)[number];

/** What a content row did to its record: a write, a check, a flag, or a Word sent to every voice. */
export const CONTENT_ACTION_OPS = [
  'create',
  'edit',
  'retire',
  'check',
  'flag',
  'allVoices',
] as const;
export type ContentActionOp = (typeof CONTENT_ACTION_OPS)[number];

/** The key of a row about one content record: `content.<kind>.<op>`. */
export type ContentActionKey =
  | `content.${ContentRecordKind}.${'create' | 'edit' | 'retire' | 'check'}`
  | `content.${Exclude<ContentRecordKind, 'crosswordDay'>}.flag`
  | 'content.word.allVoices';

/** A record as a content write keeps it, or the record a check, a flag or a voicing names. */
export const ContentActionSideSchema = z.union([
  z.object({ recordVersion: z.number(), fields: z.record(z.string(), z.unknown()) }),
  z.object({ id: z.string(), recordVersion: z.number().optional() }),
]);

const Person = z.object({ email: z.string(), role: z.enum(['owner', 'admin']).optional() });
const Agent = z.object({ name: z.string(), revoked: z.boolean().optional() });
const Rules = z.array(
  z.object({
    feature: z.string(),
    verdict: z.union([z.enum(['on', 'off']), z.object({ variants: z.array(z.string()) })]),
    targets: z.record(z.string(), z.unknown()).optional(),
  }),
);
const FlagRef = z.object({ flagId: z.union([z.number(), z.string()]) });
const OwnerCheck = z.union([z.object({ text: z.string() }), z.object({ ticked: z.boolean() })]);
/** A Service named, with the money fields the row holds: all of them when added, the changed ones when edited. */
const ServiceMoney = z.object({
  name: z.string(),
  plan: z.string().nullable().optional(),
  monthlyPriceUsdCents: z.number().nullable().optional(),
  billingDay: z.number().nullable().optional(),
});
/** A Service entry named by its Service and type, with the fields the row's write changed. */
const ServiceEntry = z.object({
  service: z.string(),
  type: z.string(),
  fields: z.array(z.string()).optional(),
});

/** Every key besides the content records', with the shape of each side it writes; a side may be `null`. */
const SHAPES = {
  'content.batch.review': z.null(),
  'content.batch.rollback': z.union([
    z.object({
      retired: z.array(z.string()),
      restored: z.array(z.string()),
      skipped: z.array(z.string()),
    }),
    z.object({ batchId: z.string() }),
  ]),
  'content.flag.accept': FlagRef,
  'content.flag.reject': FlagRef,
  'report.resolve': z.object({
    entryId: z.string(),
    type: z.string(),
    comment: z.string().optional(),
  }),
  'account.delete': z.object({ email: z.string(), createdAt: z.string() }),
  'admin.owner.add': Person,
  'admin.user.invite': Person,
  'admin.user.role': Person,
  'admin.user.remove': Person,
  'admin.agent.add': Agent,
  'admin.agent.revoke': Agent,
  'owner-check.add': OwnerCheck,
  'owner-check.import': OwnerCheck,
  'owner-check.tick': OwnerCheck,
  'alert-threshold.set': z.object({ key: z.string(), value: z.number().optional() }),
  'switches.rules.set': Rules,
  'switches.kill': Rules,
  'switches.minimum.set': z.object({
    platform: z.string(),
    minimum: z.object({ soft: z.string().optional(), hard: z.string().optional() }).optional(),
  }),
  'service.add': ServiceMoney,
  'service.money.edit': ServiceMoney,
  'service.entry.add': ServiceEntry,
  'service.entry.edit': ServiceEntry,
  'service.entry.delete': ServiceEntry,
  'service.entry.reveal': ServiceEntry,
  'service.entry.copy': ServiceEntry,
} as const;

/** A key of the catalogue besides the content records'. */
export type NamedActionKey = keyof typeof SHAPES;

/** Every key a writer may write to the Action log. */
export type ActionKey = NamedActionKey | ContentActionKey;

/** A side of a row of the key, as its shape parses it. */
export type ActionSide<Key extends NamedActionKey> = z.output<(typeof SHAPES)[Key]>;

/** The shape of each side of each named key, by key. */
export const ACTION_SHAPES: { readonly [Key in NamedActionKey]: z.ZodType<ActionSide<Key>> } =
  SHAPES;

/** Whether a row's `what` is a named key of the catalogue. */
export const isNamedActionKey = (what: string): what is NamedActionKey =>
  Object.hasOwn(SHAPES, what);

const isKind = (kind: string): kind is ContentRecordKind =>
  CONTENT_RECORD_KINDS.some((each) => each === kind);
const isOp = (op: string): op is ContentActionOp => CONTENT_ACTION_OPS.some((each) => each === op);

/** The kind and op of a row's `content.<kind>.<op>` key; none for any other `what`. */
export function contentActionOf(
  what: string,
): { readonly kind: ContentRecordKind; readonly op: ContentActionOp } | undefined {
  const [area, kind, op, ...rest] = what.split('.');
  if (area !== 'content' || kind === undefined || op === undefined || rest.length > 0) {
    return undefined;
  }
  return isKind(kind) && isOp(op) ? { kind, op } : undefined;
}
