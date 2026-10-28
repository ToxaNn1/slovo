import type { CollectionLinkStore } from '@slovo/server-core';
import { eq } from 'drizzle-orm';

import type { Database } from '../database/database';
import { collectionLinks } from '../database/schema';

/** The Collection Links, kept in the `collection_links` table and never updated. */
export function createCollectionLinkStore({ db }: Database): CollectionLinkStore {
  return {
    async keep(id, link) {
      const kept = await db
        .insert(collectionLinks)
        .values({
          id,
          editionId: link.edition,
          name: link.name,
          entryIds: [...link.entryIds],
          createdAt: link.createdAt,
        })
        .onConflictDoNothing()
        .returning({ id: collectionLinks.id });
      return kept.length > 0;
    },
    async find(id) {
      const [row] = await db.select().from(collectionLinks).where(eq(collectionLinks.id, id));
      if (row === undefined) return undefined;
      const { editionId, name, entryIds, createdAt } = row;
      return { edition: editionId, name, entryIds, createdAt };
    },
  };
}
