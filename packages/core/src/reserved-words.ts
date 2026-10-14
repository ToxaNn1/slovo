import type { PlannedNotification, UserStateChanges } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** When a notification comes: a local date `YYYY-MM-DD` and a local time `HH:MM`. */
export type Slot = Pick<PlannedNotification, 'date' | 'time'>;

/** The plan as it is stored: the Word Reserved for each planned notification. */
export interface StoredPlan {
  /** Every Reserved Word. */
  readonly words: readonly string[];
  /** The Word Reserved for the notification at `slot`; nothing when none is planned there. */
  wordAt(slot: Slot): string | undefined;
  /**
   * Keeps `planned` as the plan in place of this one, in one write of the
   * notifications that changed, so every other Word stops being Reserved.
   * Nothing is written when nothing changed.
   */
  replace(planned: readonly Pick<PlannedNotification, 'date' | 'time' | 'wordId'>[]): Promise<void>;
}

/**
 * The Reserved Words (glossary): the Words the notification plan promised to
 * its notifications, kept as the plan records of the user state, one per
 * notification (ADR 0021), so Reserved is never stored on its own. The plan
 * writes them, the Word of the Day reads a day's morning Word from them (ADR
 * 0016's amendment for 0.4), and Notifications asks whether a Word is
 * Reserved. Only this module knows how the records are keyed. Each question
 * reads the stored plan once, so it holds nothing in memory and any number of
 * modules can ask it.
 */
export interface ReservedWords {
  /** The stored plan, read once, for the plan to make the next one from and replace. */
  stored(): Promise<StoredPlan>;
  /**
   * The morning Word of the local day `date` (`YYYY-MM-DD`): the Word of the
   * earliest notification planned that day, if any.
   */
  morningWordOf(date: string): Promise<string | undefined>;
  /** Whether a notification is planned with the Word. */
  isReserved(wordId: string): Promise<boolean>;
}

const { notificationPlan: planRecords } = userStateRecords;

/** The id of a notification's plan record: its local date and time joined with a `T`. */
const slotId = ({ date, time }: Slot) => `${date}T${time}`;

export function createReservedWords({ userState }: { userState: UserState }): ReservedWords {
  /** The Word of each plan record, by its id. */
  const read = () => userState.list(planRecords);

  return {
    async stored() {
      const records = await read();
      return {
        words: [...records.values()],
        wordAt: (slot) => records.get(slotId(slot)),
        async replace(planned) {
          const next = new Map(planned.map((reserved) => [slotId(reserved), reserved.wordId]));
          const changes: UserStateChanges = new Map([
            ...[...records.keys()]
              .filter((id) => !next.has(id))
              .flatMap((id) => [...planRecords.record(id).change(undefined)]),
            ...[...next]
              .filter(([id, wordId]) => records.get(id) !== wordId)
              .flatMap(([id, wordId]) => [...planRecords.record(id).change(wordId)]),
          ]);
          if (changes.size > 0) await userState.write(changes);
        },
      };
    },
    async morningWordOf(date) {
      const records = await read();
      const [earliest] = [...records.keys()].filter((id) => id.startsWith(`${date}T`)).sort();
      return earliest === undefined ? undefined : records.get(earliest);
    },
    async isReserved(wordId) {
      return [...(await read()).values()].includes(wordId);
    },
  };
}
