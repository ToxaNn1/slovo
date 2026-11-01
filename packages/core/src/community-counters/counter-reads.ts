import { COUNTERS_BATCH_SIZE } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { answerOf } from '../backend';
import type { Backend, Clock, EntryCounters } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** How long the device keeps an Entry's numbers before it asks again, in milliseconds (ADR 0060). */
const KEPT_FOR = 24 * 60 * 60 * 1000;

/**
 * What the line under an Entry's mark buttons says: «Знають {known} з {total}
 * читачів · зберегли {saved}», total = known + unknown (ADR 0060).
 */
export interface CounterLine {
  readonly known: number;
  readonly total: number;
  readonly saved: number;
}

/** The Community Counters as this device reads them (ADR 0060). */
export interface CounterReads {
  /**
   * The lines of the Entries, those near the current Feed card or the one on
   * the Entry screen, by Entry id. The numbers kept from the last 24 hours
   * hold; the Entries without them are asked for in requests of at most
   * `COUNTERS_BATCH_SIZE` Entries, and the answers are kept. The reader's own change not yet sent is applied on top,
   * no count below zero, and one sent since the numbers were read stays in
   * them. An Entry with no numbers from the last 24 hours and
   * no answer, as offline, has no line, and with the `communityCounters`
   * Feature Switch off none has. It never rejects on a failed request.
   */
  lines(entryIds: readonly string[]): Promise<ReadonlyMap<string, CounterLine>>;
}

/**
 * Opens the reads of the Community Counters over the user state, which the
 * Knowledge Marks write the unsent changes to, for the shell to open beside
 * the Core composition over the same user state.
 */
export function openCounterReads({
  edition,
  backend,
  userState,
  clock,
}: {
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
  backend: Pick<Backend, 'counters'>;
  userState: Pick<UserState, 'read' | 'write'>;
  clock: Clock;
}): CounterReads {
  const { countersRead, countersUnsent } = userStateRecords;

  /** The numbers kept for each Entry and read in the last 24 hours. */
  async function keptOf(entryIds: readonly string[], now: number) {
    const kept = new Map<string, Omit<EntryCounters, 'entryId'>>();
    for (const entryId of entryIds) {
      const read = await userState.read(countersRead.record(entryId));
      if (read !== undefined && now - Date.parse(read.readAt) < KEPT_FOR) kept.set(entryId, read);
    }
    return kept;
  }

  return {
    async lines(entryIds) {
      if (!edition.isFeatureEnabled('communityCounters')) return new Map();
      const now = clock.now();
      const counts = await keptOf(entryIds, now.getTime());
      const missing = entryIds.filter((entryId) => !counts.has(entryId));
      for (let start = 0; start < missing.length; start += COUNTERS_BATCH_SIZE) {
        const batch = missing.slice(start, start + COUNTERS_BATCH_SIZE);
        // `counters.read` needs no Account, sends no Session and carries no device id (ADR 0060).
        const reply = await answerOf(
          backend.counters.read({ edition: edition.id, entries: batch.join(',') }),
        );
        if (reply.ok) {
          const readAt = now.toISOString();
          await userState.write(
            new Map(
              reply.output.counters.flatMap(({ entryId, ...read }) => {
                counts.set(entryId, read);
                return [...countersRead.record(entryId).change({ readAt, ...read })];
              }),
            ),
          );
        }
      }
      const lines = new Map<string, CounterLine>();
      for (const entryId of entryIds) {
        const read = counts.get(entryId);
        if (read === undefined) continue;
        const unsent = await userState.read(countersUnsent.record(entryId));
        const known = Math.max(0, read.known + (unsent?.known ?? 0));
        const unknown = Math.max(0, read.unknown + (unsent?.unknown ?? 0));
        const saved = Math.max(0, read.saved + (unsent?.saved ?? 0));
        lines.set(entryId, { known, total: known + unknown, saved });
      }
      return lines;
    },
  };
}
