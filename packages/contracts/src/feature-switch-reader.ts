import { FeatureSwitchesSchema, type FeatureSwitch, type FeatureSwitches } from './edition';
import { switchedOn } from './feature-switch-dependencies';
import type { RuleTargets, RuleVerdict } from './feature-switch-rules';

/** A Rule as far as reading it needs: an `order` left out keeps the place it came in. */
export interface ReadableRule {
  readonly id: string;
  readonly feature: string;
  readonly order?: number;
  readonly verdict: RuleVerdict;
  readonly targets: RuleTargets;
}

/** What a feature comes to: off, or on by the Rule that decided, by the Edition's state when none did. */
export type SwitchAnswer<R extends ReadableRule = ReadableRule> =
  { readonly on: false } | { readonly on: true; readonly by: R | undefined };

/**
 * The Rules of one feature in the order they are tried: by `order`, and the
 * order they came in where they carry none, as the app's API sends them.
 */
export function rulesOf<R extends Pick<ReadableRule, 'feature' | 'order'>>(
  rules: readonly R[],
  feature: string,
): R[] {
  return rules
    .filter((rule) => rule.feature === feature)
    .sort((one, other) => (one.order ?? 0) - (other.order ?? 0));
}

/** Whether a Rule's schedule holds at the moment: both ends included, an end left out is open. */
function holdsAt({ schedule }: RuleTargets, now: Date): boolean {
  if (schedule === undefined) return true;
  const at = now.getTime();
  return (
    (schedule.from === undefined || Date.parse(schedule.from) <= at) &&
    (schedule.until === undefined || at <= Date.parse(schedule.until))
  );
}

/** Whether a Rule whose schedule holds matches every reader: no other target named, or a share of 100 alone. */
const matchesEveryone = (targets: RuleTargets) =>
  Object.entries(targets).every(
    ([target, value]) =>
      value === undefined || target === 'schedule' || (target === 'share' && value === 100),
  );

/**
 * The Feature Switches of one Edition read at a moment (ADR 0089), for the
 * device, the backend and the admin alike. Of a feature's Rules in their
 * order, those in force are the ones whose schedule holds and whose share is
 * above 0; the first of them that matches the reader decides, and the search
 * ends at the first that matches every reader. The Edition's state decides
 * when none does. An unavailable feature is never on, and a feature is on
 * only while every switch it depends on is in effect too (ADR 0199).
 */
export function readSwitches<R extends ReadableRule>({
  states,
  rules,
  now,
}: {
  states: FeatureSwitches;
  rules: readonly R[];
  now: Date;
}) {
  const read = new Map(
    FeatureSwitchesSchema.keyof().options.map((feature) => {
      const inForce = rulesOf(rules, feature).filter(
        (rule) => rule.targets.share !== 0 && holdsAt(rule.targets, now),
      );
      const end = inForce.findIndex((rule) => matchesEveryone(rule.targets));
      return [
        feature,
        {
          /** The Rules that single some readers out, tried before the one for everyone. */
          some: end === -1 ? inForce : inForce.slice(0, end),
          everyone: end === -1 ? undefined : inForce[end],
        },
      ];
    }),
  );
  const off: SwitchAnswer<R> = { on: false };

  /** The feature by its own state and Rules, before the switches it depends on. */
  function own(feature: FeatureSwitch, matches: (rule: R) => boolean): SwitchAnswer<R> {
    const state = states[feature];
    const { some = [], everyone } = read.get(feature) ?? {};
    if (state === 'unavailable') return off;
    const by = some.find((rule) => matches(rule)) ?? everyone;
    if (by === undefined) return state === 'on' ? { on: true, by } : off;
    return by.verdict === 'off' ? off : { on: true, by };
  }

  /** What a reader gets, `matches` telling whether a Rule in force that singles readers out targets this one. */
  function forReader(matches: (rule: R) => boolean) {
    const inEffect = switchedOn((feature) => own(feature, matches).on);
    return (feature: FeatureSwitch): SwitchAnswer<R> =>
      inEffect(feature) ? own(feature, matches) : off;
  }

  const onForAnyone = switchedOn((feature) => {
    if (states[feature] === 'unavailable') return false;
    const { some = [] } = read.get(feature) ?? {};
    return some.some((rule) => rule.verdict !== 'off') || own(feature, () => false).on;
  });

  return {
    forReader,
    /**
     * Whether the feature is on for any reader, as far as one can tell
     * without a reader's facts: by a Rule in force that turns it on for
     * some, or for the rest, and with every switch it depends on likewise.
     */
    onForAnyone,
    /** What the readers no Rule singles out get: the Rule in force for every reader, else the Edition's state. */
    forTheRest: forReader(() => false),
    /** The first Rule in force that matches every reader, where the search of the feature's Rules ends. */
    everyoneRule: (feature: FeatureSwitch): R | undefined => read.get(feature)?.everyone,
  };
}
