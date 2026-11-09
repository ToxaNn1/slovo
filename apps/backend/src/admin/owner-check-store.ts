import type { OwnerCheck, OwnerCheckStore } from '@slovo/server-core';
import { and, asc, count, eq, isNull } from 'drizzle-orm';

import type { Database } from '../database/database';
import { ownerChecks } from '../database/schema';

/** The Owner checks in their own table (ADR 0088). */
export function createOwnerCheckStore({ db }: Database): OwnerCheckStore {
  const checkOf = (row: typeof ownerChecks.$inferSelect): OwnerCheck => ({
    id: row.id,
    version: row.version,
    text: row.text,
    addedBy: row.addedBy,
    addedAt: row.addedAt,
    ticked:
      row.tickedAt === null || row.tickedBy === null
        ? null
        : { at: row.tickedAt, by: row.tickedBy },
  });

  return {
    list: (version) =>
      db
        .select()
        .from(ownerChecks)
        .where(version === undefined ? undefined : eq(ownerChecks.version, version))
        .orderBy(asc(ownerChecks.id))
        .then((rows) => rows.map(checkOf)),
    async add(rows) {
      if (rows.length === 0) return [];
      const added = await db
        .insert(ownerChecks)
        .values(
          rows.map((row) => ({
            version: row.version,
            text: row.text,
            addedBy: row.addedBy,
            addedAt: row.addedAt,
            tickedAt: row.ticked?.at ?? null,
            tickedBy: row.ticked?.by ?? null,
          })),
        )
        .returning();
      return added.map(checkOf);
    },
    async tick(id, tick) {
      const ticked = await db
        .update(ownerChecks)
        .set({ tickedAt: tick.at, tickedBy: tick.by })
        .where(and(eq(ownerChecks.id, id), isNull(ownerChecks.tickedAt)))
        .returning({ id: ownerChecks.id });
      if (ticked.length > 0) return 'ticked';
      const [known] = await db
        .select({ id: ownerChecks.id })
        .from(ownerChecks)
        .where(eq(ownerChecks.id, id));
      return known ? 'already' : 'unknown';
    },
    count: () =>
      db
        .select({ n: count() })
        .from(ownerChecks)
        .then(([row]) => row?.n ?? 0),
  };
}
