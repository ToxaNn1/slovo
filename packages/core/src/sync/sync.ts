import { SYNC_BATCH_SIZE } from '@slovo/contracts';
import { z } from 'zod';

import { newestFirst } from '../in-turn';
import type { Json, RecordChange, SyncApi, SyncApiFailure, UserStateChanges } from '../ports';
import { HISTORY_CAP } from '../saved/history';
import type { PendingChange, TrackedUserState } from '../user-state/tracked-user-state';
import { declareRecords } from '../user-state/user-state-record';
import { syncMarkOf, userStateRecords } from '../user-state/user-state-schema';

/** What one sync came to: done, and whether its pull wrote anything; or the failure that stopped it. */
export type SyncResult = { readonly ok: true; readonly changed: boolean } | SyncApiFailure;

/**
 * Sync (spec #378): the exchange of the reader's words and progress between
 * this device and the Account, record by record by the marks of the
 * user-state schema (ADR 0013, 0041). It opens apart from the composition,
 * and what reads the user state in memory opens again over a pull that
 * wrote something.
 */
export interface Sync {
  /**
   * Syncs once with the Account of the Session, a pull, then a push. Without
   * a cursor it first follows the first-sign-in rule: every synced record
   * with no pending change gets one with change time 0, so the Account's
   * value wins where it has one and gets the device's where it has none. The
   * pull applies every page after the cursor, each in one write with its
   * cursor, by the record's mark:
   * - last write wins: the Account's value replaces the device's, unless the
   *   key has a later pending change, which stays for the push;
   * - `union`: every Active Day is kept, and none is deleted;
   * - `highest`: the higher value is kept, and a higher one of the device's
   *   is written again, so it wins with the push;
   * - `device-only`: the Account's record is ignored;
   * - a key the schema doesn't know is kept as it is.
   * History over `HISTORY_CAP` loses its oldest entries by Seen time in the
   * same write, and those deletions sync. The push then sends the pending
   * changes in batches of `SYNC_BATCH_SIZE` and deletes each batch the
   * Account accepted. A failed call stops the sync where it is; nothing done
   * is lost, and the next sync resumes. Call it once at a time.
   */
  sync(token: string): Promise<SyncResult>;
}

/** Every record of the user state, by key, as the JSON it keeps. */
const everyRecord = declareRecords('', z.json());

const { history, syncCursor, syncPending } = userStateRecords;

/** The time of every first-sign-in change, older than any change. */
const FIRST_SIGN_IN = new Date(0);

const newestSeen = newestFirst<[string, { seenAt: string }]>(
  ([, entry]) => new Date(entry.seenAt),
  ([id]) => id,
);

/** Whether two JSON values are the same, whatever the order of an object's keys. */
function same(first: Json | undefined, second: Json | undefined): boolean {
  if (first === second) return true;
  if (typeof first !== 'object' || typeof second !== 'object' || first === null || second === null)
    return false;
  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((item, index) => same(item, second[index]))
    );
  }
  const keys = Object.keys(first);
  return (
    keys.length === Object.keys(second).length &&
    keys.every((key) => key in second && same(first[key], second[key]))
  );
}

/** Whether the device's value is higher than the Account's, for a `highest` record. */
const higher = (mine: Json | undefined, theirs: Json | undefined) =>
  typeof mine === 'number' && (typeof theirs !== 'number' || mine > theirs);

/** A pending change as the push sends it: a record that doesn't read as JSON goes as a tombstone. */
function changeOf(key: string, { changedAt, value }: PendingChange): RecordChange {
  return {
    key,
    value: everyRecord.record(key).decode(value) ?? null,
    changedAt: changedAt.getTime(),
  };
}

/** Opens Sync over the tracked user state and the backend's Sync procedures. */
export function createSync({
  userState,
  api,
}: {
  userState: TrackedUserState;
  api: SyncApi;
}): Sync {
  /** The first-sign-in rule: a change with change time 0 for every synced record with none. */
  function joinAccount(): Promise<void> {
    return userState.merge(async () => {
      const pending = await userState.pendingChanges();
      const untracked = new Map<string, string | undefined>();
      for (const [key, value] of await userState.list(everyRecord)) {
        const mark = syncMarkOf(key);
        if (mark === undefined || mark === 'device-only' || pending.has(key)) continue;
        for (const change of syncPending
          .record(key)
          .change({ changedAt: FIRST_SIGN_IN.toISOString(), value: JSON.stringify(value) })) {
          untracked.set(...change);
        }
      }
      return { untracked, tracked: new Map() };
    });
  }

  /** Applies one page of the pull, with its cursor, in one write; whether it changed a record. */
  async function apply(records: readonly RecordChange[], cursor: number): Promise<boolean> {
    let changed = false;
    await userState.merge(async () => {
      const local = await userState.list(everyRecord);
      const pending = await userState.pendingChanges();
      const untracked = new Map<string, string | undefined>(syncCursor.change(cursor));
      const tracked = new Map<string, string | undefined>();
      for (const { key, value, changedAt } of records) {
        const mark = syncMarkOf(key);
        if (mark === 'device-only') continue;
        const mine = local.get(key);
        const theirs = value ?? undefined;
        const waiting = pending.get(key);
        if (mark === 'union' && theirs === undefined) continue;
        if (mark === 'highest' && higher(mine, theirs)) {
          tracked.set(key, JSON.stringify(mine));
          continue;
        }
        if (
          mark !== 'highest' &&
          waiting !== undefined &&
          waiting.changedAt.getTime() > changedAt
        ) {
          continue;
        }
        // The Account's value wins: a pending change of the key has nothing left to send.
        if (waiting !== undefined) untracked.set(syncPending.record(key).key, undefined);
        if (!same(mine, theirs)) {
          untracked.set(key, theirs === undefined ? undefined : JSON.stringify(theirs));
          changed = true;
        }
      }
      for (const key of trimmedHistory(await userState.list(history), untracked)) {
        tracked.set(key, undefined);
      }
      return { untracked, tracked };
    });
    return changed;
  }

  /** The keys of the oldest History entries beyond the cap once the page is written. */
  function trimmedHistory(
    kept: ReadonlyMap<string, { seenAt: string }>,
    page: UserStateChanges,
  ): string[] {
    const merged = new Map(kept);
    for (const [key, text] of page) {
      if (!key.startsWith(history.prefix)) continue;
      const id = key.slice(history.prefix.length);
      const entry = history.record(id).decode(text);
      if (entry === undefined) merged.delete(id);
      else merged.set(id, entry);
    }
    return [...merged]
      .sort(newestSeen)
      .slice(HISTORY_CAP)
      .map(([id]) => history.record(id).key);
  }

  return {
    async sync(token) {
      if ((await userState.cursor()) === undefined) await joinAccount();
      let changed = false;
      for (let more = true; more;) {
        const page = await api.pull(token, await userState.cursor());
        if (!page.ok) return page;
        if (await apply(page.records, page.cursor)) changed = true;
        more = page.more;
      }
      const pending = [...(await userState.pendingChanges())];
      for (let start = 0; start < pending.length; start += SYNC_BATCH_SIZE) {
        const batch = new Map(pending.slice(start, start + SYNC_BATCH_SIZE));
        const answer = await api.push(
          token,
          [...batch].map(([key, change]) => changeOf(key, change)),
        );
        if (!answer.ok) return answer;
        await userState.deleteSent(batch);
      }
      return { ok: true, changed };
    },
  };
}
