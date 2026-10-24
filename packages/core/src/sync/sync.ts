import type { Account } from '../account/account';
import type { Edition } from '../edition/edition';
import { createSubscribers } from '../in-turn';
import type { Clock, Random, Schedule, SyncApi } from '../ports';
import { withRetries } from '../retry';
import type { TrackedUserState } from '../user-state/tracked-user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import { createSyncExchange, type SyncResult } from './exchange';

/** How long after the last tracked write a sync starts, in milliseconds. */
export const SYNC_AFTER_WRITE = 5_000;

/** How Sync stands, for the status line of the SLOVO ID screen. */
export interface SyncState {
  /** When the last sync of this Session went through, kept across launches; none before one has. */
  readonly syncedAt: Date | undefined;
  /** Whether a sync runs, its waits between tries included. */
  readonly running: boolean;
  /** Whether the last sync of this Session failed for want of network, through every try. */
  readonly offline: boolean;
}

/**
 * Sync (spec #378): the background exchange of the reader's words and
 * progress between this device and the Account, at the right moments. It
 * syncs at launch, on each return to the foreground, when a Session starts,
 * and `SYNC_AFTER_WRITE` after the last tracked write while the app is in the
 * foreground; only with a Session and with the Edition's `account` and `sync`
 * Feature Switches on in effect, read each time. One sync runs at a time;
 * a moment during a sync starts one more after it, once.
 *
 * A sync that fails with no answer or a server error is tried again by the
 * one rule (ADR 0037); one that finds too many requests waits for the
 * answer's `Retry-After`, and nothing syncs sooner; one that finds the
 * Session ended goes to the Account, which signs out quietly; no try follows
 * the end of a Session. When the Session ends, Sync forgets its cursor and
 * the time of its last sync, once no sync of that Session runs, and keeps the
 * pending changes and the words, so the next Session starts by the
 * first-sign-in rule. Nothing it does rejects.
 */
export interface Sync {
  /**
   * How Sync stands. A change never edits it: it makes a new one and tells
   * the subscribers, so it stays the same object until something changes.
   */
  readonly state: SyncState;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Calls `listener` once after each sync whose pull wrote a record, failed
   * ones too, and after each that failed to write the user state, since a
   * page may have been written before; so the shell reopens what keeps the
   * user state in memory. Returns the call that stops it.
   */
  onUserStateChange(listener: () => void): () => void;
  /** The app is in the foreground, at launch or on a return: syncs. */
  foreground(): void;
  /** The app went to the background: nothing waits to sync until it comes back. */
  background(): void;
}

const { syncCursor, syncSyncedAt } = userStateRecords;

/**
 * Opens Sync apart from the composition, like the Account (ADR 0037), over
 * the tracked user state every module writes through, with the time of the
 * last sync the device kept. Signed out, it forgets what a Session that ended
 * before the launch left.
 */
export async function openSync({
  userState,
  api,
  account,
  edition,
  clock,
  schedule,
  random,
}: {
  userState: TrackedUserState;
  api: SyncApi;
  account: Pick<Account, 'state' | 'subscribe' | 'withSession'>;
  /** The Edition as the app runs it, with each Feature Switch at its effective value. */
  edition: Pick<Edition, 'isFeatureEnabled'>;
  clock: Clock;
  /** What the waits wait by: after a write, between tries, and for `Retry-After`. */
  schedule: Schedule;
  /** What the waits between tries are jittered by. */
  random: Random;
}): Promise<Sync> {
  const exchange = createSyncExchange({ userState, api });
  const subscribers = createSubscribers();
  const changeListeners = createSubscribers();
  const signedIn = () => account.state.status === 'signed-in';

  /** Forgets the cursor and the time of the last sync of a Session that ended. */
  async function forgetSession(): Promise<void> {
    const kept =
      (await userState.cursor()) !== undefined ||
      (await userState.read(syncSyncedAt)) !== undefined;
    if (kept) {
      await userState.write(
        new Map([...syncCursor.change(undefined), ...syncSyncedAt.change(undefined)]),
      );
    }
  }

  if (!signedIn()) await forgetSession();
  const kept = await userState.read(syncSyncedAt).catch(() => undefined);
  let state: SyncState = {
    syncedAt: kept === undefined ? undefined : new Date(kept),
    running: false,
    offline: false,
  };
  let inForeground = false;
  /** The syncs running and asked for after them, if one runs. */
  let draining: Promise<void> | undefined;
  let again = false;
  /** Whether the cursor and the time of the last sync belong to a Session that ended. */
  let sessionOutdated = false;
  /** How many Sessions have ended: a sync of an earlier one says nothing of this one. */
  let endedSessions = 0;
  /** Until when, in milliseconds, nothing syncs, by a 429's `Retry-After`. */
  let heldUntil: number | undefined;
  let cancelAfterWrite: (() => void) | undefined;
  let cancelHeld: (() => void) | undefined;

  function change(next: Partial<SyncState>): void {
    state = { ...state, ...next };
    subscribers.tell();
  }

  /** One sync with the Session, tried again by the one rule while the Session lasts. */
  async function syncOnce(): Promise<void> {
    if (!edition.isFeatureEnabled('account') || !edition.isFeatureEnabled('sync')) return;
    if (!signedIn()) return;
    const session = endedSessions;
    const ended: SyncResult = { ok: false, reason: 'unauthorized', changed: false };
    change({ running: true });
    /** Whether a pull wrote a record, or may have, in any try. */
    let changed = false;
    let result: SyncResult | undefined;
    try {
      result = await account.withSession((token) =>
        withRetries(
          async () => {
            // A Session that ended on the way is no more tried; the Account knows it ended.
            if (session !== endedSessions) return ended;
            const tried = await exchange.sync(token);
            changed ||= tried.changed;
            return tried;
          },
          { schedule, random },
        ),
      );
    } catch {
      // Silent: the user state failed to be read or written, and the next moment tries again.
      changed = true;
    }
    if (changed) changeListeners.tell();
    if (session !== endedSessions || result === undefined) {
      change({ running: false });
      return;
    }
    if (!result.ok && result.reason === 'too-many-requests' && result.retryAfter !== undefined) {
      heldUntil = clock.now().getTime() + result.retryAfter * 1000;
      holdOn();
    }
    if (!result.ok) {
      change({ running: false, offline: result.reason === 'offline' });
      return;
    }
    const syncedAt = clock.now();
    // Kept for the next launch; one that fails to be kept shows the one before then.
    await userState.write(syncSyncedAt.change(syncedAt.toISOString())).catch(() => undefined);
    // A Session that ended meanwhile cleared the snapshot, and its time is forgotten next.
    change(
      session === endedSessions ? { running: false, offline: false, syncedAt } : { running: false },
    );
  }

  /** Whether a moment or the end of a Session waits for the sync that runs. */
  const waiting = () => again || sessionOutdated;

  /** Runs syncs while moments ask for them, forgetting an ended Session's before each and after the last. */
  async function drain(): Promise<void> {
    do {
      again = false;
      if (sessionOutdated) {
        sessionOutdated = false;
        // What fails to be forgotten is forgotten at the next launch signed out.
        await forgetSession().catch(() => undefined);
      }
      if (!held()) await syncOnce();
    } while (waiting());
  }

  /** Starts the syncs asked for, unless they run. */
  function startDraining(): void {
    draining ??= drain().finally(() => {
      draining = undefined;
    });
  }

  /** Whether a 429 holds syncs back now. */
  function held(): boolean {
    return heldUntil !== undefined && clock.now().getTime() < heldUntil;
  }

  /** Syncs when the hold of a 429 ends, while in the foreground. */
  function holdOn(): void {
    if (!inForeground || heldUntil === undefined || cancelHeld !== undefined) return;
    cancelHeld = schedule(() => {
      cancelHeld = undefined;
      heldUntil = undefined;
      want();
    }, heldUntil - clock.now().getTime());
  }

  /** A moment to sync: now, after the sync that runs, or when a 429's hold ends. */
  function want(): void {
    cancelAfterWrite?.();
    cancelAfterWrite = undefined;
    if (draining !== undefined) {
      again = true;
      return;
    }
    if (held()) {
      holdOn();
      return;
    }
    startDraining();
  }

  userState.subscribe(() => {
    if (!inForeground) return;
    cancelAfterWrite?.();
    cancelAfterWrite = schedule(() => {
      cancelAfterWrite = undefined;
      want();
    }, SYNC_AFTER_WRITE);
  });

  let wasSignedIn = signedIn();
  account.subscribe(() => {
    if (signedIn() === wasSignedIn) return;
    wasSignedIn = signedIn();
    if (wasSignedIn) {
      if (inForeground) want();
      return;
    }
    endedSessions += 1;
    heldUntil = undefined;
    cancelHeld?.();
    cancelHeld = undefined;
    change({ syncedAt: undefined, offline: false });
    sessionOutdated = true;
    startDraining();
  });

  return {
    get state() {
      return state;
    },
    subscribe: subscribers.subscribe,
    onUserStateChange: changeListeners.subscribe,
    foreground() {
      inForeground = true;
      want();
    },
    background() {
      inForeground = false;
      cancelAfterWrite?.();
      cancelAfterWrite = undefined;
      cancelHeld?.();
      cancelHeld = undefined;
    },
  };
}
