import type { CounterStore } from '@slovo/server-core';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../database/database';
import { communityCounters, favoritesAdds } from '../database/schema';

/**
 * The Community Counters of every Edition and Entry, kept in the
 * `community_counters` table, and their Favorites adds of each ISO week, in
 * `favorites_adds`.
 */
export function createCounterStore({ db }: Database): CounterStore {
  return {
    async add(editionId, events, week) {
      const deltas = sql.join(
        events.map(
          ({ entryId, known, unknown, saved }) =>
            sql`(${entryId}::text, ${known}::integer, ${unknown}::integer, ${saved}::integer)`,
        ),
        sql`, `,
      );
      const { known, unknown, saved } = communityCounters;
      // An Entry is named once in a batch, so each saved +1 is one add.
      const added = events.filter(({ saved }) => saved === 1);
      // One transaction, so a batch is counted whole or not at all: a row of
      // zeros for each Entry not counted yet, then each delta added, no count
      // going below zero, then the week's adds.
      await db.transaction(async (tx) => {
        await tx
          .insert(communityCounters)
          .values(events.map(({ entryId }) => ({ editionId, entryId })))
          .onConflictDoNothing();
        await tx.execute(sql`
          update ${communityCounters}
          set ${sql.identifier(known.name)} = greatest(0, ${known} + deltas.known),
              ${sql.identifier(unknown.name)} = greatest(0, ${unknown} + deltas.unknown),
              ${sql.identifier(saved.name)} = greatest(0, ${saved} + deltas.saved)
          from (values ${deltas}) as deltas (entry_id, known, unknown, saved)
          where ${communityCounters.editionId} = ${editionId}
            and ${communityCounters.entryId} = deltas.entry_id`);
        if (added.length === 0) return;
        await tx
          .insert(favoritesAdds)
          .values(added.map(({ entryId }) => ({ editionId, week, entryId, adds: 1 })))
          .onConflictDoUpdate({
            target: [favoritesAdds.editionId, favoritesAdds.week, favoritesAdds.entryId],
            set: { adds: sql`${favoritesAdds.adds} + 1` },
          });
      });
    },

    async read(editionId, entryIds) {
      const { entryId, known, unknown, saved } = communityCounters;
      return db
        .select({ entryId, known, unknown, saved })
        .from(communityCounters)
        .where(and(eq(communityCounters.editionId, editionId), inArray(entryId, [...entryIds])));
    },
  };
}
