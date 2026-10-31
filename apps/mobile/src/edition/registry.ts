import bundled, { type BundledEditionFiles } from 'slovo-editions';

export type { BundledEditionFiles };

/**
 * The Editions the app bundles, by id (ADR 0065): the only place the app
 * learns which Editions it has. Each is read as configuration, content and
 * assets, never named in code.
 */
export interface EditionRegistry {
  /** The ids of the bundled Editions. */
  readonly ids: readonly string[];
  /** The Edition the app opens when the device language has none: the UA Edition. */
  readonly defaultId: string;
  /** The files of a bundled Edition. */
  files(id: string): BundledEditionFiles;
}

/** A registry over bundled Edition files, refusing a default it doesn't hold. */
export function editionRegistry(
  editions: Readonly<Record<string, BundledEditionFiles>>,
  defaultId: string,
): EditionRegistry {
  const files = new Map(Object.entries(editions));
  if (!files.has(defaultId)) {
    throw new Error(`The bundled default Edition "${defaultId}" is not bundled`);
  }
  return {
    ids: [...files.keys()],
    defaultId,
    files(id) {
      const found = files.get(id);
      if (found === undefined) throw new Error(`No Edition "${id}" is bundled`);
      return found;
    },
  };
}

/** The Editions this app bundles. */
export const bundledEditions = editionRegistry(bundled.editions, bundled.defaultId);
