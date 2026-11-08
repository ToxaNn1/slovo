import { z } from 'zod';

import { EditionIdSchema, FeatureSwitchStateSchema } from './edition';

/** An app version as the stores name it: three numbers. */
export const AppVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'Expected an app version');

/** The platforms the app has a build for. */
export const PlatformSchema = z.enum(['ios', 'android']);

/** A region as the phone's locale names it: an ISO 3166-1 alpha-2 code. */
export const RegionSchema = z.string().regex(/^[A-Z]{2}$/, 'Expected a two-letter region');

/** A Variant of a Feature Switch under test: a short name PostHog shows. */
export const VariantSchema = z.string().min(1).max(40);

/**
 * What a Rule answers for the readers it targets: the feature on, off, or on
 * with one of two or three Variants, picked on the device by the Install id
 * (ADR 0089).
 */
export const RuleVerdictSchema = z.union([
  FeatureSwitchStateSchema.exclude(['unavailable']),
  z.strictObject({
    variants: z
      .array(VariantSchema)
      .min(2)
      .max(3)
      .refine(
        (variants) => new Set(variants).size === variants.length,
        'Expected distinct Variants',
      ),
  }),
]);

/**
 * The readers a Rule targets: every target named must match. A target left
 * out matches everyone; an empty object is every reader of the Edition.
 */
export const RuleTargetsSchema = z.strictObject({
  /** The app versions in the range, both ends included; an end left out is open. */
  appVersion: z
    .strictObject({ from: AppVersionSchema.optional(), until: AppVersionSchema.optional() })
    .optional(),
  platform: PlatformSchema.optional(),
  /** The phone's region setting, read through the JavaScript locale, one of these. */
  region: z.array(RegionSchema).min(1).optional(),
  /** The share of readers in per cent, picked by the Install id hashed with the Rule id as salt (the Rollout). */
  share: z.int().min(0).max(100).optional(),
  signedIn: z.boolean().optional(),
  /** The moments the Rule holds between, both ends included, on the device's clock corrected by the backend's. */
  schedule: z
    .strictObject({ from: z.iso.datetime().optional(), until: z.iso.datetime().optional() })
    .optional(),
});

/**
 * A remote Feature Switch Rule the owner sets in the admin (ADR 0089): for one
 * Edition and one feature, what the readers it targets get. Several Rules of
 * one feature are tried in `order`; the first that matches decides, the
 * Edition's state when none does.
 */
export const RuleSchema = z.strictObject({
  id: z.string().min(1),
  editionId: EditionIdSchema,
  /** A Feature Switch's name; a string, so a Rule for a switch an older app doesn't know still parses and is skipped there. */
  feature: z.string().min(1),
  order: z.int().min(0),
  verdict: RuleVerdictSchema,
  targets: RuleTargetsSchema,
});

export type AppVersion = z.infer<typeof AppVersionSchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type RuleVerdict = z.infer<typeof RuleVerdictSchema>;
export type RuleTargets = z.infer<typeof RuleTargetsSchema>;
export type Rule = z.infer<typeof RuleSchema>;
