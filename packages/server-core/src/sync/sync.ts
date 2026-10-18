import { SYNC_BATCH_SIZE } from '@slovo/contracts';

import type { Session } from '../account/accounts';
import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, Json, RecordChange, UserRecords } from '../ports';

/** A change of a record as a device pushes it and a pull answers it. */
export interface SyncChange {
  readonly key: string;
  /** The record's value as JSON; null for a tombstone. */
  readonly value: Json;
  /** When the device wrote the change, in milliseconds since 1970-01-01 UTC. */
  readonly changedAt: number;
}

/** A page of the records kept after a cursor. */
export interface SyncPage {
  readonly records: readonly SyncChange[];
  /** The cursor to ask after next: the last record's, or the one asked after when none came. */
  readonly cursor: number;
  /** Whether more records follow the cursor. */
  readonly more: boolean;
}

/**
 * Sync on the backend: it keeps each record of an Account's user state in an
 * Edition as a device sends it, and the later change time wins (ADR 0041).
 * Both actions take the Session the gate opened, so they act on its own
 * Account only, and are refused in an Edition that doesn't serve the Account
 * and Sync.
 */
export interface Sync {
  /**
   * Keeps each change that is later than the record kept under its key. A
   * change time later than the server's own time counts as the server's
   * time, so a device with a fast clock can't win every conflict; a tie
   * keeps the record kept. Of two changes of one key, the later is pushed,
   * the first on a tie. A change that is not later is ignored.
   */
  push(
    session: Session,
    editionId: string,
    changes: readonly SyncChange[],
  ): Promise<{ readonly ok: true } | NotServing>;
  /**
   * The records kept after the cursor, from the first without one, in the
   * order they were kept: at most `limit`, and at most a page of
   * `SYNC_BATCH_SIZE`.
   */
  pull(
    session: Session,
    editionId: string,
    page: { readonly after?: number | undefined; readonly limit?: number | undefined },
  ): Promise<({ readonly ok: true } & SyncPage) | NotServing>;
}

/** Whether the Edition serves Sync: it serves the Account, and Sync on top of it. */
async function servingSync(editions: EditionRegistry, editionId: string) {
  const account = await editions.serving(editionId, 'account');
  if (!account.ok) return account;
  return editions.serving(editionId, 'sync');
}

/** The change of each key that wins, in the order the keys first came: the later, the first on a tie. */
function latestOfEachKey(changes: readonly SyncChange[]): SyncChange[] {
  const byKey = new Map<string, SyncChange>();
  for (const change of changes) {
    const kept = byKey.get(change.key);
    if (kept === undefined || change.changedAt > kept.changedAt) byKey.set(change.key, change);
  }
  return [...byKey.values()];
}

export function createSync({
  editions,
  records,
  clock,
}: {
  editions: EditionRegistry;
  records: UserRecords;
  clock: Clock;
}): Sync {
  return {
    async push({ account }, editionId, changes) {
      const serving = await servingSync(editions, editionId);
      if (!serving.ok) return serving;
      const now = clock.now().getTime();
      // The device's own times pick the change of each key, before the cut.
      const kept: RecordChange[] = latestOfEachKey(changes).map(({ key, value, changedAt }) => ({
        key,
        value,
        changedAt: new Date(Math.min(changedAt, now)),
      }));
      await records.push(account.id, editionId, kept);
      return { ok: true };
    },

    async pull({ account }, editionId, { after = 0, limit = SYNC_BATCH_SIZE }) {
      const serving = await servingSync(editions, editionId);
      if (!serving.ok) return serving;
      const pageSize = Math.min(limit, SYNC_BATCH_SIZE);
      // One record past the page tells whether more follow.
      const kept = await records.after(account.id, editionId, after, pageSize + 1);
      const page = kept.slice(0, pageSize);
      return {
        ok: true,
        records: page.map(({ key, value, changedAt }) => ({
          key,
          value,
          changedAt: changedAt.getTime(),
        })),
        cursor: page.at(-1)?.sequence ?? after,
        more: kept.length > pageSize,
      };
    },
  };
}
