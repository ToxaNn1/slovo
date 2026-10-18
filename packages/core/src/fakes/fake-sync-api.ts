import { SYNC_BATCH_SIZE } from '@slovo/contracts';

import type { Clock, Json, RecordChange, SyncApi, SyncApiFailure } from '../ports';

/** A record as the fake backend keeps it: the change that won, and its sequence number. */
export interface KeptRecord {
  readonly value: Json;
  readonly changedAt: number;
  readonly sequence: number;
}

/**
 * A Sync API for tests that keeps one Account's records in one Edition in
 * memory, by the backend's rules (ADR 0041): a change replaces the record
 * kept under its key only when it is later, a change time later than the
 * clock's counts as the clock's, and every kept change takes the next
 * sequence number, which a pull pages by; a push of more than
 * `SYNC_BATCH_SIZE` changes is refused. Every token is the Account's.
 */
export interface FakeSyncApi extends SyncApi {
  /** The records kept, by key. */
  readonly records: ReadonlyMap<string, KeptRecord>;
  /** The procedures called, by name, in order, the failed ones included. */
  readonly calls: readonly (keyof SyncApi)[];
  /** Makes the next call of the procedure fail with the reason, before it reaches the records. */
  failNext(procedure: keyof SyncApi, reason: SyncApiFailure['reason']): void;
}

/** Makes a fake Sync API whose server time is the clock's. */
export function createFakeSyncApi({ clock }: { clock: Clock }): FakeSyncApi {
  const records = new Map<string, KeptRecord>();
  const calls: (keyof SyncApi)[] = [];
  const failures = new Map<keyof SyncApi, SyncApiFailure['reason']>();
  let sequence = 0;

  /** Logs the call and answers its failure, if one was asked for. */
  function arrive(procedure: keyof SyncApi): SyncApiFailure | undefined {
    calls.push(procedure);
    const reason = failures.get(procedure);
    failures.delete(procedure);
    return reason === undefined ? undefined : { ok: false, reason };
  }

  return {
    records,
    calls,
    failNext(procedure, reason) {
      failures.set(procedure, reason);
    },
    push(_token, changes) {
      const failure = arrive('push');
      if (failure !== undefined) return Promise.resolve(failure);
      // The backend refuses a push over the batch size (400).
      if (changes.length > SYNC_BATCH_SIZE)
        return Promise.resolve({ ok: false, reason: 'unexpected' });
      // Of two changes of one key, the later is kept, the first on a tie, and only then cut.
      const latest = new Map<string, RecordChange>();
      for (const change of changes) {
        const before = latest.get(change.key);
        if (before === undefined || change.changedAt > before.changedAt) {
          latest.set(change.key, change);
        }
      }
      const now = clock.now().getTime();
      for (const { key, value, changedAt } of latest.values()) {
        const kept = records.get(key);
        const cut = Math.min(changedAt, now);
        if (kept === undefined || cut > kept.changedAt) {
          sequence += 1;
          records.set(key, { value, changedAt: cut, sequence });
        }
      }
      return Promise.resolve({ ok: true });
    },
    pull(_token, after) {
      const failure = arrive('pull');
      if (failure !== undefined) return Promise.resolve(failure);
      const following = [...records]
        .filter(([, record]) => record.sequence > (after ?? 0))
        .sort(([, first], [, second]) => first.sequence - second.sequence);
      const page = following.slice(0, SYNC_BATCH_SIZE);
      return Promise.resolve({
        ok: true,
        records: page.map(([key, { value, changedAt }]) => ({ key, value, changedAt })),
        cursor: page.at(-1)?.[1].sequence ?? after ?? 0,
        more: following.length > page.length,
      });
    },
  };
}
