import type { CounterStore } from '@slovo/server-core';
import { sql } from 'drizzle-orm';

import type { Database } from '../database/database';
import { communityCounters } from '../database/schema';

/** The Community Counters of every Edition and Entry, kept in the `community_counters` table. */
export function createCounterStore({ db }: Database): CounterStore {
  return {
    async add(editionId, events) {
      const deltas = sql.join(
        events.map(
          ({ entryId, known, unknown, saved }) =>
            sql`(${entryId}::text, ${known}::integer, ${unknown}::integer, ${saved}::integer)`,
        ),
        sql`, `,
      );
      const { known, unknown, saved } = communityCounters;
      // One transaction, so a batch is counted whole or not at all: a row of
      // zeros for each Entry not counted yet, then each delta added, no count
      // going below zero.
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
      });
    },
  };
}
