import { COUNTERS_BATCH_SIZE } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { answerOf } from '../backend';
import type {
  Backend,
  Clock,
  CounterEvent,
  Random,
  RequestFailure,
  Schedule,
  UserStateChanges,
} from '../ports';
import { withRetries } from '../retry';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import { forgetUnsentCounters, unsentAfterSending } from './counter-deltas';

/** How long the app waits, while it is in the foreground, between two sends of the unsent changes, in milliseconds. */
const SEND_EVERY = 5 * 60_000;

/**
 * The sending of this device's Community Counters (ADR 0060): the changes it
 * counted and not yet sent go to the backend in batches of at most
 * `COUNTERS_BATCH_SIZE` Entries, at launch, on each return to the foreground
 * and every few minutes while the app is open, each batch by the one retry
 * rule (ADR 0037). A request carries the Edition and the events alone: no
 * Account, no Session, no device id. A batch leaves the unsent changes when
 * the backend counts it, or refuses it as a request it never expects; it
 * stays offline, after a server error, for an Edition the backend doesn't
 * find, and after too many requests, until the answer's `Retry-After`.
 * Nothing goes out while the `communityCounters` Feature Switch is off in
 * effect or «Ділитися анонімною статистикою» is off, both read each time.
 * Nothing it does rejects.
 */
export interface CounterSending {
  /** The app is in the foreground, at launch or on a return: sends now, and every few minutes until `background`. */
  foreground(): void;
  /** The app went to the background: no more sends until the next `foreground`. */
  background(): void;
}

/**
 * Opens the sending of the Community Counters over the user state the
 * Knowledge Marks and Favorites write their unsent changes to, for the shell
 * to open beside the Core composition, like the counters' reads.
 */
export function openCounterSending({
  edition,
  backend,
  userState,
  clock,
  schedule,
  random,
}: {
  /** The Edition as the app runs it, with each Feature Switch at its effective value. */
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
  backend: Pick<Backend, 'counters'>;
  userState: Pick<UserState, 'read' | 'list' | 'write'>;
  clock: Clock;
  /** What the waits between tries and between sends wait by. */
  schedule: Schedule;
  /** What the waits between tries are jittered by. */
  random: Random;
}): CounterSending {
  const { countersRead, countersUnsent, shareCounters } = userStateRecords;

  /**
   * Sends the changes of 1 to 100 Entries, each once, with no Session and no
   * device id (ADR 0060); the backend counts them whole or not at all, or
   * answers `not-found` for an Edition it doesn't serve or counters off.
   */
  async function send(
    events: readonly CounterEvent[],
  ): Promise<
    { readonly ok: true } | RequestFailure | { readonly ok: false; readonly reason: 'not-found' }
  > {
    const answer = await answerOf(
      backend.counters.send({ editionId: edition.id, events: [...events] }),
      ({ code }) =>
        code === 'NOT_FOUND' ? ({ ok: false, reason: 'not-found' } as const) : undefined,
    );
    return answer.ok ? { ok: true } : answer;
  }
  /** Until when, in milliseconds, nothing goes out, by a 429's `Retry-After`. */
  let heldUntil: number | undefined;
  let draining = false;
  let again = false;
  let stopSending: (() => void) | undefined;

  /**
   * The changes that add what the backend just counted to the numbers kept
   * from the last read, so the reader's own change stays in the line once it
   * leaves the unsent changes, until the numbers are read again.
   */
  async function readAfterCounting(events: readonly CounterEvent[]): Promise<UserStateChanges> {
    const changes = new Map<string, string | undefined>();
    for (const { entryId, known, unknown, saved } of events) {
      const read = await userState.read(countersRead.record(entryId));
      if (read === undefined) continue;
      const counted = {
        readAt: read.readAt,
        known: Math.max(0, read.known + known),
        unknown: Math.max(0, read.unknown + unknown),
        saved: Math.max(0, read.saved + saved),
      };
      for (const change of countersRead.record(entryId).change(counted)) changes.set(...change);
    }
    return changes;
  }

  const held = () => heldUntil !== undefined && clock.now().getTime() < heldUntil;

  /** Sends the first batch of the unsent changes; answers whether it left them, so the next may follow. */
  async function sendBatch(): Promise<boolean> {
    if (!edition.isFeatureEnabled('communityCounters') || held()) return false;
    if ((await userState.read(shareCounters)) === false) return false;
    const events: CounterEvent[] = [...(await userState.list(countersUnsent))]
      .slice(0, COUNTERS_BATCH_SIZE)
      .map(([entryId, delta]) => ({ entryId, ...delta }));
    if (events.length === 0) return false;
    const answer = await withRetries(() => send(events), { schedule, random });
    let changes: UserStateChanges;
    if (answer.ok) {
      heldUntil = undefined;
      changes = new Map([
        ...(await readAfterCounting(events)),
        ...(await unsentAfterSending(userState, events)),
      ]);
    } else {
      if (answer.reason === 'too-many-requests' && answer.retryAfter !== undefined) {
        heldUntil = clock.now().getTime() + answer.retryAfter * 1000;
      }
      if (answer.reason !== 'unexpected') return false;
      // The backend refused the batch as wrong, so it counted nothing of it: the
      // batch is dropped, and what this device counted of its Entries goes back
      // to what the backend has, as turning sharing off does, so nothing the
      // backend never counted is taken back and a later change counts as new.
      changes = await forgetUnsentCounters(
        userState,
        events.map(({ entryId }) => entryId),
      );
    }
    await userState.write(changes);
    // Sharing went off while the request was out: what it counted is forgotten too.
    if ((await userState.read(shareCounters)) === false) {
      await userState.write(await forgetUnsentCounters(userState));
    }
    return true;
  }

  /** Whether a call during the drain asked for one more. */
  const askedAgain = () => again;

  /** Sends the unsent changes, one drain at a time; a call during one drains once more after it. */
  async function drain(): Promise<void> {
    if (draining) {
      again = true;
      return;
    }
    draining = true;
    try {
      do {
        again = false;
        while (await sendBatch());
      } while (askedAgain());
    } catch {
      // Silent: the user state failed to be read or written, and the next send tries again.
    } finally {
      draining = false;
    }
  }

  /** Sends now and again after `SEND_EVERY`, until stopped. */
  function sendNowAndEvery(): void {
    void drain();
    stopSending = schedule(sendNowAndEvery, SEND_EVERY);
  }

  return {
    foreground() {
      stopSending?.();
      sendNowAndEvery();
    },
    background() {
      stopSending?.();
      stopSending = undefined;
    },
  };
}
