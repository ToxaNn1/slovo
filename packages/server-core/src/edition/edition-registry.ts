import type { EditionConfig, EditionStrings, FeatureSwitch } from '@slovo/contracts';

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

/**
 * Why an Edition doesn't serve a feature: the backend didn't find the
 * Edition, or the Edition switches the feature off.
 */
export interface NotServing {
  readonly ok: false;
  readonly reason: 'unknown-edition' | 'switched-off';
}

/**
 * Every Edition the backend serves: the ones it found in the Edition folders
 * at start (ADR 0030). A new Edition folder is enough to be served.
 */
export interface EditionRegistry {
  /** The Edition with the id, or none when the backend didn't find it. */
  find(editionId: string): Edition | undefined;
  /**
   * The Edition with the id when it serves the feature: the backend found it
   * and its Feature Switch for the feature is on, as it is in the app.
   */
  serving(
    editionId: string,
    feature: FeatureSwitch,
  ): { readonly ok: true; readonly edition: Edition } | NotServing;
}

export function createEditionRegistry(editions: readonly Edition[]): EditionRegistry {
  const byId = new Map(editions.map((edition) => [edition.config.id, edition]));
  return {
    find: (editionId) => byId.get(editionId),
    serving(editionId, feature) {
      const edition = byId.get(editionId);
      if (edition === undefined) return { ok: false, reason: 'unknown-edition' };
      if (!edition.config.featureSwitches[feature]) return { ok: false, reason: 'switched-off' };
      return { ok: true, edition };
    },
  };
}
