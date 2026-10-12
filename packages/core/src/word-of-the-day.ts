import type { Cycle } from './cycle';
import { todayKey, parseLocalDate, type LocalDate } from './local-date';
import type { Clock } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** The Word of the Day of one local day. */
export interface WordOfTheDayChoice {
  readonly wordId: string;
  readonly date: LocalDate;
}

/**
 * The Word of the Day: one Word unseen in the Cycle, chosen once per local
 * day in the clock's time zone and kept in the user state with its date. It
 * is read from the user state once, when it opens, like the Cycle it chooses
 * from, so open one per app session over that Cycle and share it. A choice is
 * made in memory only once it is written.
 */
export interface WordOfTheDay {
  /** Today's Word of the Day if it is chosen already. Never chooses one. */
  chosen(): WordOfTheDayChoice | undefined;
  /**
   * Today's Word of the Day, chosen first when today has none yet or it is
   * no longer eligible: the next unseen Word in the Cycle order, other than
   * the day before's, so every day starts with a new Word. Words in `avoid` are passed
   * over while the Cycle has other unseen Words.
   *
   * When every Word is Seen, it starts a new Cycle first (`startedCycle`),
   * where nothing is Seen and `avoid` no longer counts. The new Cycle and the
   * choice are kept in one write, so neither is kept without the other.
   * Returns nothing when the Cycle covers no Word.
   */
  today(options?: {
    avoid?: ReadonlySet<string>;
  }): Promise<(WordOfTheDayChoice & { readonly startedCycle: boolean }) | undefined>;
}

const { wordOfTheDay: wordOfTheDayRecord } = userStateRecords;

export async function openWordOfTheDay({
  cycle,
  userState,
  clock,
}: {
  cycle: Cycle;
  userState: UserState;
  clock: Clock;
}): Promise<WordOfTheDay> {
  let record = await userState.read(wordOfTheDayRecord);

  /**
   * The next of the unseen Words in the Cycle order, other than the day
   * before's where it can be.
   */
  function nextWordId(
    unseen: readonly string[],
    dayBefore: string | undefined,
    avoid: ReadonlySet<string>,
  ) {
    const fresh = unseen.filter((id) => id !== dayBefore);
    return fresh.find((id) => !avoid.has(id)) ?? fresh[0] ?? unseen[0];
  }

  return {
    chosen() {
      return record?.date === todayKey(clock)
        ? { wordId: record.entryId, date: parseLocalDate(record.date) }
        : undefined;
    },
    async today({ avoid = new Set<string>() } = {}) {
      const today = todayKey(clock);
      // A Word of the Day no longer eligible, such as one Retired since, is chosen again.
      if (record?.date === today && cycle.covers(record.entryId)) {
        return { wordId: record.entryId, date: parseLocalDate(today), startedCycle: false };
      }
      const dayBefore = record?.entryId;
      let id = nextWordId(cycle.unseen().words, dayBefore, avoid);
      // Every Word is Seen, so the day starts a new Cycle, where nothing is Seen.
      const started =
        id === undefined && cycle.order().words.length > 0 ? await cycle.start() : undefined;
      if (started !== undefined) id = nextWordId(started.order.words, dayBefore, new Set());
      if (id === undefined) return undefined;
      const chosen = { entryId: id, date: today };
      await userState.write(
        new Map([...(started?.changes ?? []), ...wordOfTheDayRecord.change(chosen)]),
      );
      started?.commit();
      record = chosen;
      return { wordId: id, date: parseLocalDate(today), startedCycle: started !== undefined };
    },
  };
}
