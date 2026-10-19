import type { Edition } from '../edition/edition';
import type { EntryRowModel, EntryRows } from '../entries/entry-row';
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

/** An Entry the reader is learning, in the «Вчу» list. */
export interface LearningEntry {
  readonly entryId: string;
  /** The local day the Entry is due for Review, `YYYY-MM-DD`; today or earlier while it is due. */
  readonly reviewDay: string;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
}

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
   * The Entries due for Review today, in no set order, for the Feed to bring
   * back. None with the `knowledge` Feature Switch off.
   */
  due(): readonly string[];
  /**
   * The Entries the reader is weak on: marked Unknown or due for Review
   * today, in no set order, which the Game asks about in up to 5 of its
   * Rounds. None with the `knowledge` Feature Switch off.
   */
  weak(): readonly string[];
  /**
   * The Entries the reader is learning: every Entry marked Unknown that is not
   * yet Learned, Known on a Review since or not, sorted by the next Review
   * day. An id the Language Pack doesn't have is left out. None with the
   * `knowledge` Feature Switch off.
   */
  learning(): Promise<readonly LearningEntry[]>;
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
  rows,
  userState,
  clock,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  rows: EntryRows;
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
    due() {
      if (!edition.isFeatureEnabled('knowledge')) return [];
      const today = todayDate(clock);
      return [...records].flatMap(([entryId, record]) => (isDue(record, today) ? [entryId] : []));
    },
    weak() {
      if (!edition.isFeatureEnabled('knowledge')) return [];
      const today = todayDate(clock);
      return [...records].flatMap(([entryId, record]) =>
        record.mark === 'unknown' || isDue(record, today) ? [entryId] : [],
      );
    },
    async learning() {
      if (!edition.isFeatureEnabled('knowledge')) return [];
      const reviews = [...records]
        .flatMap(([entryId, { reviewDay }]) => (reviewDay === null ? [] : [{ entryId, reviewDay }]))
        .sort((a, b) => a.reviewDay.localeCompare(b.reviewDay));
      const listed = await Promise.all(
        reviews.map(async (review) => {
          const row = await rows.row(review.entryId);
          return row === undefined ? [] : [{ ...review, row }];
        }),
      );
      return listed.flat();
    },
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
