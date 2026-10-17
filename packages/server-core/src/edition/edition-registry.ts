import type { EditionConfig, EditionStrings } from '@slovo/contracts';

/** An Edition as the backend serves it: its config and strings, read from its folder. */
export interface Edition {
  readonly config: EditionConfig;
  readonly strings: EditionStrings;
}

/**
 * Every Edition the backend serves: the ones it found in the Edition folders
 * at start (ADR 0030). A new Edition folder is enough to be served.
 */
export interface EditionRegistry {
  /** The Edition with the id, or none when the backend didn't find it. */
  find(editionId: string): Edition | undefined;
}

export function createEditionRegistry(editions: readonly Edition[]): EditionRegistry {
  const byId = new Map(editions.map((edition) => [edition.config.id, edition]));
  return { find: (editionId) => byId.get(editionId) };
}
