import { z } from 'zod';

import { declareRecords, InstantSchema } from '../user-state/user-state-record';

/** A change of one Community Counter: one taken away, none or one added. */
const CounterChangeSchema = z.literal([-1, 0, 1]);

/** The records of the Community Counters. */
export const communityCounterRecords = {
  /**
   * What this device counted for the Community Counters, one record per
   * Entry, by Entry id: the mark it counted, or none, and whether it counted
   * the Entry saved (ADR 0060). A device starts with none at the update, so
   * nothing from before it is ever counted. It stays on the device: what one
   * device counted is not the Account's. A new key, so no migration.
   */
  countersCounted: declareRecords(
    'counters.counted.',
    z.object({ mark: z.enum(['known', 'unknown']).nullable(), saved: z.boolean() }),
    { sync: 'device-only' },
  ),
  /**
   * The Community Counter changes counted and not yet sent, one record per
   * Entry, by Entry id: the change of its known, unknown and saved counts,
   * merged (ADR 0060). It stays on the device. A new key, so no migration.
   */
  countersUnsent: declareRecords(
    'counters.unsent.',
    z.object({
      known: CounterChangeSchema,
      unknown: CounterChangeSchema,
      saved: CounterChangeSchema,
    }),
    { sync: 'device-only' },
  ),
  /**
   * The Community Counters this device read from the backend, one record per
   * Entry, by Entry id: its known, unknown and saved counts and when they
   * were read, kept for 24 hours (ADR 0060). It stays on the device: the
   * server's numbers are no reader's own. A new key, so no migration.
   */
  countersRead: declareRecords(
    'counters.read.',
    z.object({
      readAt: InstantSchema,
      known: z.int().nonnegative(),
      unknown: z.int().nonnegative(),
      saved: z.int().nonnegative(),
    }),
    { sync: 'device-only' },
  ),
};
