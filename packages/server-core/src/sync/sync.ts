import { SYNC_BATCH_SIZE } from '@slovo/contracts';

import type { Session } from '../account/accounts';
import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, Json, RateLimits, RecordChange, UserRecords } from '../ports';
import { countRequest, type TooManyRequests } from '../rate-limit';

/**
 * The limits of Sync (spec #378), so one Account or a broken device can't
 * fill the database or flood the backend.
 */
const SYNC_LIMITS = {
  /** The most characters of a record's key. */
  keyLength: 200,
  /** The most bytes of a record's value as compact JSON in UTF-8: 8 KB. */
  valueBytes: 8 * 1024,
  /** The most records an Account keeps in an Edition, tombstones included. */
  recordsPerEdition: 20_000,
  /** Sync requests of one Session, pushes and pulls together. */
  requestsPerSession: { requests: 120, windowSeconds: 10 * 60 },
} as const;

/** What a push with a key or a value over its limit gets. */
interface TooLarge {
  readonly ok: false;
  readonly reason: 'too-large';
}

/** What a push that would take the Account's records in the Edition over their limit gets. */
interface TooManyRecords {
  readonly ok: false;
  readonly reason: 'too-many-records';
}

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
 * and Sync, and over the limit of requests of the Session.
 */
export interface Sync {
  /**
   * Keeps each change that is later than the record kept under its key. A
   * change time later than the server's own time counts as the server's
   * time, so a device with a fast clock can't win every conflict; a tie
   * keeps the record kept. Of two changes of one key, the later is pushed,
   * the first on a tie. A change that is not later is ignored.
   *
   * A push with a key or a value over its limit, or one that would take the
   * Account's records in the Edition over theirs, is refused whole. A change
   * of a key kept never adds a record, so it is kept even at the limit.
   */
  push(
    session: Session,
    editionId: string,
    changes: readonly SyncChange[],
  ): Promise<{ readonly ok: true } | NotServing | TooManyRequests | TooLarge | TooManyRecords>;
  /**
   * The records kept after the cursor, from the first without one, in the
   * order they were kept: at most `limit`, and at most a page of
   * `SYNC_BATCH_SIZE`.
   */
  pull(
    session: Session,
    editionId: string,
    page: { readonly after?: number | undefined; readonly limit?: number | undefined },
  ): Promise<({ readonly ok: true } & SyncPage) | NotServing | TooManyRequests>;
}

/** Whether the Edition serves Sync: it serves the Account, and Sync on top of it. */
async function servingSync(editions: EditionRegistry, editionId: string) {
  const account = await editions.serving(editionId, 'account');
  if (!account.ok) return account;
  return editions.serving(editionId, 'sync');
}

/**
 * How many bytes the text takes in UTF-8. A JSON text has no lone
 * surrogate, so each code point is one character.
 */
function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Whether the change's key and value are within their limits. */
const fits = ({ key, value }: SyncChange) =>
  key.length <= SYNC_LIMITS.keyLength && utf8Bytes(JSON.stringify(value)) <= SYNC_LIMITS.valueBytes;

/** The change of each key that wins, in the order the keys first came: the later, the first on a tie. */
function latestOfEachKey(changes: readonly SyncChange[]): SyncChange[] {
  const byKey = new Map<string, SyncChange>();
  for (const change of changes) {
    const kept = byKey.get(change.key);
    if (kept === undefined || change.changedAt > kept.changedAt) byKey.set(change.key, change);
  }
  return [...byKey.values()];
}

const tooLarge: TooLarge = { ok: false, reason: 'too-large' };
const tooManyRecords: TooManyRecords = { ok: false, reason: 'too-many-records' };

export function createSync({
  editions,
  records,
  rateLimits,
  clock,
}: {
  editions: EditionRegistry;
  records: UserRecords;
  rateLimits: RateLimits;
  clock: Clock;
}): Sync {
  /** Counts a request of the Session, and whether it may act in the Edition. */
  async function admit(session: Session, editionId: string) {
    const overLimit = await countRequest(
      rateLimits,
      `syncRequestsPerSession:${session.id}`,
      SYNC_LIMITS.requestsPerSession,
      clock.now(),
    );
    return overLimit ?? servingSync(editions, editionId);
  }

  return {
    async push(session, editionId, changes) {
      const admitted = await admit(session, editionId);
      if (!admitted.ok) return admitted;
      if (!changes.every(fits)) return tooLarge;
      const now = clock.now().getTime();
      // The device's own times pick the change of each key, before the cut.
      const kept: RecordChange[] = latestOfEachKey(changes).map(({ key, value, changedAt }) => ({
        key,
        value,
        changedAt: new Date(Math.min(changedAt, now)),
      }));
      const refused = await records.push(session.account.id, editionId, kept, (count) =>
        count > SYNC_LIMITS.recordsPerEdition ? tooManyRecords : undefined,
      );
      return refused ?? { ok: true };
    },

    async pull(session, editionId, { after = 0, limit = SYNC_BATCH_SIZE }) {
      const admitted = await admit(session, editionId);
      if (!admitted.ok) return admitted;
      const pageSize = Math.min(limit, SYNC_BATCH_SIZE);
      // One record past the page tells whether more follow.
      const kept = await records.after(session.account.id, editionId, after, pageSize + 1);
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
