import type { Cycle } from './cycle';
import { createInTurn } from './in-turn';
import { todayKey, parseLocalDate, type LocalDate } from './local-date';
import type { Clock, UserStateChanges } from './ports';
import { createReservedWords } from './reserved-words';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** The Word of the Day of one local day. */
export interface WordOfTheDayChoice {
  readonly wordId: string;
  readonly date: LocalDate;
}

/**
 * The Word of the Day: one Word unseen in the Cycle, chosen once per local
 * day in the clock's time zone and kept in the user state with its date. Its
 * record is read once, when it opens, like the Cycle it chooses from, so open
 * one per app session over that Cycle and share it; only while today has no
 * Word kept does it read the Reserved Words for this morning's (ADR 0013). A
 * choice is made in memory only once it is written.
 */
export interface WordOfTheDay {
  /** Today's Word of the Day if it is chosen already. Never chooses one. */
  chosen(): WordOfTheDayChoice | undefined;
  /**
   * Takes the Word the notification plan Reserved for this morning as
   * today's Word of the Day, when today has none yet or it is no longer
   * eligible, and that Word is eligible, unseen and not the day before's.
   * Nothing changes otherwise: it never chooses another Word and never starts
   * a Cycle, so the composition can call it when a new day comes.
   */
  takeMorningWord(): Promise<void>;
  /**
   * Today's Word of the Day, chosen first when today has none yet or it is
   * no longer eligible: the Word the notification plan Reserved for this
   * morning while it is eligible, unseen and not the day before's (see
   * `takeMorningWord`), else the next unseen Word in the Cycle order, other than
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
  const reservedWords = createReservedWords({ userState });

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

  /** The Word of today's record, unless today needs a Word of the Day chosen. */
  function kept(today: string): string | undefined {
    // A Word of the Day no longer eligible, such as one Retired since, is chosen again.
    return record?.date === today && cycle.covers(record.entryId) ? record.entryId : undefined;
  }

  /** Makes `entryId` today's Word of the Day, with the `changes` in the same write. */
  async function choose(entryId: string, today: string, changes: UserStateChanges = new Map()) {
    const chosen = { entryId, date: today };
    await userState.write(new Map([...changes, ...wordOfTheDayRecord.change(chosen)]));
    record = chosen;
  }

  /** The Word Reserved for this morning, if today takes it, kept as today's Word of the Day. */
  async function chooseMorningWord(today: string): Promise<string | undefined> {
    const reserved = await reservedWords.morningWordOf(parseLocalDate(today));
    if (reserved === undefined || reserved === record?.entryId) return undefined;
    if (!cycle.unseen().words.includes(reserved)) return undefined;
    await choose(reserved, today);
    return reserved;
  }

  // One choice at a time, so the plan and the Feed never choose apart.
  const inTurn = createInTurn();

  return {
    chosen() {
      return record?.date === todayKey(clock)
        ? { wordId: record.entryId, date: parseLocalDate(record.date) }
        : undefined;
    },
    takeMorningWord: () =>
      inTurn(async () => {
        const today = todayKey(clock);
        if (kept(today) === undefined) await chooseMorningWord(today);
      }),
    today: ({ avoid = new Set<string>() } = {}) =>
      inTurn(async () => {
        const today = todayKey(clock);
        const date = parseLocalDate(today);
        const id = kept(today) ?? (await chooseMorningWord(today));
        if (id !== undefined) return { wordId: id, date, startedCycle: false };
        const dayBefore = record?.entryId;
        let next = nextWordId(cycle.unseen().words, dayBefore, avoid);
        // Every Word is Seen, so the day starts a new Cycle, where nothing is Seen.
        const started =
          next === undefined && cycle.order().words.length > 0 ? await cycle.start() : undefined;
        if (started !== undefined) next = nextWordId(started.order.words, dayBefore, new Set());
        if (next === undefined) return undefined;
        await choose(next, today, started?.changes);
        started?.commit();
        return { wordId: next, date, startedCycle: started !== undefined };
      }),
  };
}
