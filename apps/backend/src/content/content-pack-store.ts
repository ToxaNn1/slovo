import type { ContentPackStore } from '@slovo/server-core';
import { and, desc, eq } from 'drizzle-orm';

import type { Database } from '../database/database';
import { contentPacks } from '../database/schema';

/** The published Language Packs, kept in the `content_packs` table. */
export function createContentPackStore({ db }: Database): ContentPackStore {
  return {
    async latest(editionId, packFormat) {
      const [pack] = await db
        .select({
          contentVersion: contentPacks.contentVersion,
          packFormat: contentPacks.packFormat,
          size: contentPacks.size,
          fileSha256: contentPacks.fileSha256,
        })
        .from(contentPacks)
        .where(and(eq(contentPacks.editionId, editionId), eq(contentPacks.packFormat, packFormat)))
        .orderBy(desc(contentPacks.contentVersion))
        .limit(1);
      return pack;
    },
  };
}
