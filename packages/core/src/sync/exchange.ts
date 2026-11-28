import { fitsSyncRecord, SYNC_BATCH_SIZE } from '@slovo/contracts';
import { z } from 'zod';

import { answerOf } from '../backend';
import { newestFirst } from '../in-turn';
import type { Backend, Json, RecordChange, RequestFailure, UserStateChanges } from '../ports';
import { progressRecords } from '../progress/records';
import { HISTORY_CAP } from '../saved/history';
import type { PendingChange, TrackedUserState } from '../user-state/tracked-user-state';
import { declareRecords } from '../user-state/user-state-record';
import { isDropped, syncMarkOf, syncs, userStateRecords } from '../user-state-schema';

/**
 * A request of Sync that failed as any request does, because the Session it
 * carried has ended (401), because the backend serves no Sync for the
 * Edition (404), or because a push would take the Account's records in the
 * Edition over their limit (409, `TOO_MANY_RECORDS`).
 */
export type SyncApiFailure =
  | RequestFailure
  | { readonly ok: false; readonly reason: 'unauthorized' }
  | { readonly ok: false; readonly reason: 'not-found' }
  | { readonly ok: false; readonly reason: 'too-many-records' };

/**
 * What one sync came to: done, or the failure that stopped it; and either way
 * whether its pull wrote a record, since the pages applied before a failure
 * stay written.
 */
export type SyncResult = ({ readonly ok: true } | SyncApiFailure) & { readonly changed: boolean };

/**
 * The failures of a push that no later try passes: the Account's records are
 * at their limit, the backend serves no Sync for the Edition, or it gave an
 * answer the app does not know.
 */
export type SyncRefusal = 'too-many-records' | 'not-found' | 'unexpected';

/** The refusal for good a failure of a sync is, if it is one. */
export const refusalOf = (reason: SyncApiFailure['reason']): SyncRefusal | undefined =>
  reason === 'too-many-records' || reason === 'not-found' || reason === 'unexpected'
    ? reason
    : undefined;

/**
 * One sync (spec #378): the exchange of the reader's words and progress
 * between this device and the Account, record by record by the marks of the
 * user-state schema (ADR 0013, 0041). The Sync module decides when it runs.
 */
export interface SyncExchange {
  /**
   * Syncs once with the Account of the Session, named by its email, a pull,
   * then a push. A cursor kept for another Account is forgotten first, whoever
   * was open when the Session changed; one that names no Account, as an older
   * app kept it, is taken as this Account's. Without a cursor it first follows the first-sign-in rule: every synced record
   * with no pending change gets one with change time 0, so the Account's
   * value wins where it has one and gets the device's where it has none. The
   * pull applies every page after the cursor, each in one write with its
   * cursor and the latest change time it brings, which every later change of
   * the device passes (ADR 0215), by the record's mark:
   * - last write wins: the Account's value replaces the device's, unless the
   *   key has a later pending change, which stays for the push;
   * - `union`: every Active Day is kept, and none is deleted;
   * - `highest`: the higher value is kept, and a higher one of the device's
   *   is written again, so it wins with the push;
   * - `device-only`: the Account's record is ignored;
   * - a key the schema doesn't know is kept as it is.
   * The pull ends with the page that says no more follow, or that leaves the
   * cursor where it was.
   * History over `HISTORY_CAP` loses its oldest entries by Seen time in the
   * write of the last page, and those deletions sync. The push then sends the pending
   * changes, the deletions first, in batches of `SYNC_BATCH_SIZE` and deletes each batch the
   * Account accepted. The deletion of a record of the XP log a pending XP day
   * holds goes with that XP day, never before it (ADR 0205). A failed call stops the sync where it is; nothing done
   * is lost, and the next sync resumes. A batch the Account refuses for good
   * (`refusalOf`) stays pending and is sent no more by this exchange,
   * so until the next launch: a later sync pulls, pushes the other changes
   * and answers that refusal while a refused change waits. A record changed
   * again is a new change. A change over `SYNC_RECORD_LIMITS`, which the
   * Account would refuse with its whole batch, is never sent: it stays
   * pending, at every launch, the other changes are pushed, and the sync
   * answers `unexpected` while it waits. Call it once at a time.
   */
  sync(token: string, account: string): Promise<SyncResult>;
  /** Forgets which changes were refused, as when the Session ends: the next Session's Account may take them. */
  forgetRefused(): void;
}

/** Every record of the user state, by key, as the JSON it keeps. */
const everyRecord = declareRecords('', z.json());

const { history, syncAccountChangedAt, syncCursor, syncCursorAccount, syncPending } =
  userStateRecords;
const { xpLog, xpDays } = progressRecords;

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

type Pending = readonly [string, PendingChange];

/**
 * The pending changes as the pushes send them, each of at most
 * `SYNC_BATCH_SIZE`. The deletions come first: they free room in the Account
 * before a push adds records. A deletion of a record of the XP log that a
 * pending XP day holds is no such deletion: it goes in the push of that XP
 * day, after it, or in the pushes right after when the two do not fit one,
 * and not at all while the XP day is withheld, so the Account never loses a
 * record before the XP day that holds it is there (ADR 0205).
 */
function pushesOf(
  all: readonly Pending[],
  withheld: (change: Pending) => boolean,
): Map<string, PendingChange>[] {
  const byKey = new Map(all);
  const held = new Set<string>();
  /** The pending deletions of the records the XP day holds that no earlier XP day took. */
  const deletionsOf = (key: string, text: string): Pending[] => {
    const day = xpDays.record(key.slice(xpDays.prefix.length)).decode(text);
    return Object.keys(day?.rows ?? {}).flatMap((id): Pending[] => {
      const row = xpLog.record(id).key;
      const change = byKey.get(row);
      if (change === undefined || change.value !== undefined || held.has(row)) return [];
      held.add(row);
      return [[row, change]];
    });
  };
  const dayKeys = new Set<string>();
  const days = all.flatMap(([key, change]): Pending[][] => {
    if (change.value === undefined || !key.startsWith(xpDays.prefix)) return [];
    dayKeys.add(key);
    return [[[key, change], ...deletionsOf(key, change.value)]];
  });
  const alone = all.filter(([key]) => !held.has(key) && !dayKeys.has(key));
  const groups = [
    ...alone.filter(([, { value }]) => value === undefined).map((change) => [change]),
    // An XP day withheld keeps its deletions back with it.
    ...days.filter(([day]) => day !== undefined && !withheld(day)),
    ...alone.filter(([, { value }]) => value !== undefined).map((change) => [change]),
  ];
  const pushes: Pending[][] = [];
  let push: Pending[] = [];
  for (const group of groups) {
    const sent = group.filter((change) => !withheld(change));
    // A group stays in one push where it fits one.
    if (push.length > 0 && push.length + sent.length > SYNC_BATCH_SIZE) {
      pushes.push(push);
      push = [];
    }
    for (const change of sent) {
      if (push.length === SYNC_BATCH_SIZE) {
        pushes.push(push);
        push = [];
      }
      push.push(change);
    }
  }
  if (push.length > 0) pushes.push(push);
  return pushes.map((changes) => new Map(changes));
}

/**
 * The Sync requests of the running Edition to the backend, each answered as a
 * value (ADR 0064), on the Account of the Session whose token each carries.
 */
function syncRequests(backend: Pick<Backend, 'sync'>, editionId: string) {
  const { sync } = backend;
  return {
    /** Keeps the changes, at most `SYNC_BATCH_SIZE`: each replaces the record kept under its key only when it is later (ADR 0041). */
    async push(
      token: string,
      changes: readonly RecordChange[],
    ): Promise<{ readonly ok: true } | SyncApiFailure> {
      const answer = await answerOf(
        sync.push({ editionId, changes: [...changes] }, { context: { token } }),
        ({ code }) => {
          if (code === 'UNAUTHORIZED') return { ok: false, reason: 'unauthorized' } as const;
          if (code === 'NOT_FOUND') return { ok: false, reason: 'not-found' } as const;
          if (code === 'TOO_MANY_RECORDS')
            return { ok: false, reason: 'too-many-records' } as const;
          return undefined;
        },
      );
      return answer.ok ? { ok: true } : answer;
    },
    /**
     * One page of the records kept after the cursor, from the first without
     * one, in the order the backend kept them: at most `SYNC_BATCH_SIZE`, the
     * cursor to ask after next, and whether more follow.
     */
    async pull(
      token: string,
      after: number | undefined,
    ): Promise<
      | {
          readonly ok: true;
          readonly records: readonly RecordChange[];
          readonly cursor: number;
          readonly more: boolean;
        }
      | SyncApiFailure
    > {
      const answer = await answerOf(
        sync.pull(after === undefined ? { editionId } : { editionId, after }, {
          context: { token },
        }),
        ({ code }) => {
          if (code === 'UNAUTHORIZED') return { ok: false, reason: 'unauthorized' } as const;
          if (code === 'NOT_FOUND') return { ok: false, reason: 'not-found' } as const;
          return undefined;
        },
      );
      return answer.ok ? { ok: true, ...answer.output } : answer;
    },
  };
}

/** Makes one sync of the running Edition over the tracked user state and the backend. */
export function createSyncExchange({
  userState,
  backend,
  editionId,
}: {
  userState: TrackedUserState;
  backend: Pick<Backend, 'sync'>;
  editionId: string;
}): SyncExchange {
  const api = syncRequests(backend, editionId);
  /** The first-sign-in rule: a change with change time 0 for every synced record with none. */
  function joinAccount(): Promise<void> {
    return userState.merge(async () => {
      const pending = await userState.pendingChanges();
      const untracked = new Map<string, string | undefined>();
      for (const [key, value] of await userState.list(everyRecord)) {
        if (!syncs(key) || pending.has(key)) continue;
        for (const change of syncPending
          .record(key)
          .change({ changedAt: FIRST_SIGN_IN.toISOString(), value: JSON.stringify(value) })) {
          untracked.set(...change);
        }
      }
      return { untracked, tracked: new Map() };
    });
  }

  /** The device's value and pending change of the key, as they stand. */
  async function mineOf(
    key: string,
  ): Promise<{ mine: Json | undefined; waiting: PendingChange | undefined }> {
    const [mine, pending] = await Promise.all([
      userState.read(everyRecord.record(key)),
      userState.read(syncPending.record(key)),
    ]);
    const waiting =
      pending === undefined
        ? undefined
        : { changedAt: new Date(pending.changedAt), value: pending.value ?? undefined };
    return { mine, waiting };
  }

  /**
   * Applies one page of the pull, with its cursor and the Account it is kept
   * for, in one write, trimming
   * History on the last; whether it changed a record. It reads only the
   * page's own keys, so a page costs its size, not the whole user state's.
   */
  async function apply(
    {
      records,
      cursor,
      more,
    }: {
      records: readonly RecordChange[];
      cursor: number;
      more: boolean;
    },
    account: string,
  ): Promise<boolean> {
    let changed = false;
    await userState.merge(async () => {
      const untracked = new Map<string, string | undefined>([
        ...syncCursor.change(cursor),
        ...syncCursorAccount.change(account),
      ]);
      // The latest change time the page brings is one the Account holds (ADR 0215).
      const pulledAt = Math.max(0, ...records.map(({ changedAt }) => changedAt));
      if (pulledAt > ((await userState.read(syncAccountChangedAt)) ?? 0)) {
        for (const change of syncAccountChangedAt.change(pulledAt)) untracked.set(...change);
      }
      const tracked = new Map<string, string | undefined>();
      // Read at once: the turn holds every other change back while the page is read.
      const read = await Promise.all(
        records.flatMap((record) => {
          const mark = syncMarkOf(record.key);
          if (mark === 'device-only' || isDropped(record.key)) return [];
          return [mineOf(record.key).then((kept) => ({ ...record, ...kept, mark }))];
        }),
      );
      for (const { key, value, changedAt, mark, mine, waiting } of read) {
        const theirs = value ?? undefined;
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
      // Only once the whole pull is in: a later page may bring a newer entry
      // of one an earlier trim would delete.
      if (!more) {
        for (const key of trimmedHistory(await userState.list(history), untracked)) {
          tracked.set(key, undefined);
        }
      }
      return { untracked, tracked };
    });
    return changed;
  }

  /** The keys of the oldest History entries beyond the cap once the changes are written. */
  function trimmedHistory(
    kept: ReadonlyMap<string, { seenAt: string }>,
    changes: UserStateChanges,
  ): string[] {
    const merged = new Map(kept);
    for (const [key, text] of changes) {
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

  /** The changes a push was refused for good, by key with the instant of the change, and the last such refusal. */
  const refused = new Map<string, number>();
  let refusal: SyncApiFailure | undefined;
  const isRefused = ([key, { changedAt }]: Pending) => refused.get(key) === changedAt.getTime();

  return {
    forgetRefused() {
      refused.clear();
      refusal = undefined;
    },
    async sync(token, account) {
      const keptFor = await userState.read(syncCursorAccount);
      if (keptFor !== undefined && keptFor !== account) {
        // Another Account's place says nothing of this one's records.
        await userState.write(
          new Map([...syncCursor.change(undefined), ...syncCursorAccount.change(undefined)]),
        );
      }
      if ((await userState.cursor()) === undefined) await joinAccount();
      let changed = false;
      for (let more = true; more;) {
        const after = await userState.cursor();
        const page = await api.pull(token, after);
        if (!page.ok) return { ...page, changed };
        if (await apply(page, account)) changed = true;
        // A page that leaves the cursor where it was is the last, whatever it says: asking again would never end.
        more = page.more && page.cursor !== after;
      }
      const all = [...(await userState.pendingChanges())];
      // Never sent: the backend refuses the whole push of a change over the limits (ADR 0208).
      const over = new Set(
        all.filter(([key, change]) => !fitsSyncRecord(changeOf(key, change))).map(([key]) => key),
      );
      const isOver = ([key]: Pending) => over.has(key);
      for (const batch of pushesOf(all, (change) => isRefused(change) || isOver(change))) {
        const answer = await api.push(
          token,
          [...batch].map(([key, change]) => changeOf(key, change)),
        );
        if (!answer.ok) {
          if (refusalOf(answer.reason) !== undefined) {
            for (const [key, { changedAt }] of batch) refused.set(key, changedAt.getTime());
            refusal = answer;
          }
          return { ...answer, changed };
        }
        await userState.deleteSent(batch);
      }
      // A refused change that still waits keeps the sync refused.
      if (refusal !== undefined && all.some(isRefused)) return { ...refusal, changed };
      if (over.size > 0) return { ok: false, reason: 'unexpected', changed };
      return { ok: true, changed };
    },
  };
}
