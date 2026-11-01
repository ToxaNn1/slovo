import {
  compareTimesOfDay,
  dateKeyOf,
  formatTimeOfDay,
  parseTimeOfDay,
  type LocalDate,
  type TimeOfDay,
} from '../local-date';
import type { UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** When a notification comes: a local date and a local time of day. */
export interface Slot {
  readonly date: LocalDate;
  readonly time: TimeOfDay;
}

/** A Word planned for the notification at a slot, which Reserves it. */
export interface PlannedWord {
  readonly slot: Slot;
  readonly wordId: string;
}

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
  replace(planned: readonly PlannedWord[]): Promise<void>;
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
  /** The morning Word of a local day: the Word of the earliest notification planned that day, if any. */
  morningWordOf(date: LocalDate): Promise<string | undefined>;
  /** Whether a notification is planned with the Word. */
  isReserved(wordId: string): Promise<boolean>;
}

const { notificationPlan: planRecords } = userStateRecords;

/** The id of a notification's plan record: its local date and time joined with a `T`. */
export const slotId = ({ date, time }: Slot) => `${dateKeyOf(date)}T${formatTimeOfDay(time)}`;

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
          const next = new Map(planned.map(({ slot, wordId }) => [slotId(slot), wordId]));
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
      const prefix = `${dateKeyOf(date)}T`;
      const timeOf = (id: string) => parseTimeOfDay(id.slice(prefix.length));
      const [earliest] = [...records]
        .filter(([id]) => id.startsWith(prefix))
        .sort(([one], [other]) => compareTimesOfDay(timeOf(one), timeOf(other)));
      return earliest?.[1];
    },
    async isReserved(wordId) {
      return [...(await read()).values()].includes(wordId);
    },
  };
}
