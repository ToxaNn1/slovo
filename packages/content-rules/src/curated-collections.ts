import type { CuratedCollection, Entry } from '@slovo/contracts';

import type { Authored, Refusal } from './refusal';

/**
 * The checks the schema can't make on one Curated Collection alone (ADR 0076):
 * every Entry it names is authored and not Retired, and no two files share a
 * collection id.
 */
export function checkCuratedCollections(
  collections: readonly Authored<CuratedCollection>[],
  entries: readonly Authored<Entry>[],
): Refusal[] {
  const errors: Refusal[] = [];
  const retiredById = new Map(entries.map(({ entry }) => [entry.id, entry.retired]));
  const fileById = new Map<string, string>();

  for (const { file, entry: collection } of collections) {
    const first = fileById.get(collection.id);
    if (first === undefined) {
      fileById.set(collection.id, file);
    } else {
      const message = `Duplicate Curated Collection id: also in ${first}`;
      errors.push({ rule: 'duplicate-id', file, entryId: collection.id, field: 'id', message });
    }
    collection.entryIds.forEach((entryId, position) => {
      const retired = retiredById.get(entryId);
      const field = `entryIds.${String(position)}`;
      if (retired === undefined) {
        const message = `No Entry ${entryId} in this Edition`;
        errors.push({ rule: 'curated-collection-entry', file, entryId: collection.id, field, message });
      } else if (retired) {
        const message = `${entryId} is a Retired Entry: a Curated Collection names live Entries only`;
        errors.push({ rule: 'curated-collection-entry', file, entryId: collection.id, field, message });
      }
    });
  }
  return errors;
}
