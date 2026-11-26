import {
  DEPENDS_ON,
  FeatureSwitchesSchema,
  readSwitches,
  rulesOf,
  type EditionConfig,
  type EditionStrings,
  type FeatureSwitch,
  type FeatureSwitches,
  type ForceUpdateMinimum,
  type ForceUpdateMinimums,
  type Platform,
  type Rule,
  type RuleTargets,
  type RuleVerdict,
} from '@slovo/contracts';

import type { ActionEntry, Actor } from '../admin/admin-access';
import type { Alerts } from '../admin/alerts';
import type { Clock, Json, SwitchRuleStore } from '../ports';

/** An Edition as the backend serves it: its config, content targets included, and strings, read from its folder. */
export interface Edition {
  readonly config: EditionConfig;
  readonly strings: EditionStrings;
}

/** What a request for an Edition the backend didn't find gets. */
interface UnknownEdition {
  readonly ok: false;
  readonly reason: 'unknown-edition';
}

/**
 * Why an Edition doesn't serve a feature: the backend didn't find the
 * Edition, or the feature is off for every reader, by the Edition's state
 * and its Rules (ADR 0089).
 */
export interface NotServing {
  readonly ok: false;
  readonly reason: 'unknown-edition' | 'switched-off';
}

/**
 * Why a write of the switches is refused: the backend didn't find the
 * Edition, the Feature Switches schema of the contracts doesn't know the
 * feature, the Edition has it `unavailable`, or a switch it depends on is
 * off for every reader (ADR 0089).
 */
export type SwitchRefusal =
  'unknown-edition' | 'unknown-feature' | 'unavailable-feature' | 'dependency-off';

/** A refused write of the switches, with the feature it names. */
export interface SwitchRefused {
  readonly ok: false;
  readonly reason: SwitchRefusal;
  /** The feature written, or the switch it depends on that is off for everyone. */
  readonly feature: string;
}

/** The Rules of an Edition, by feature name and then order, and its force-update minimums. */
export interface EditionSwitches {
  readonly ok: true;
  /** What the Edition declares of each feature, before any Rule. */
  readonly states: FeatureSwitches;
  readonly rules: readonly Rule[];
  /** The features the Edition turns on and the Rules turn off for everyone, for an app that reads no Rule. */
  readonly off: readonly FeatureSwitch[];
  readonly minimums: ForceUpdateMinimums;
}

/** A Rule as the admin writes it: its place in the list is its order. */
export interface RuleInput {
  readonly id: string;
  readonly verdict: RuleVerdict;
  readonly targets: RuleTargets;
}

/** Who writes and why, for the Action log. */
export interface WriteBy {
  readonly who: Actor;
  readonly reason: string;
}

/**
 * Every Edition the backend serves: the ones it found in the Edition folders
 * at start (ADR 0030), with the Rules and force-update minimums the owner
 * sets remotely (ADR 0089). Every write is logged with before and after.
 */
export interface EditionRegistry {
  /** The Edition by its id, if the backend serves it. */
  find(editionId: string): Edition | undefined;
  /** The ids of every Edition the backend serves. */
  ids(): readonly string[];
  /**
   * The Edition, when it serves the feature: on for any reader by the
   * Edition's state or a Rule, and every switch it depends on too. Only a
   * feature off for everyone is `switched-off`. Read per request.
   */
  serving(
    editionId: string,
    feature: FeatureSwitch,
  ): Promise<{ readonly ok: true; readonly edition: Edition } | NotServing>;
  /** The Rules and force-update minimums of the Edition. */
  switches(editionId: string): Promise<EditionSwitches | UnknownEdition>;
  /** Replaces the Rules of one feature of the Edition with these, tried in their order. */
  setRules(
    editionId: string,
    feature: string,
    rules: readonly RuleInput[],
    by: WriteBy,
  ): Promise<EditionSwitches | SwitchRefused>;
  /** Sets the force-update minimums of one platform of the Edition. */
  setMinimum(
    editionId: string,
    platform: Platform,
    minimum: ForceUpdateMinimum,
    by: WriteBy,
  ): Promise<EditionSwitches | SwitchRefused>;
  /**
   * The Kill switch: the feature off for every reader of the Edition, or of
   * every Edition when none is named, over every Rule. Answers the Editions
   * it turned it off in.
   */
  kill(
    feature: string,
    editionId: string | undefined,
    by: WriteBy,
  ): Promise<{ readonly ok: true; readonly editionIds: readonly string[] } | SwitchRefused>;
}

const FeatureSwitchSchema = FeatureSwitchesSchema.keyof();

/** Whether the Feature Switches schema of the contracts knows the name. */
function isFeatureSwitch(name: string): name is FeatureSwitch {
  return FeatureSwitchSchema.safeParse(name).success;
}

/** A value as the Action log keeps it: its JSON, undefined fields left out. */
function asJson(value: unknown): Json {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item: unknown) => asJson(item));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, field]) => field !== undefined)
        .map(([key, field]) => [key, asJson(field)]),
    );
  }
  return null;
}

export function createEditionRegistry({
  editions,
  switchStore,
  clock,
  log,
  alerts,
}: {
  editions: readonly Edition[];
  switchStore: SwitchRuleStore;
  clock: Clock;
  /** Appends a change to the Action log (ADR 0088). */
  log: (entry: ActionEntry) => Promise<void>;
  /** Tells the owner of every Kill switch. */
  alerts: Alerts;
}): EditionRegistry {
  const byId = new Map(editions.map((edition) => [edition.config.id, edition]));
  const unknownEdition: UnknownEdition = { ok: false, reason: 'unknown-edition' };
  const refused = (reason: SwitchRefusal, feature: string): SwitchRefused => ({
    ok: false,
    reason,
    feature,
  });

  /**
   * The Edition's switches read at the moment: the backend holds a feature on
   * while it is on for any reader, as it can tell without device facts.
   */
  const reading = (edition: Edition, rules: readonly Rule[]) =>
    readSwitches({ states: edition.config.featureSwitches, rules, now: clock.now() });

  async function switches(edition: Edition): Promise<EditionSwitches> {
    const editionId = edition.config.id;
    const [rules, minimums] = await Promise.all([
      switchStore.rules(editionId),
      switchStore.minimums(editionId),
    ]);
    const { onForAnyone } = reading(edition, rules);
    // As `/v1` first answered it: what the Edition turns on and the owner turned off.
    const off = FeatureSwitchSchema.options.filter(
      (feature) => edition.config.featureSwitches[feature] === 'on' && !onForAnyone(feature),
    );
    return { ok: true, states: edition.config.featureSwitches, rules, off, minimums };
  }

  /** Writes the Rules of one feature and logs the change. */
  async function writeRules(
    editionId: string,
    feature: FeatureSwitch,
    rules: readonly RuleInput[],
    what: string,
    { who, reason }: WriteBy,
  ) {
    const before = rulesOf(await switchStore.rules(editionId), feature);
    const after: Rule[] = rules.map((rule, order) => ({ ...rule, editionId, feature, order }));
    await switchStore.setRules(editionId, feature, after, clock.now());
    await log({
      who,
      what,
      before: asJson(before),
      after: asJson(after),
      reason,
      editionId,
      batchId: null,
    });
  }

  return {
    find: (editionId) => byId.get(editionId),
    ids: () => [...byId.keys()],

    async serving(editionId, feature) {
      const edition = byId.get(editionId);
      if (edition === undefined) return unknownEdition;
      const { onForAnyone } = reading(edition, await switchStore.rules(editionId));
      return onForAnyone(feature) ? { ok: true, edition } : { ok: false, reason: 'switched-off' };
    },

    async switches(editionId) {
      const edition = byId.get(editionId);
      return edition === undefined ? unknownEdition : switches(edition);
    },

    async setRules(editionId, feature, rules, by) {
      const edition = byId.get(editionId);
      if (edition === undefined) return refused('unknown-edition', editionId);
      if (!isFeatureSwitch(feature)) return refused('unknown-feature', feature);
      if (rules.length > 0) {
        if (edition.config.featureSwitches[feature] === 'unavailable') {
          return refused('unavailable-feature', feature);
        }
        // Rules that only turn the feature off need no switch it depends on.
        if (rules.some((rule) => rule.verdict !== 'off')) {
          const { onForAnyone } = reading(edition, await switchStore.rules(editionId));
          const off = (DEPENDS_ON[feature] ?? []).find((dependency) => !onForAnyone(dependency));
          if (off !== undefined) return refused('dependency-off', off);
        }
      }
      await writeRules(editionId, feature, rules, 'switches.rules.set', by);
      return switches(edition);
    },

    async setMinimum(editionId, platform, minimum, { who, reason }) {
      const edition = byId.get(editionId);
      if (edition === undefined) return refused('unknown-edition', editionId);
      const before = (await switchStore.minimums(editionId))[platform];
      await switchStore.setMinimum(editionId, platform, minimum, clock.now());
      await log({
        who,
        what: 'switches.minimum.set',
        before: asJson({ platform, minimum: before }),
        after: asJson({ platform, minimum }),
        reason,
        editionId,
        batchId: null,
      });
      return switches(edition);
    },

    async kill(feature, editionId, by) {
      if (editionId !== undefined && !byId.has(editionId)) {
        return refused('unknown-edition', editionId);
      }
      if (!isFeatureSwitch(feature)) return refused('unknown-feature', feature);
      // An Edition without the feature has nothing to turn off.
      const editionIds = (editionId === undefined ? [...byId.keys()] : [editionId]).filter(
        (id) => byId.get(id)?.config.featureSwitches[feature] !== 'unavailable',
      );
      if (editionIds.length === 0) return refused('unavailable-feature', feature);
      for (const id of editionIds) {
        // One Rule off for everyone in place of every Rule; the log keeps those.
        await writeRules(
          id,
          feature,
          [{ id: 'kill', verdict: 'off', targets: {} }],
          'switches.kill',
          by,
        );
      }
      await alerts.send({ kind: 'kill-switch', feature, editionIds, ...by });
      return { ok: true, editionIds };
    },
  };
}
