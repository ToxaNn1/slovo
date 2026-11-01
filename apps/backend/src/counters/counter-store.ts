import type { CounterStore } from '@slovo/server-core';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../database/database';
import { communityCounters, favoritesAdds, questionnaireCounters } from '../database/schema';

/**
 * The Community Counters of every Edition and Entry, kept in the
 * `community_counters` table, and their Favorites adds of each ISO week, in
 * `favorites_adds`, and the count of each questionnaire answer, in
 * `questionnaire_counters`.
 */
export function createCounterStore({ db }: Database): CounterStore {
  return {
    async add(editionId, events, week) {
      // Every batch writes its Entries in the order of their ids, so two
      // batches with the same Entries never wait on each other in a circle.
      const sorted = [...events].sort((a, b) => (a.entryId < b.entryId ? -1 : 1));
      const entryIds = sorted.map(({ entryId }) => entryId);
      const deltas = sql.join(
        sorted.map(
          ({ entryId, known, unknown, saved }) =>
            sql`(${entryId}::text, ${known}::integer, ${unknown}::integer, ${saved}::integer)`,
        ),
        sql`, `,
      );
      const { known, unknown, saved } = communityCounters;
      // An Entry is named once in a batch, so each saved +1 is one add.
      const added = sorted.filter(({ saved }) => saved === 1);
      // One transaction, so a batch is counted whole or not at all: a row of
      // zeros for each Entry not counted yet, its rows locked in order, then
      // each delta added, no count going below zero, then the week's adds.
      await db.transaction(async (tx) => {
        await tx
          .insert(communityCounters)
          .values(entryIds.map((entryId) => ({ editionId, entryId })))
          .onConflictDoNothing();
        // An update takes its rows in an order of the plan's choosing, so the
        // rows are locked first, in the order of the ids ("C" compares code
        // points, as the sort above does for these ids).
        await tx
          .select({ entryId: communityCounters.entryId })
          .from(communityCounters)
          .where(
            and(
              eq(communityCounters.editionId, editionId),
              inArray(communityCounters.entryId, entryIds),
            ),
          )
          .orderBy(sql`${communityCounters.entryId} collate "C"`)
          .for('update');
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

    async mostAdded(editionId, week) {
      const [mostAdded] = await db
        .select({ entryId: favoritesAdds.entryId, adds: favoritesAdds.adds })
        .from(favoritesAdds)
        .where(and(eq(favoritesAdds.editionId, editionId), eq(favoritesAdds.week, week)))
        // The "C" collation compares code points, whatever the database's locale.
        .orderBy(desc(favoritesAdds.adds), asc(sql`${favoritesAdds.entryId} collate "C"`))
        .limit(1);
      return mostAdded;
    },

    async addAnswer(editionId, question, answer) {
      await db
        .insert(questionnaireCounters)
        .values({ editionId, question, answer, count: 1 })
        .onConflictDoUpdate({
          target: [
            questionnaireCounters.editionId,
            questionnaireCounters.question,
            questionnaireCounters.answer,
          ],
          set: { count: sql`${questionnaireCounters.count} + 1` },
        });
    },
  };
}
