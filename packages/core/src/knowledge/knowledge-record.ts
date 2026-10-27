import { dateKeyOf, localDateAfter, type LocalDate } from '../local-date';

/** What the reader says about an Entry: Known («Знаю») or Unknown («Не знаю»). */
export type KnowledgeMark = 'known' | 'unknown';

/** The days a Review waits, one step after the other. */
export type ReviewStep = 1 | 3 | 7;

/**
 * The Knowledge Mark of one Entry and where its Review stands (ADR 0043). An
 * Entry without a record has no mark.
 */
export interface KnowledgeRecord {
  readonly mark: KnowledgeMark;
  /** The days the current Review waited; none once the Entry is Learned. */
  readonly step: ReviewStep | null;
  /** The local day the Entry is due for Review, `YYYY-MM-DD`; none once it is Learned. */
  readonly reviewDay: string | null;
  /** Whether the Entry is Learned: it no longer comes back for Review. */
  readonly learned: boolean;
  /**
   * The instant the mark was set or changed, ISO 8601 in UTC, which the
   * Weekly Recap counts (ADR 0054); none on a mark kept before 0.8.13.
   */
  readonly markedAt?: string;
}

const learned: KnowledgeRecord = { mark: 'known', step: null, reviewDay: null, learned: true };

/** The step after a Review answered Known, or nothing when the Entry becomes Learned. */
const nextStep: Record<ReviewStep, ReviewStep | undefined> = { 1: 3, 3: 7, 7: undefined };

/**
 * The record after the reader answers the Entry on the local day `today`, by
 * the interval rule: Unknown starts a Review at 1 day, from any step and a
 * Learned Entry too; Known moves a Review from 1 to 3 days, then to 7, and
 * makes the Entry Learned after 7; Known with no earlier mark makes it
 * Learned at once. The next Review day is `today` plus the step, so an Entry
 * marked late at night is due the morning after.
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
  const reviewDay = record?.reviewDay ?? undefined;
  return reviewDay !== undefined && reviewDay <= dateKeyOf(day);
}

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
