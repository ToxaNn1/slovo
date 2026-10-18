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
  /**
   * Makes the next call of the procedure fail with the reason, before it
   * reaches the records; too many requests says to retry after `retryAfter`
   * seconds, if given.
   */
  failNext(
    procedure: keyof SyncApi,
    reason: SyncApiFailure['reason'],
    options?: { retryAfter?: number },
  ): void;
  /** Holds the next call until the call it returns lets it go on. */
  hold(): () => void;
}

/** Makes a fake Sync API whose server time is the clock's. */
export function createFakeSyncApi({ clock }: { clock: Clock }): FakeSyncApi {
  const records = new Map<string, KeptRecord>();
  const calls: (keyof SyncApi)[] = [];
  const failures = new Map<keyof SyncApi, SyncApiFailure>();
  let held: Promise<void> | undefined;
  let sequence = 0;

  /** Logs the call, waits while it is held, and answers its failure, if one was asked for. */
  async function arrive(procedure: keyof SyncApi): Promise<SyncApiFailure | undefined> {
    calls.push(procedure);
    const holding = held;
    held = undefined;
    await holding;
    const failure = failures.get(procedure);
    failures.delete(procedure);
    return failure;
  }

  return {
    records,
    calls,
    failNext(procedure, reason, { retryAfter } = {}) {
      failures.set(
        procedure,
        reason === 'too-many-requests' ? { ok: false, reason, retryAfter } : { ok: false, reason },
      );
    },
    hold() {
      let release: () => void = () => undefined;
      held = new Promise((resolve) => {
        release = resolve;
      });
      return release;
    },
    async push(_token, changes) {
      const failure = await arrive('push');
      if (failure !== undefined) return failure;
      // The backend refuses a push over the batch size (400).
      if (changes.length > SYNC_BATCH_SIZE) return { ok: false, reason: 'unexpected' };
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
      return { ok: true };
    },
    async pull(_token, after) {
      const failure = await arrive('pull');
      if (failure !== undefined) return failure;
      const following = [...records]
        .filter(([, record]) => record.sequence > (after ?? 0))
        .sort(([, first], [, second]) => first.sequence - second.sequence);
      const page = following.slice(0, SYNC_BATCH_SIZE);
      return {
        ok: true,
        records: page.map(([key, { value, changedAt }]) => ({ key, value, changedAt })),
        cursor: page.at(-1)?.[1].sequence ?? after ?? 0,
        more: following.length > page.length,
      };
    },
  };
}
