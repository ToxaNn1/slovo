import type { EntryKind, Rarity } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { EntryRowModel, EntryRows } from '../entries/entry-row';
import type { HiddenEntries } from '../mix/hidden-entries';
import { createInTurn, createSubscribers } from '../in-turn';
import { dayNumber, parseLocalDate, todayDate, type LocalDate } from '../local-date';
import type { Clock, UserStateChanges } from '../ports';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import {
  answerKnowledge,
  confirmsOnKnown,
  isDue,
  shownMark,
  type KnowledgeMark,
  type KnowledgeRecord,
} from './knowledge-record';

/** The record a Review answer appends in the XP log, and the step that makes it in memory once written. */
interface ReviewXpAward {
  readonly changes: UserStateChanges;
  commit(): void;
}

/** What Knowledge needs of the XP log (ADR 0066): the XP of a Review answer. */
export interface ReviewXp {
  award(action: { readonly source: 'review-answer'; readonly entryId: string }): ReviewXpAward;
}

/** An Entry the reader is learning, in the «Вчу» list. */
export interface LearningEntry {
  readonly entryId: string;
  /** The local days from today to its next Review: 0 for today, negative for a day past; due at 0 or less. */
  readonly daysUntilReview: number;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
}

/**
 * The Entries marked Known, Learned or not, counted by their kind of Entry
 * (Idioms with place names), Synonym Rows and Tips too (spec #730 story 37).
 * An id the Language Pack doesn't have is counted as no kind.
 */
export type KnownCounts = Readonly<Record<EntryKind, number>>;

/**
 * The confirmed Entries (ADR 0043): Known on a Review of 7 days or later, or
 * answered right in a Game or a Quick Question. Every confirmed Entry the
 * Language Pack has counts in the total; a Word counts by its rarity too.
 */
export interface ConfirmedCounts {
  readonly total: number;
  readonly byRarity: Readonly<Record<Rarity, number>>;
}

/** What an Entry's card shows about knowledge: its Knowledge Mark, or none while it is due, as a Review. */
export type ShownKnowledge = KnowledgeMark | 'review';

/**
 * The Knowledge Marks as they stand on today's local day. A Hidden Entry is
 * left out of `learning` and `due` until it is restored; the Mix and the
 * Rarity Ceiling leave them as they are, and the Feed and the Game skip what
 * is not eligible themselves. All empty and 0 with the `knowledge` Feature
 * Switch off.
 */
export interface KnowledgeState {
  /**
   * The Entries the reader is learning: every Entry marked Unknown that is not
   * yet Learned, Known on a Review since or not, sorted by the next Review
   * day. An id the Language Pack doesn't have is left out.
   */
  readonly learning: readonly LearningEntry[];
  /** The Entries marked Known, by kind; the same object until a count changes. */
  readonly known: KnownCounts;
  /**
   * The confirmed Entries, which the Profile and the Badges count, a Hidden
   * Entry too; the same object until a count changes.
   */
  readonly confirmed: ConfirmedCounts;
  // With the `confirmedEntries` Feature Switch off the confirmed counts are 0 and nothing is confirmed.
  /**
   * The Entries due for Review today, in no set order, for the Feed to bring
   * back, the Game to ask and Progress to count.
   */
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
   * The marks as they stand, made again when a mark changes, when an Entry
   * is hidden or restored and when the composition turns to a new local day.
   * A change never edits it: it makes a new one and tells the subscribers, so
   * it stays the same object until something changes.
   */
  readonly state: KnowledgeState;
  /**
   * The Entries the reader is weak on: marked Unknown or due for Review
   * today, a Hidden Entry left out, in no set order, which the Game asks
   * about in up to 5 of its Rounds. None with the `knowledge` Feature Switch
   * off.
   */
  weak(): readonly string[];
  /**
   * The reader taps a mark on the Entry's card: the mark the card shows
   * removes it, deleting the record; any other tap answers the Entry today,
   * as `answer` does. The change counts for the Community Counters (ADR 0060).
   * A tap on an Entry due for Review is a Review answer: it earns its XP, up
   * to the Edition's daily cap (ADR 0066).
   */
  tap(entryId: string, mark: KnowledgeMark): Promise<void>;
  /**
   * The reader sets a mark, by a swipe or the card's menu: the mark the card
   * shows already changes nothing; any other answers the Entry today, as a
   * tap does, and can be undone until the next change of a mark. The change
   * counts for the Community Counters (ADR 0060). A set on an Entry due for
   * Review is a Review answer: it earns its XP once per Entry on a local day,
   * up to the Edition's daily cap (ADR 0066).
   */
  set(entryId: string, mark: KnowledgeMark): Promise<void>;
  /**
   * The reader clears the Entry's mark from the card's menu, deleting its
   * record; nothing changes for an Entry with no record. The change counts
   * for the Community Counters.
   */
  clear(entryId: string): Promise<void>;
  /**
   * Undoes the last set while no other mark has changed since: the Entry's
   * record is again exactly what it was, or none, its confirmation too, and
   * the Community Counters count it back. The XP the set earned stays.
   * Nothing changes when there is no set to undo.
   */
  undo(): Promise<void>;
  /**
   * Answers the Entry today by the interval rule alone, as a mistake in the
   * Game does with Unknown. It counts nothing for the Community Counters.
   */
  answer(entryId: string, mark: KnowledgeMark): Promise<void>;
  /**
   * The reader answered the Entry right in a Game or a Quick Question: it is
   * confirmed from now on, its mark and Review as they are. Nothing changes
   * for an Entry confirmed before.
   */
  confirm(entryId: string): Promise<void>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const noneKnown: KnownCounts = { word: 0, correction: 0, idiom: 0, synonymRow: 0, tip: 0 };
const noneConfirmed: ConfirmedCounts = { total: 0, byRarity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

/** The state with the `knowledge` Feature Switch off. */
const off: KnowledgeState = {
  learning: [],
  known: noneKnown,
  confirmed: noneConfirmed,
  due: [],
  shown: new Map(),
};

const sameCounts = (one: KnownCounts, other: KnownCounts) =>
  (Object.keys(one) as EntryKind[]).every((kind) => one[kind] === other[kind]);

const sameConfirmed = (one: ConfirmedCounts, other: ConfirmedCounts) =>
  one.total === other.total &&
  (Object.keys(one.byRarity) as unknown as Rarity[]).every(
    (rarity) => one.byRarity[rarity] === other.byRarity[rarity],
  );

const sameState = (one: KnowledgeState, other: KnowledgeState) =>
  one.known === other.known &&
  one.confirmed === other.confirmed &&
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
 * Opens the Knowledge Marks over the user state, for the Core composition.
 * The state follows `dayStarted`, the new local day the day change turns to,
 * and a tapped mark writes `countMark`, the Community Counters' changes that
 * count it, with it; the marks name what they need of the counters, as the
 * counters read the marks' type.
 */
export async function openKnowledge({
  edition,
  rows,
  hiddenEntries,
  userState,
  clock,
  countMark,
  dayStarted,
  xp,
  reviewAnswered,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  rows: EntryRows;
  hiddenEntries: Pick<HiddenEntries, 'has' | 'subscribe'>;
  userState: UserState;
  clock: Clock;
  countMark: (entryId: string, mark: KnowledgeMark | undefined) => Promise<UserStateChanges>;
  dayStarted: Pick<Subject<LocalDate>, 'subscribe'>;
  /** The XP log, which a Review answer earns XP in. */
  xp: ReviewXp;
  /** Tells of the reader's answer to an Entry due for Review; it never throws. */
  reviewAnswered: (entryId: string, mark: KnowledgeMark) => Promise<void>;
}): Promise<Knowledge> {
  const { knowledge, confirmed: confirmedRecords } = userStateRecords;
  let records: ReadonlyMap<string, KnowledgeRecord> = await userState.list(knowledge);
  /** The confirmed Entries' ids; the instant of each is kept for the Badges' dates. */
  let confirmed: ReadonlySet<string> = new Set((await userState.list(confirmedRecords)).keys());
  const inTurn = createInTurn();
  /** The last set, while it can be undone: the Entry, its record before and whether the set confirmed it. */
  let undoable:
    { entryId: string; previous: KnowledgeRecord | undefined; confirmed: boolean } | undefined;
  /** The Entries whose Review answer earned XP on the local day numbered `day`. */
  let reviewed = { day: -1, entries: new Set<string>() };
  const subscribers = createSubscribers();
  /** The row of each marked or confirmed Entry the Language Pack has, so the state needs no read. */
  const rowOf = new Map(await rows.rows([...records.keys(), ...confirmed]));

  /** Reads the Entry's row, once. */
  async function readRow(entryId: string): Promise<void> {
    if (rowOf.has(entryId)) return;
    const row = await rows.row(entryId);
    if (row !== undefined) rowOf.set(entryId, row);
  }

  /** The confirmed-Entry counts, keeping the object `had` while they are the same. */
  function confirmedOf(had: ConfirmedCounts): ConfirmedCounts {
    let total = 0;
    const byRarity: Record<Rarity, number> = { ...noneConfirmed.byRarity };
    for (const entryId of confirmed) {
      const row = rowOf.get(entryId);
      if (row === undefined) continue;
      total += 1;
      if (row.kind === 'word') byRarity[row.rarity] += 1;
    }
    const counts = { total, byRarity };
    return sameConfirmed(counts, had) ? had : counts;
  }

  /**
   * The state of the records on today's local day, the `knowledge` Feature
   * Switch aside, keeping the `known` and `confirmed` counts it had while
   * they are the same.
   */
  function stateOf(had: Pick<KnowledgeState, 'known' | 'confirmed'> = off): KnowledgeState {
    const today = todayDate(clock);
    const reviews: { entryId: string; reviewDay: string }[] = [];
    const due: string[] = [];
    const shown = new Map<string, ShownKnowledge>();
    const counts = { ...noneKnown };
    for (const [entryId, record] of records) {
      const kind = rowOf.get(entryId)?.kind;
      if (record.mark === 'known' && kind !== undefined) counts[kind] += 1;
      // A Hidden Entry's card, opened where the reader keeps it, still shows its mark.
      shown.set(entryId, shownMark(record, today) ?? 'review');
      if (hiddenEntries.has(entryId)) continue;
      if (record.reviewDay !== null) reviews.push({ entryId, reviewDay: record.reviewDay });
      if (isDue(record, today)) due.push(entryId);
    }
    const learning = reviews
      .sort((a, b) => a.reviewDay.localeCompare(b.reviewDay))
      .flatMap(({ entryId, reviewDay }) => {
        const row = rowOf.get(entryId);
        const daysUntilReview = dayNumber(parseLocalDate(reviewDay)) - dayNumber(today);
        return row === undefined ? [] : [{ entryId, daysUntilReview, row }];
      });
    const known = sameCounts(counts, had.known) ? had.known : counts;
    return { learning, known, confirmed: confirmedOf(had.confirmed), due, shown };
  }

  let state = stateOf();
  /** The state with the confirmed counts hidden, of the state it was made from. */
  let hiding: { of: KnowledgeState; state: KnowledgeState } | undefined;
  hiddenEntries.subscribe(follow);

  /** Makes the state again, and tells the subscribers when it changed. */
  function follow(): void {
    const next = stateOf(state);
    if (sameState(next, state)) return;
    state = next;
    subscribers.tell();
  }

  /** The change that confirms the Entry now, or none when it is confirmed already. */
  const confirmation = (entryId: string): UserStateChanges =>
    confirmed.has(entryId)
      ? new Map()
      : confirmedRecords.record(entryId).change(clock.now().toISOString());

  /**
   * Whether the Entry's Review answer is its first on today's local day, and
   * keeps that it was answered.
   */
  function firstReviewToday(entryId: string): boolean {
    const day = dayNumber(todayDate(clock));
    if (reviewed.day !== day) reviewed = { day, entries: new Set() };
    if (reviewed.entries.has(entryId)) return false;
    reviewed.entries.add(entryId);
    return true;
  }

  /**
   * Keeps the Entry's next record, or deletes it for nothing, with the
   * Community Counters' changes when it counts, the confirmation the answer
   * adds or the undo removes and the XP of a Review answer, then follows it.
   * Any change of a mark ends the set that could be undone.
   */
  async function keep(
    entryId: string,
    record: KnowledgeRecord | undefined,
    counts: boolean,
    confirming: 'add' | 'remove' | 'none',
    reviewXp?: ReviewXpAward,
  ): Promise<void> {
    undoable = undefined;
    const counted = counts ? await countMark(entryId, record?.mark) : new Map();
    const confirmationChange =
      confirming === 'add'
        ? confirmation(entryId)
        : confirming === 'remove'
          ? confirmedRecords.record(entryId).change(undefined)
          : new Map();
    await userState.write(
      new Map([
        ...knowledge.record(entryId).change(record),
        ...counted,
        ...confirmationChange,
        ...(reviewXp?.changes ?? []),
      ]),
    );
    reviewXp?.commit();
    const changed = new Map(records);
    if (record === undefined) changed.delete(entryId);
    else changed.set(entryId, record);
    records = changed;
    if (confirming === 'add') confirmed = new Set([...confirmed, entryId]);
    if (confirming === 'remove') confirmed = new Set([...confirmed].filter((id) => id !== entryId));
    follow();
  }

  /**
   * Marks the Entry by the change the record and today give, unless the switch
   * is off. The record keeps the instant its mark was set: a change that
   * leaves the same mark, as a Review answer «Знаю» on a Known Entry, keeps
   * the time it had (or none, for a mark set before 0.8.13). A tap `counts`
   * for the Community Counters; a Game answer doesn't. Known on a Review of
   * 7 days or later confirms the Entry. `same` changes nothing; a set that
   * changes the record can be undone when `canUndo`.
   */
  const change = (
    entryId: string,
    next: (record: KnowledgeRecord | undefined) => KnowledgeRecord | undefined | 'same',
    { counts, canUndo }: { counts: boolean; canUndo: boolean },
  ) =>
    inTurn(async () => {
      if (!edition.isFeatureEnabled('knowledge')) return;
      await readRow(entryId);
      const previous = records.get(entryId);
      const record = next(previous);
      if (record === 'same' || (record === undefined && previous === undefined)) return;
      if (record === undefined) return keep(entryId, undefined, counts, 'none');
      const { mark, step, reviewDay, learned } = record;
      const markedAt = mark === previous?.mark ? previous.markedAt : clock.now().toISOString();
      // Only the reader's own mark answers a Review, and earns XP once per Entry on a local day; a Game answer earns the Game's XP.
      const review =
        counts &&
        previous !== undefined &&
        isDue(previous, todayDate(clock)) &&
        firstReviewToday(entryId);
      const confirms =
        mark === 'known' &&
        confirmsOnKnown(previous) &&
        edition.isFeatureEnabled('confirmedEntries') &&
        !confirmed.has(entryId);
      await keep(
        entryId,
        markedAt === undefined
          ? { mark, step, reviewDay, learned }
          : { mark, step, reviewDay, learned, markedAt },
        counts,
        confirms ? 'add' : 'none',
        review ? xp.award({ source: 'review-answer', entryId }) : undefined,
      );
      if (canUndo) undoable = { entryId, previous, confirmed: confirms };
      if (review) await reviewAnswered(entryId, mark);
    });

  /** Puts back the record before the last set, unless there is none to undo or the switch is off. */
  const undo = () =>
    inTurn(async () => {
      const last = undoable;
      if (last === undefined || !edition.isFeatureEnabled('knowledge')) return;
      await keep(last.entryId, last.previous, true, last.confirmed ? 'remove' : 'none');
    });

  /** Confirms the Entry, unless the `confirmedEntries` switch is off or it is confirmed already. */
  const confirm = (entryId: string) =>
    inTurn(async () => {
      if (!edition.isFeatureEnabled('confirmedEntries') || confirmed.has(entryId)) return;
      await readRow(entryId);
      await userState.write(confirmation(entryId));
      undoable = undefined;
      confirmed = new Set([...confirmed, entryId]);
      follow();
    });

  dayStarted.subscribe(follow);

  return {
    get state() {
      // The switch is read at each call, as the remote switches can turn it off while the app runs.
      if (!edition.isFeatureEnabled('knowledge')) return off;
      if (edition.isFeatureEnabled('confirmedEntries')) return state;
      // The same object until the state changes, as with the counts shown.
      if (hiding?.of !== state)
        hiding = { of: state, state: { ...state, confirmed: noneConfirmed } };
      return hiding.state;
    },
    weak() {
      if (!edition.isFeatureEnabled('knowledge')) return [];
      const unknown = [...records].flatMap(([entryId, record]) =>
        record.mark === 'unknown' && !hiddenEntries.has(entryId) ? [entryId] : [],
      );
      return [...new Set([...unknown, ...state.due])];
    },
    tap: (entryId, mark) =>
      change(
        entryId,
        (record) => {
          const today = todayDate(clock);
          return shownMark(record, today) === mark
            ? undefined
            : answerKnowledge(record, mark, today);
        },
        { counts: true, canUndo: false },
      ),
    set: (entryId, mark) =>
      change(
        entryId,
        (record) => {
          const today = todayDate(clock);
          return shownMark(record, today) === mark ? 'same' : answerKnowledge(record, mark, today);
        },
        { counts: true, canUndo: true },
      ),
    clear: (entryId) => change(entryId, () => undefined, { counts: true, canUndo: false }),
    undo,
    answer: (entryId, mark) =>
      change(entryId, (record) => answerKnowledge(record, mark, todayDate(clock)), {
        counts: false,
        canUndo: false,
      }),
    confirm,
    subscribe: subscribers.subscribe,
  };
}
