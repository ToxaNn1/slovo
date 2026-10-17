import type { ContentPackStore } from '@slovo/server-core';
import { and, desc, eq, sql } from 'drizzle-orm';

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

    async file(editionId, contentVersion) {
      const [file] = await db
        .select({ fileSha256: contentPacks.fileSha256, bytes: contentPacks.bytes })
        .from(contentPacks)
        .where(
          and(
            eq(contentPacks.editionId, editionId),
            eq(contentPacks.contentVersion, contentVersion),
          ),
        );
      return file;
    },

    publish(pack, refuse) {
      const { metadata } = pack;
      return db.transaction(async (tx) => {
        // Publishing an Edition's packs runs one at a time until the commit, so
        // no other comes between the check and the insert.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${metadata.editionId}))`);
        const published = await tx
          .select({ contentVersion: contentPacks.contentVersion })
          .from(contentPacks)
          .where(eq(contentPacks.editionId, metadata.editionId));
        const refusal = refuse(published.map((row) => row.contentVersion));
        if (refusal !== undefined) return refusal;
        await tx.insert(contentPacks).values({
          editionId: metadata.editionId,
          contentVersion: metadata.contentVersion,
          packFormat: metadata.packFormat,
          contentChecksum: metadata.contentChecksum,
          fileSha256: pack.fileSha256,
          size: pack.bytes.byteLength,
          bytes: pack.bytes,
          publishedAt: pack.publishedAt,
        });
        return undefined;
      });
    },
  };
}
