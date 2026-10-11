import { CorrectionIdSchema, WordIdSchema, type Entry } from '@slovo/contracts';
import { z } from 'zod';

import type { BuildError } from './build-error';
import type { Authored } from './check-content';

/** Every Entry id the Edition ever issued, oldest first. */
export const ID_REGISTRY_FILE = 'content/ids.json';

/**
 * The append-only id registry of an Edition. Once an id is issued it stays
 * listed and its Entry stays in the content, retired if need be, so no other
 * Entry can take the id over from the users' Favorites and History.
 */
export const IdRegistrySchema = z
  .array(z.union([WordIdSchema, CorrectionIdSchema]))
  .refine((ids) => new Set(ids).size === ids.length, 'Ids must not repeat');

/** The folder that holds the Entry with the given id. */
export function entryFolderOf(id: string): string {
  return id.startsWith('w_') ? 'content/words' : 'content/corrections';
}

/** A known id whose Entry file is gone, so its id could be issued again. */
export function missingEntryErrors(
  registry: readonly string[],
  hasFile: (file: string) => boolean,
): BuildError[] {
  return registry.flatMap((id) => {
    const file = `${entryFolderOf(id)}/${id}.json`;
    if (hasFile(file)) return [];
    return [
      {
        file: ID_REGISTRY_FILE,
        entryId: id,
        message: `No file ${file} for this known id: ids are never reused, so retire a Word instead of deleting it`,
      },
    ];
  });
}

/**
 * The Entries whose ids the registry doesn't list yet, in the order given.
 * An Entry in a file named after another id is left out: that file is
 * already an error.
 */
export function unregisteredEntries(
  entries: readonly Authored<Entry>[],
  registry: readonly string[],
): Authored<Entry>[] {
  const known = new Set(registry);
  return entries.filter(
    ({ file, entry }) => file.endsWith(`/${entry.id}.json`) && !known.has(entry.id),
  );
}
