import { createInTurn } from '../in-turn';
import type { Clock, UserStateChanges } from '../ports';
import type { UserState } from './user-state';
import { syncs, userStateRecords } from './user-state-schema';

/**
 * A change of a synced record not yet sent to the Account: the instant it was
 * written, and the record's new text, or nothing for a deletion (a tombstone).
 */
export interface PendingChange {
  readonly changedAt: Date;
  readonly value: string | undefined;
}

/**
 * The user state every module reads and writes through (spec #378). Each
 * write of a record that syncs also writes, in the same batch, its pending
 * change; Sync reads the pending changes and the cursor, and deletes what it
 * sent.
 */
export interface TrackedUserState extends UserState {
  /** Every pending change, by the key of its record. */
  pendingChanges(): Promise<ReadonlyMap<string, PendingChange>>;
  /** The Sync cursor; nothing until a sync has pulled. */
  cursor(): Promise<number | undefined>;
  /**
   * Deletes the pending changes the Account accepted, each only while it is
   * still the one sent, so a newer change of the same key written meanwhile
   * stays for the next push.
   */
  deleteSent(sent: ReadonlyMap<string, PendingChange>): Promise<void>;
  /**
   * Writes what Sync makes of the user state in one batch, in turn with every
   * write, so none lands between what `make` reads and the batch it answers:
   * `untracked` as it is, such as the records of the Account a pull brings,
   * and `tracked` as `write` writes it, with the pending change of each
   * synced record. `tracked` wins over `untracked` for a key in both. `make`
   * reads and never writes.
   */
  merge(
    make: () => Promise<{
      readonly untracked: UserStateChanges;
      readonly tracked: UserStateChanges;
    }>,
  ): Promise<void>;
}

const { syncPending, syncCursor } = userStateRecords;

/**
 * Wraps the user state so that every write of a synced record leaves its
 * pending change with the clock's time, in the same atomic batch: a write that
 * fails leaves none. `device-only` records, the schema version, the pending
 * changes and the cursor are never tracked, and nothing written before is
 * back-filled. Writes, `deleteSent` and `merge` run one at a time.
 */
export function trackChanges({
  userState,
  clock,
}: {
  userState: UserState;
  clock: Clock;
}): TrackedUserState {
  const inTurn = createInTurn();

  async function pendingChanges(): Promise<ReadonlyMap<string, PendingChange>> {
    const pending = new Map<string, PendingChange>();
    for (const [key, { changedAt, value }] of await userState.list(syncPending)) {
      pending.set(key, { changedAt: new Date(changedAt), value: value ?? undefined });
    }
    return pending;
  }

  /** The changes with the pending change of each synced record, at the clock's time. */
  function withPending(changes: UserStateChanges): UserStateChanges {
    const changedAt = clock.now().toISOString();
    const pending = [...changes]
      .filter(([key]) => syncs(key))
      .flatMap(([key, value]) => [
        ...syncPending.record(key).change({ changedAt, value: value ?? null }),
      ]);
    return new Map([...changes, ...pending]);
  }

  return {
    read: (record) => userState.read(record),
    list: (records) => userState.list(records),
    write: (changes) => inTurn(() => userState.write(withPending(changes))),
    pendingChanges,
    cursor: () => userState.read(syncCursor),
    deleteSent: (sent) =>
      inTurn(async () => {
        const current = await pendingChanges();
        const changes: UserStateChanges = new Map(
          [...sent]
            .filter(([key, change]) => {
              const stored = current.get(key);
              return (
                stored?.changedAt.getTime() === change.changedAt.getTime() &&
                stored.value === change.value
              );
            })
            .map(([key]) => [syncPending.record(key).key, undefined]),
        );
        if (changes.size > 0) await userState.write(changes);
      }),
    merge: (make) =>
      inTurn(async () => {
        const { untracked, tracked } = await make();
        const changes = new Map([...untracked, ...withPending(tracked)]);
        if (changes.size > 0) await userState.write(changes);
      }),
  };
}
