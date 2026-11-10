import { dateKeyOf, localDateAfter, type LocalDate } from '../local-date';

/** What the reader says about an Entry: Known («Знаю») or Unknown («Не знаю»). */
export type KnowledgeMark = 'known' | 'unknown';

/** The days a Review waits, one step after the other. */
export type ReviewStep = 1 | 3 | 7 | 30 | 90;

/** What every Knowledge record keeps, whichever form it has. */
interface Marked {
  /**
   * The instant the mark was set or changed, ISO 8601 in UTC, which the
   * Weekly Recap counts (ADR 0054); none on a mark kept before 0.8.13.
   */
  readonly markedAt?: string;
}

/** A Learned Entry: Known, and it no longer comes back for Review. */
export interface LearnedRecord extends Marked {
  readonly learned: true;
  readonly mark: 'known';
  readonly step: null;
  readonly reviewDay: null;
}

/** An Entry in Review: its mark, the step it is on and the day it is due. */
export interface ReviewRecord extends Marked {
  readonly learned: false;
  readonly mark: KnowledgeMark;
  /** The days the current Review waited. */
  readonly step: ReviewStep;
  /** The local day the Entry is due for Review, `YYYY-MM-DD`. */
  readonly reviewDay: string;
}

/**
 * The Knowledge Mark of one Entry and where its Review stands (ADR 0043):
 * Learned, or in Review. An Entry without a record has no mark. Both forms
 * hold the fields of the stored record, in its order, so a record is kept as
 * it is.
 */
export type KnowledgeRecord = LearnedRecord | ReviewRecord;

/** A Knowledge record as the user state may hold it: any mix of the fields. */
interface StoredKnowledgeRecord extends Marked {
  readonly mark: KnowledgeMark;
  readonly step: ReviewStep | null;
  readonly reviewDay: string | null;
  readonly learned: boolean;
}

const learned: LearnedRecord = { mark: 'known', step: null, reviewDay: null, learned: true };

/** A Review day that is due on any day: before every day a reader marks on. */
const dueAtOnce = '1970-01-01';

/**
 * The record a stored one reads as. A Learned record and a record in Review
 * read as they are. One that is neither is reduced by a fixed rule, in this
 * order:
 * 1. with a step and a Review day it is in Review with them, whatever it
 *    says of Learned;
 * 2. Known otherwise, it is Learned;
 * 3. Unknown otherwise, it is in Review at 1 day, on the Review day it keeps
 *    or, without one, due at once.
 */
export function knowledgeRecordOf({
  mark,
  step,
  reviewDay,
  markedAt,
}: StoredKnowledgeRecord): KnowledgeRecord {
  const time = markedAt === undefined ? {} : { markedAt };
  if (step !== null && reviewDay !== null) {
    return { mark, step, reviewDay, learned: false, ...time };
  }
  if (mark === 'known') return { ...learned, ...time };
  return { mark, step: 1, reviewDay: reviewDay ?? dueAtOnce, learned: false, ...time };
}

/** The step after a Review answered Known, or nothing when the Entry becomes Learned. */
const nextStep: Record<ReviewStep, ReviewStep | undefined> = {
  1: 3,
  3: 7,
  7: 30,
  30: 90,
  90: undefined,
};

/**
 * The record after the reader answers the Entry on the local day `today`, by
 * the interval rule: Unknown starts a Review at 1 day, from any step and a
 * Learned Entry too; Known moves a Review from 1 to 3 days, then to 7, 30
 * and 90, and makes the Entry Learned after 90; Known with no earlier mark
 * makes it Learned at once. An Entry kept on the 7-day step before 1.0 moves
 * on to 30 days like any other. The next Review day is `today` plus the
 * step, so an Entry marked late at night is due the morning after.
 */
export function answerKnowledge(
  record: KnowledgeRecord | undefined,
  mark: KnowledgeMark,
  today: LocalDate,
): KnowledgeRecord {
  const current = record?.step ?? undefined;
  const step = mark === 'unknown' ? 1 : current === undefined ? undefined : nextStep[current];
  if (step === undefined) return learned;
  return { mark, step, reviewDay: dateKeyOf(localDateAfter(today, step)), learned: false };
}

/**
 * Whether the Entry is due for Review on the local day: on or after its
 * Review day, until the reader answers it.
 */
export function isDue(record: KnowledgeRecord | undefined, day: LocalDate): boolean {
  return record?.learned === false && record.reviewDay <= dateKeyOf(day);
}

/**
 * Whether answering the record Known confirms the Entry: it is on a Review of
 * 7 days or later (ADR 0043).
 */
export const confirmsOnKnown = (record: KnowledgeRecord | undefined): boolean =>
  record?.learned === false && record.step >= 7;

/** Whether the Entry is Learned. */
export const isLearned = (record: KnowledgeRecord | undefined): boolean => record?.learned === true;

/**
 * The mark the Entry's card shows on the local day: its mark, but none while
 * it is due, since a Review asks for a new answer.
 */
export const shownMark = (
  record: KnowledgeRecord | undefined,
  day: LocalDate,
): KnowledgeMark | undefined => (isDue(record, day) ? undefined : record?.mark);
