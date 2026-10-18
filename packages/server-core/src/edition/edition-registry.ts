import {
  FeatureSwitchesSchema,
  type EditionConfig,
  type EditionStrings,
  type FeatureSwitch,
} from '@slovo/contracts';

import type { Clock, RemoteSwitchStore } from '../ports';

/** An Edition as the backend serves it: its config, strings and content manifest, read from its folder. */
export interface Edition {
  readonly config: EditionConfig;
  readonly strings: EditionStrings;
  /**
   * The content version the Edition records, with the content checksum of
   * the pack built at it (ADR 0011); no checksum until the content is first
   * recorded.
   */
  readonly manifest: {
    readonly contentVersion: number;
    readonly contentChecksum?: string | undefined;
  };
}

/** What a request for an Edition the backend didn't find gets. */
interface UnknownEdition {
  readonly ok: false;
  readonly reason: 'unknown-edition';
}

/**
 * Why an Edition doesn't serve a feature: the backend didn't find the
 * Edition, or the feature is switched off, in the Edition or remotely.
 */
export interface NotServing {
  readonly ok: false;
  readonly reason: 'unknown-edition' | 'switched-off';
}

/**
 * Why a remote switch is not set: the backend didn't find the Edition, or
 * the Feature Switches schema of the contracts doesn't know the feature.
 */
export type SwitchRefusal = 'unknown-edition' | 'unknown-feature';

/** Why a remote switch is not set, as `SwitchRefusal` names it. */
interface SwitchRefused {
  readonly ok: false;
  readonly reason: SwitchRefusal;
}

/** The features turned off remotely in an Edition, in name order. */
interface RemoteSwitches {
  readonly ok: true;
  readonly off: readonly FeatureSwitch[];
}

/**
 * Every Edition the backend serves: the ones it found in the Edition folders
 * at start (ADR 0030), with the Feature Switches the owner turned off
 * remotely (ADR 0040). A new Edition folder is enough to be served.
 */
export interface EditionRegistry {
  /** The Edition with the id, or none when the backend didn't find it. */
  find(editionId: string): Edition | undefined;
  /**
   * The Edition with the id when it serves the feature: the backend found it,
   * its Feature Switch for the feature is on, as it is in the app, and the
   * feature is not turned off remotely.
   */
  serving(
    editionId: string,
    feature: FeatureSwitch,
  ): Promise<{ readonly ok: true; readonly edition: Edition } | NotServing>;
  /** The features turned off remotely in the Edition. */
  remoteSwitches(editionId: string): Promise<RemoteSwitches | UnknownEdition>;
  /**
   * Turns the feature off in the Edition remotely, and answers the features
   * off now. A feature already off stays off.
   */
  switchOff(editionId: string, feature: string): Promise<RemoteSwitches | SwitchRefused>;
  /**
   * Clears the remote switch of the feature in the Edition, so the Edition's
   * own switch decides again, and answers the features off now.
   */
  clearSwitch(editionId: string, feature: string): Promise<RemoteSwitches | SwitchRefused>;
}

const FeatureSwitchSchema = FeatureSwitchesSchema.keyof();

/** Whether the Feature Switches schema of the contracts knows the name. */
function isFeatureSwitch(name: string): name is FeatureSwitch {
  return FeatureSwitchSchema.safeParse(name).success;
}

/** The features of the names the schema knows, in name order. */
function knownInNameOrder(features: readonly string[]): FeatureSwitch[] {
  return features.filter(isFeatureSwitch).sort();
}

export function createEditionRegistry({
  editions,
  switchStore,
  clock,
}: {
  editions: readonly Edition[];
  switchStore: RemoteSwitchStore;
  clock: Clock;
}): EditionRegistry {
  const byId = new Map(editions.map((edition) => [edition.config.id, edition]));
  const unknownEdition: UnknownEdition = { ok: false, reason: 'unknown-edition' };

  async function setSwitch(editionId: string, feature: string, off: boolean) {
    if (!byId.has(editionId)) return unknownEdition;
    if (!isFeatureSwitch(feature)) return { ok: false, reason: 'unknown-feature' } as const;
    await switchStore.set(editionId, feature, off, clock.now());
    return { ok: true, off: knownInNameOrder(await switchStore.off(editionId)) } as const;
  }

  return {
    find: (editionId) => byId.get(editionId),

    async serving(editionId, feature) {
      const edition = byId.get(editionId);
      if (edition === undefined) return unknownEdition;
      // The Edition's own switch needs no store.
      if (!edition.config.featureSwitches[feature]) return { ok: false, reason: 'switched-off' };
      if ((await switchStore.off(editionId)).includes(feature)) {
        return { ok: false, reason: 'switched-off' };
      }
      return { ok: true, edition };
    },

    async remoteSwitches(editionId) {
      if (!byId.has(editionId)) return unknownEdition;
      return { ok: true, off: knownInNameOrder(await switchStore.off(editionId)) };
    },

    switchOff: (editionId, feature) => setSwitch(editionId, feature, true),

    clearSwitch: (editionId, feature) => setSwitch(editionId, feature, false),
  };
}
