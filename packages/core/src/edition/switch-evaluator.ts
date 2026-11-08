import {
  FeatureSwitchesSchema,
  RuleTargetsSchema,
  RuleVerdictSchema,
  type FeatureSwitch,
  type FeatureSwitches,
  type Platform,
  type RuleTargets,
  type Variant,
} from '@slovo/contracts';

import type { Clock } from '../ports';
import { switchedOn } from './edition';

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

const isFeature = (name: string): name is FeatureSwitch =>
  everyFeature.some((feature) => feature === name);

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

const versionParts = (version: string) => version.split('.').map(Number);

/** Compares two app versions by number, part by part. */
function compareVersions(a: string, b: string): number {
  const [partsA, partsB] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const difference = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function matches(ruleId: string, targets: RuleTargets, facts: SwitchFacts): boolean {
  const { appVersion, platform, region, share, signedIn, schedule } = targets;
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
  if (schedule !== undefined) {
    const now = facts.clock.now().getTime() + facts.clockOffsetMs;
    if (schedule.from !== undefined && now < Date.parse(schedule.from)) return false;
    if (schedule.until !== undefined && now > Date.parse(schedule.until)) return false;
  }
  return true;
}

/** The verdict of the first Rule of the feature that matches, or none. */
function ruleVerdict(
  feature: FeatureSwitch,
  rules: readonly RemoteRule[],
  facts: SwitchFacts,
): SwitchVerdict | undefined {
  for (const rule of rules) {
    if (rule.feature !== feature) continue;
    const verdict = RuleVerdictSchema.safeParse(rule.verdict);
    const targets = RuleTargetsSchema.safeParse(rule.targets);
    if (!verdict.success || !targets.success) continue;
    if (!matches(rule.id, targets.data, facts)) continue;
    if (verdict.data === 'on') return { on: true };
    if (verdict.data === 'off') return { on: false };
    const { variants } = verdict.data;
    const variant = variants[bucketOf(rule.id, facts.installId) % variants.length];
    return variant === undefined ? { on: true } : { on: true, variant };
  }
  return undefined;
}

/**
 * The effective value of every Feature Switch (ADR 0089): the first Rule of
 * the feature that matches the facts decides, the Edition's state when none
 * does. An unavailable feature is never on, and a feature is on only while
 * every switch it depends on is in effect too (ADR 0040). Pure: the same
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
  const known = rules.filter((rule) => isFeature(rule.feature));
  const own = new Map<FeatureSwitch, SwitchVerdict>(
    everyFeature.map((feature) => {
      const state = states[feature];
      if (state === 'unavailable') return [feature, { on: false }];
      return [feature, ruleVerdict(feature, known, facts) ?? { on: state === 'on' }];
    }),
  );
  const inEffect = switchedOn((feature) => own.get(feature)?.on === true);
  // The same typed-record builder as `mix.ts`: the keys are every Feature Switch.
  return Object.fromEntries(
    everyFeature.map((feature): [FeatureSwitch, SwitchVerdict] => [
      feature,
      inEffect(feature) ? (own.get(feature) ?? { on: false }) : { on: false },
    ]),
  ) as Record<FeatureSwitch, SwitchVerdict>;
}
