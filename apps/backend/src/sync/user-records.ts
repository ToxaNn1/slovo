import type { UserRecords } from '@slovo/server-core';
import { and, asc, count, eq, gt, inArray, sql, type Column } from 'drizzle-orm';

import type { Database } from '../database/database';
import { accounts, userRecords } from '../database/schema';

/** The column's value in the row an insert proposed, in its `ON CONFLICT DO UPDATE`. */
const excluded = (column: Column) => sql`excluded.${sql.identifier(column.name)}`;

/** The records Sync keeps, in the `user_records` table. */
export function createUserRecords({ db }: Database): UserRecords {
  return {
    async push(accountId, editionId, changes, refuse) {
      if (changes.length === 0) return undefined;
      return db.transaction(async (tx) => {
        // The Account's row holds back its other pushes until this one
        // commits, so its kept changes take their sequence numbers in the
        // order they become visible, and a pull never passes one still
        // being kept. An Account deleted meanwhile has no row.
        const [account] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.id, accountId))
          .for('no key update');
        if (account === undefined) return undefined;
        // A change of a key kept replaces its record; any other adds one.
        const replacing = inArray(
          userRecords.key,
          changes.map(({ key }) => key),
        );
        const [kept] = await tx
          .select({
            records: count(),
            replaced: sql<number>`count(*) filter (where ${replacing})`.mapWith(Number),
          })
          .from(userRecords)
          .where(and(eq(userRecords.accountId, accountId), eq(userRecords.editionId, editionId)));
        const refusal = refuse((kept?.records ?? 0) + changes.length - (kept?.replaced ?? 0));
        if (refusal !== undefined) return refusal;
        await tx
          .insert(userRecords)
          .values(
            changes.map(({ key, value, changedAt }) => ({
              accountId,
              editionId,
              key,
              value,
              changedAt,
            })),
          )
          .onConflictDoUpdate({
            target: [userRecords.accountId, userRecords.editionId, userRecords.key],
            set: {
              value: excluded(userRecords.value),
              changedAt: excluded(userRecords.changedAt),
              sequence: sql`default`,
            },
            // Only a later change replaces the record kept; a tie keeps it.
            setWhere: sql`${userRecords.changedAt} < ${excluded(userRecords.changedAt)}`,
          });
        return undefined;
      });
    },

    after(accountId, editionId, sequence, limit) {
      return db
        .select({
          key: userRecords.key,
          value: userRecords.value,
          changedAt: userRecords.changedAt,
          sequence: userRecords.sequence,
        })
        .from(userRecords)
        .where(
          and(
            eq(userRecords.accountId, accountId),
            eq(userRecords.editionId, editionId),
            gt(userRecords.sequence, sequence),
          ),
        )
        .orderBy(asc(userRecords.sequence))
        .limit(limit);
    },
  };
}
