import {
  FeatureSwitchesSchema,
  RuleTargetsSchema,
  RuleVerdictSchema,
  readSwitches,
  type FeatureSwitch,
  type FeatureSwitches,
  type Platform,
  type ReadableRule,
  type RuleTargets,
  type UpdateChannel,
  type Variant,
} from '@slovo/contracts';

import type { Clock } from '../ports';
import { compareVersions, isAppVersion } from './app-version';

const everyFeature = FeatureSwitchesSchema.keyof().options;

/**
 * A remote Feature Switch Rule as the backend sends it, read leniently
 * (ADR 0089): the feature, verdict and targets stay unparsed, so a Rule for a
 * switch, a verdict or a target this app doesn't know yet is skipped alone
 * and the others still hold. The caller gives the Rules in their order.
 */
export interface RemoteRule {
  readonly id: string;
  readonly feature: string;
  readonly verdict: unknown;
  readonly targets: Readonly<Record<string, unknown>>;
}

/** What the Rules target on this device. */
export interface SwitchFacts {
  readonly appVersion: string;
  readonly platform: Platform;
  /** The phone's two-letter region, when the locale names one. */
  readonly region: string | undefined;
  readonly signedIn: boolean;
  /** The Update channel the build listens to; undefined in a development build, which no channel Rule matches. */
  readonly updateChannel: UpdateChannel | undefined;
  /** The Install id: the device's own random name, sent only as the Analytics distinct id, while Analytics are on. */
  readonly installId: string;
  readonly clock: Clock;
  /** The backend's clock minus the device's, in milliseconds, so a schedule holds by the backend's. */
  readonly clockOffsetMs: number;
}

/** A Feature Switch's effective value: on, with the Variant under test when the Rule names one, or off. */
export type SwitchVerdict =
  { readonly on: false } | { readonly on: true; readonly variant?: Variant };

export type SwitchVerdicts = Readonly<Record<FeatureSwitch, SwitchVerdict>>;

/** FNV-1a, 32 bits: the same bucket on every device for the same text. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The reader's bucket of the Rule, 0 to 99: the Install id hashed with the Rule id as salt. */
const bucketOf = (ruleId: string, installId: string) => fnv1a(`${ruleId}:${installId}`) % 100;

/**
 * The reader's Variant of the Rule: the Install id hashed with a salt of its
 * own, apart from the share's bucket, so a share of any size gets every Variant.
 */
const variantOf = (variants: readonly Variant[], ruleId: string, installId: string) =>
  variants[fnv1a(`${ruleId}:variant:${installId}`) % variants.length];

/** Whether a Rule in force targets this device; its schedule is the reader's to hold. */
function matches(ruleId: string, targets: RuleTargets, facts: SwitchFacts): boolean {
  const { appVersion, platform, region, share, signedIn, channel } = targets;
  // An app version that cannot be read, as a development build's, is in no range.
  if (appVersion !== undefined && !isAppVersion(facts.appVersion)) return false;
  if (appVersion?.from !== undefined && compareVersions(facts.appVersion, appVersion.from) < 0) {
    return false;
  }
  if (appVersion?.until !== undefined && compareVersions(facts.appVersion, appVersion.until) > 0) {
    return false;
  }
  if (platform !== undefined && platform !== facts.platform) return false;
  if (region !== undefined && (facts.region === undefined || !region.includes(facts.region))) {
    return false;
  }
  if (share !== undefined && bucketOf(ruleId, facts.installId) >= share) return false;
  if (signedIn !== undefined && signedIn !== facts.signedIn) return false;
  return channel === undefined || channel === facts.updateChannel;
}

/** The Rules this app can read: one with a verdict or a target it doesn't know is skipped alone. */
function readable(rules: readonly RemoteRule[]): ReadableRule[] {
  return rules.flatMap(({ id, feature, ...rule }) => {
    const verdict = RuleVerdictSchema.safeParse(rule.verdict);
    const targets = RuleTargetsSchema.safeParse(rule.targets);
    return verdict.success && targets.success
      ? [{ id, feature, verdict: verdict.data, targets: targets.data }]
      : [];
  });
}

/**
 * The effective value of every Feature Switch (ADR 0089): the first Rule of
 * the feature that matches the facts decides, the Edition's state when none
 * does. An unavailable feature is never on, and a feature is on only while
 * every switch it depends on is in effect too. Pure: the same
 * Rules, states and facts give the same verdicts on every device.
 */
export function evaluateSwitches({
  rules,
  states,
  facts,
}: {
  rules: readonly RemoteRule[];
  states: FeatureSwitches;
  facts: SwitchFacts;
}): SwitchVerdicts {
  const { installId } = facts;
  const verdictOf = readSwitches({
    states,
    rules: readable(rules),
    now: new Date(facts.clock.now().getTime() + facts.clockOffsetMs),
  }).forReader((rule) => matches(rule.id, rule.targets, facts));
  // The same typed-record builder as `mix.ts`: the keys are every Feature Switch.
  return Object.fromEntries(
    everyFeature.map((feature): [FeatureSwitch, SwitchVerdict] => {
      const answer = verdictOf(feature);
      if (!answer.on) return [feature, { on: false }];
      const { by } = answer;
      if (by === undefined || typeof by.verdict !== 'object') return [feature, { on: true }];
      const variant = variantOf(by.verdict.variants, by.id, installId);
      return [feature, variant === undefined ? { on: true } : { on: true, variant }];
    }),
  ) as Record<FeatureSwitch, SwitchVerdict>;
}
