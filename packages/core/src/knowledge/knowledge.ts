import type { Edition } from '../edition/edition';
import { createInTurn, createSubscribers } from '../in-turn';
import { todayDate } from '../local-date';
import type { Clock } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import {
  answerKnowledge,
  isDue,
  shownMark,
  type KnowledgeMark,
  type KnowledgeRecord,
} from './knowledge-record';

/**
 * The Knowledge Marks of every Entry (ADR 0043), read from the user state
 * once, when they open, so open them once per app session (the Core
 * composition does). Today is the clock's local day at each call. A change is
 * made in memory only once it is written. With the `knowledge` Feature Switch
 * off nothing is marked, and the marks there are stay.
 */
export interface Knowledge {
  /** The Entry's record, or nothing when it has no mark. */
  recordOf(entryId: string): KnowledgeRecord | undefined;
  /** The mark the Entry's card shows today: none without a mark, and none while it is due. */
  markOf(entryId: string): KnowledgeMark | undefined;
  /** Whether the Entry is due for Review today. */
  isDue(entryId: string): boolean;
  /**
   * The reader taps a mark on the Entry's card: the mark the card shows
   * removes it, deleting the record; any other tap answers the Entry today,
   * as `answer` does.
   */
  tap(entryId: string, mark: KnowledgeMark): Promise<void>;
  /** Answers the Entry today by the interval rule alone, as a mistake in the Game does with Unknown. */
  answer(entryId: string, mark: KnowledgeMark): Promise<void>;
  /** Calls `listener` after each change of a record. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** Opens the Knowledge Marks over the user state, for the Core composition. */
export async function openKnowledge({
  edition,
  userState,
  clock,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
  clock: Clock;
}): Promise<Knowledge> {
  const { knowledge } = userStateRecords;
  let records: ReadonlyMap<string, KnowledgeRecord> = await userState.list(knowledge);
  const inTurn = createInTurn();
  const subscribers = createSubscribers();

  /** Keeps the Entry's next record, or deletes it for nothing, then tells the subscribers. */
  async function keep(entryId: string, record: KnowledgeRecord | undefined): Promise<void> {
    await userState.write(knowledge.record(entryId).change(record));
    const changed = new Map(records);
    if (record === undefined) changed.delete(entryId);
    else changed.set(entryId, record);
    records = changed;
    subscribers.tell();
  }

  /** Marks the Entry by the change the record and today give, unless the switch is off. */
  const change = (
    entryId: string,
    next: (record: KnowledgeRecord | undefined) => KnowledgeRecord | undefined,
  ) =>
    inTurn(async () => {
      if (!edition.isFeatureEnabled('knowledge')) return;
      await keep(entryId, next(records.get(entryId)));
    });

  return {
    recordOf: (entryId) => records.get(entryId),
    markOf: (entryId) => shownMark(records.get(entryId), todayDate(clock)),
    isDue: (entryId) => isDue(records.get(entryId), todayDate(clock)),
    tap: (entryId, mark) =>
      change(entryId, (record) => {
        const today = todayDate(clock);
        return shownMark(record, today) === mark ? undefined : answerKnowledge(record, mark, today);
      }),
    answer: (entryId, mark) =>
      change(entryId, (record) => answerKnowledge(record, mark, todayDate(clock))),
    subscribe: subscribers.subscribe,
  };
}
