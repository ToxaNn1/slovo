import { z } from 'zod';

import type { Cycle } from './cycle';
import { localDate, parseLocalDate, type LocalDate } from './local-date';
import type { Clock } from './ports';
import { readRecord, type UserState } from './user-state';

/** The Word of the Day of one local day. */
export interface WordOfTheDayChoice {
  readonly wordId: string;
  readonly date: LocalDate;
}

/**
 * The Word of the Day: one Word unseen in the Cycle, chosen once per local
 * day in the clock's time zone and kept in the user state with its date. It
 * is read from the user state once, when it opens, like the Cycle it chooses
 * from.
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

/**
 * The user-state record of the Word of the Day. Its key is from 0.2, when the
 * Feed held it, and stays as it is so no migration is needed.
 */
const KEY = 'feed.wordOfTheDay';

/** The Word of the Day and the local date it belongs to. */
const RecordSchema = z.object({ entryId: z.string(), date: z.string() });

export async function openWordOfTheDay({
  cycle,
  userState,
  clock,
}: {
  cycle: Cycle;
  userState: UserState;
  clock: Clock;
}): Promise<WordOfTheDay> {
  let record = await readRecord(userState, KEY, RecordSchema);

  /** The next unseen Word in the Cycle order, other than the day before's where it can be. */
  function nextWordId(dayBefore: string | undefined, avoid: ReadonlySet<string>) {
    const unseen = cycle.unseen().words;
    const fresh = unseen.filter((id) => id !== dayBefore);
    return fresh.find((id) => !avoid.has(id)) ?? fresh[0] ?? unseen[0];
  }

  return {
    chosen() {
      return record?.date === localDate(clock)
        ? { wordId: record.entryId, date: parseLocalDate(record.date) }
        : undefined;
    },
    async today({ avoid = new Set<string>() } = {}) {
      const today = localDate(clock);
      // A Word of the Day no longer eligible, such as one Retired since, is chosen again.
      if (record?.date === today && cycle.order().words.includes(record.entryId)) {
        return { wordId: record.entryId, date: parseLocalDate(today), startedCycle: false };
      }
      const dayBefore = record?.entryId;
      let changes = new Map<string, string | undefined>();
      let id = nextWordId(dayBefore, avoid);
      const startedCycle = id === undefined && cycle.order().words.length > 0;
      if (startedCycle) {
        // Every Word is Seen, so the day starts a new Cycle.
        changes = new Map(await cycle.start());
        id = nextWordId(dayBefore, new Set());
      }
      if (id === undefined) return undefined;
      record = { entryId: id, date: today };
      changes.set(KEY, JSON.stringify(record));
      await userState.write(changes);
      return { wordId: id, date: parseLocalDate(today), startedCycle };
    },
  };
}
