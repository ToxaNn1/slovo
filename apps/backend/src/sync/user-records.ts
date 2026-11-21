import type { UserRecords } from '@slovo/server-core';
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
  type Column,
} from 'drizzle-orm';

import type { Database } from '../database/database';
import { accounts, userRecords } from '../database/schema';

/** The column's value in the row an insert proposed, in its `ON CONFLICT DO UPDATE`. */
const excluded = (column: Column) => sql`excluded.${sql.identifier(column.name)}`;

/** The records Sync keeps, in the `user_records` table. */
export function createUserRecords({ db }: Database): UserRecords {
  return {
    async push(accountId, editionId, changes, refuse, tombstonesKept) {
      if (changes.length === 0) return undefined;
      const ofAccount = and(
        eq(userRecords.accountId, accountId),
        eq(userRecords.editionId, editionId),
      );
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
        const [kept] = await tx
          .select({ records: count() })
          .from(userRecords)
          .where(and(ofAccount, isNotNull(userRecords.value)));
        const before = new Map(
          (
            await tx
              .select({
                key: userRecords.key,
                tombstone: isNull(userRecords.value).mapWith(Boolean),
                changedAt: userRecords.changedAt,
              })
              .from(userRecords)
              .where(
                and(
                  ofAccount,
                  inArray(
                    userRecords.key,
                    changes.map(({ key }) => key),
                  ),
                ),
              )
          ).map((record) => [record.key, record]),
        );
        // Only a later change is kept: it adds a record in place of none or
        // of a tombstone, and a tombstone in place of a record takes one off.
        let records = kept?.records ?? 0;
        for (const { key, value, changedAt } of changes) {
          const was = before.get(key);
          if (was !== undefined && was.changedAt.getTime() >= changedAt.getTime()) continue;
          records += (value === null ? 0 : 1) - (was === undefined || was.tombstone ? 0 : 1);
        }
        const refusal = refuse(records);
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
        if (changes.some(({ value }) => value === null)) {
          // The latest tombstones stay; the first one past them and all before it go.
          const pastTheKept = tx
            .select({ sequence: userRecords.sequence })
            .from(userRecords)
            .where(and(ofAccount, isNull(userRecords.value)))
            .orderBy(desc(userRecords.sequence))
            .limit(1)
            .offset(tombstonesKept);
          await tx
            .delete(userRecords)
            .where(
              and(
                ofAccount,
                isNull(userRecords.value),
                lte(userRecords.sequence, sql`(${pastTheKept})`),
              ),
            );
        }
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

    ofAccount(accountId) {
      return db
        .select({
          editionId: userRecords.editionId,
          key: userRecords.key,
          value: userRecords.value,
          changedAt: userRecords.changedAt,
          sequence: userRecords.sequence,
        })
        .from(userRecords)
        .where(eq(userRecords.accountId, accountId))
        .orderBy(asc(userRecords.sequence));
    },

    async accountsWithRecords(editionIds) {
      if (editionIds.length === 0) return 0;
      const [row] = await db
        .select({ accounts: countDistinct(userRecords.accountId) })
        .from(userRecords)
        .where(and(inArray(userRecords.editionId, [...editionIds]), isNotNull(userRecords.value)));
      return row?.accounts ?? 0;
    },
  };
}
