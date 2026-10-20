import type { Edition } from '../edition/edition';
import type { EntryRowModel, EntryRows } from '../entries/entry-row';
import { createInTurn, createSubscribers } from '../in-turn';
import { dayNumber, parseLocalDate, todayDate } from '../local-date';
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
  /** The local days from today to its next Review: 0 for today, negative for a day past; due at 0 or less. */
  readonly daysUntilReview: number;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
}

/** What an Entry's card shows about knowledge: its Knowledge Mark, or none while it is due, as a Review. */
export type ShownKnowledge = KnowledgeMark | 'review';

/**
 * The Knowledge Marks as they stand on today's local day. All empty and 0
 * with the `knowledge` Feature Switch off.
 */
export interface KnowledgeState {
  /**
   * The Entries the reader is learning: every Entry marked Unknown that is not
   * yet Learned, Known on a Review since or not, sorted by the next Review
   * day. An id the Language Pack doesn't have is left out.
   */
  readonly learning: readonly LearningEntry[];
  /** The Words marked Known, Learned or not. An id the Language Pack doesn't have is no Word. */
  readonly knownWords: number;
  /** The Corrections marked Known, Learned or not. */
  readonly knownCorrections: number;
  /** The Entries due for Review today, in no set order, for the Feed to bring back and Progress to count. */
  readonly due: readonly string[];
  /**
   * What the card of each marked Entry shows, on every surface (the Feed and
   * every Entry screen): its Knowledge Mark, or `review` while it is due, when
   * the card shows no mark and is labelled «Повторення». An Entry not in it
   * shows neither.
   */
  readonly shown: ReadonlyMap<string, ShownKnowledge>;
}

/**
 * The Knowledge Marks of every Entry (ADR 0043), read from the user state
 * once, when they open, so open them once per app session (the Core
 * composition does). A change is made in memory only once it is written.
 * With the `knowledge` Feature Switch off nothing is marked, and the marks
 * there are stay.
 */
export interface Knowledge {
  /**
   * The marks as they stand, made again when a mark changes and when the
   * composition turns to a new local day. A change never edits it: it makes
   * a new one and tells the subscribers, so it stays the same object until
   * something changes.
   */
  readonly state: KnowledgeState;
  /**
   * The Entries the reader is weak on: marked Unknown or due for Review
   * today, in no set order, which the Game asks about in up to 5 of its
   * Rounds. None with the `knowledge` Feature Switch off.
   */
  weak(): readonly string[];
  /**
   * The reader taps a mark on the Entry's card: the mark the card shows
   * removes it, deleting the record; any other tap answers the Entry today,
   * as `answer` does.
   */
  tap(entryId: string, mark: KnowledgeMark): Promise<void>;
  /** Answers the Entry today by the interval rule alone, as a mistake in the Game does with Unknown. */
  answer(entryId: string, mark: KnowledgeMark): Promise<void>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** The state with the `knowledge` Feature Switch off. */
const off: KnowledgeState = {
  learning: [],
  knownWords: 0,
  knownCorrections: 0,
  due: [],
  shown: new Map(),
};

const sameState = (one: KnowledgeState, other: KnowledgeState) =>
  one.knownWords === other.knownWords &&
  one.knownCorrections === other.knownCorrections &&
  one.due.length === other.due.length &&
  one.due.every((entryId, place) => other.due[place] === entryId) &&
  one.shown.size === other.shown.size &&
  [...one.shown].every(([entryId, shown]) => other.shown.get(entryId) === shown) &&
  one.learning.length === other.learning.length &&
  one.learning.every(
    (entry, place) =>
      other.learning[place]?.entryId === entry.entryId &&
      other.learning[place].daysUntilReview === entry.daysUntilReview,
  );

/**
 * Opens the Knowledge Marks over the user state, for the Core composition,
 * with `followDay`, which the day change calls when it turns to a new local
 * day so the state follows it.
 */
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
}): Promise<{ knowledge: Knowledge; followDay: () => void }> {
  const { knowledge } = userStateRecords;
  let records: ReadonlyMap<string, KnowledgeRecord> = await userState.list(knowledge);
  const inTurn = createInTurn();
  const subscribers = createSubscribers();
  /** The row of each marked Entry the Language Pack has, so the state needs no read. */
  const rowOf = new Map<string, EntryRowModel>();

  /** Reads the Entry's row, once. */
  async function readRow(entryId: string): Promise<void> {
    if (rowOf.has(entryId)) return;
    const row = await rows.row(entryId);
    if (row !== undefined) rowOf.set(entryId, row);
  }
  await Promise.all([...records.keys()].map(readRow));

  /** The state of the records on today's local day, the `knowledge` Feature Switch aside. */
  function stateOf(): KnowledgeState {
    const today = todayDate(clock);
    const reviews: { entryId: string; reviewDay: string }[] = [];
    const due: string[] = [];
    const shown = new Map<string, ShownKnowledge>();
    let knownWords = 0;
    let knownCorrections = 0;
    for (const [entryId, record] of records) {
      if (record.reviewDay !== null) reviews.push({ entryId, reviewDay: record.reviewDay });
      if (isDue(record, today)) due.push(entryId);
      shown.set(entryId, shownMark(record, today) ?? 'review');
      if (record.mark !== 'known') continue;
      const kind = rowOf.get(entryId)?.kind;
      if (kind === 'word') knownWords += 1;
      if (kind === 'correction') knownCorrections += 1;
    }
    const learning = reviews
      .sort((a, b) => a.reviewDay.localeCompare(b.reviewDay))
      .flatMap(({ entryId, reviewDay }) => {
        const row = rowOf.get(entryId);
        const daysUntilReview = dayNumber(parseLocalDate(reviewDay)) - dayNumber(today);
        return row === undefined ? [] : [{ entryId, daysUntilReview, row }];
      });
    return { learning, knownWords, knownCorrections, due, shown };
  }

  let state = stateOf();

  /** Makes the state again, and tells the subscribers when it changed. */
  function follow(): void {
    const next = stateOf();
    if (sameState(next, state)) return;
    state = next;
    subscribers.tell();
  }

  /** Keeps the Entry's next record, or deletes it for nothing, then follows it. */
  async function keep(entryId: string, record: KnowledgeRecord | undefined): Promise<void> {
    await userState.write(knowledge.record(entryId).change(record));
    const changed = new Map(records);
    if (record === undefined) changed.delete(entryId);
    else changed.set(entryId, record);
    records = changed;
    follow();
  }

  /** Marks the Entry by the change the record and today give, unless the switch is off. */
  const change = (
    entryId: string,
    next: (record: KnowledgeRecord | undefined) => KnowledgeRecord | undefined,
  ) =>
    inTurn(async () => {
      if (!edition.isFeatureEnabled('knowledge')) return;
      await readRow(entryId);
      await keep(entryId, next(records.get(entryId)));
    });

  return {
    knowledge: {
      get state() {
        // The switch is read at each call, as the remote switches can turn it off while the app runs.
        return edition.isFeatureEnabled('knowledge') ? state : off;
      },
      weak() {
        if (!edition.isFeatureEnabled('knowledge')) return [];
        const today = todayDate(clock);
        return [...records].flatMap(([entryId, record]) =>
          record.mark === 'unknown' || isDue(record, today) ? [entryId] : [],
        );
      },
      tap: (entryId, mark) =>
        change(entryId, (record) => {
          const today = todayDate(clock);
          return shownMark(record, today) === mark
            ? undefined
            : answerKnowledge(record, mark, today);
        }),
      answer: (entryId, mark) =>
        change(entryId, (record) => answerKnowledge(record, mark, todayDate(clock))),
      subscribe: subscribers.subscribe,
    },
    followDay: follow,
  };
}
