import type { Edition } from '../edition/edition';
import { createEntries } from '../entries/entries';
import { createEntryRows, type EntryRowModel } from '../entries/entry-row';
import { dateKeyOf, parseLocalDate, todayDate, type LocalDate } from '../local-date';
import type { Clock, ContentReadPort, UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

const { wordOfTheDayArchive: archiveRecords } = userStateRecords;

/**
 * How the Feed records the Word of the Day archive («Слова дня», ADR 0054)
 * in its Seen write: one synced record per local date, holding the id of the
 * Word whose card the reader Seen on it. The shell never gets it.
 */
export interface WordOfTheDayArchiveRecorder {
  /**
   * The change that keeps the Word under the date, to go in the write that
   * marks its Word of the Day card Seen; no change while the Feature Switch
   * `wordOfTheDayArchive` is off, so an absent feature keeps its records and
   * writes none.
   */
  record(date: LocalDate, wordId: string): UserStateChanges;
}

/** The archive recorder over the Edition, for the Core composition. */
export function createWordOfTheDayArchiveRecorder({
  edition,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
}): WordOfTheDayArchiveRecorder {
  return {
    record: (date, wordId) =>
      edition.isFeatureEnabled('wordOfTheDayArchive')
        ? archiveRecords.record(dateKeyOf(date)).change(wordId)
        : new Map(),
  };
}

/** A Word's row in a list. */
type WordRowModel = Extract<EntryRowModel, { kind: 'word' }>;

/** One day of the Word of the Day archive, as its row shows it («26 жовтня · сумирний»). */
export interface WordOfTheDayArchiveDay {
  readonly date: LocalDate;
  /**
   * The date in the Edition's locale: the day and the month («26 жовтня»),
   * and the year too for a date of a past year («26 жовтня 2025»).
   */
  readonly dateLabel: string;
  /** The Word's row, whose title is its Lemma and whose id a tap opens. */
  readonly row: WordRowModel;
}

/** The Word of the Day archive as «Слова дня» in «Збережене» lists it (ADR 0054). */
export interface WordOfTheDayArchive {
  /**
   * Every kept day, newest first, read from the user state on each call, so
   * it holds the days the Feed and the Sync kept since. A Retired Word stays;
   * a Word the Language Pack no longer has is left out.
   */
  list(): Promise<readonly WordOfTheDayArchiveDay[]>;
}

/**
 * The date with its year, without what a locale puts after the last part of
 * the date: «26 жовтня 2025», not «26 жовтня 2025 р.».
 */
function withoutYearSuffix(format: Intl.DateTimeFormat, instant: number): string {
  const parts = format.formatToParts(instant);
  const last = parts.findLastIndex(({ type }) => type !== 'literal');
  return parts
    .slice(0, last + 1)
    .map(({ value }) => value)
    .join('');
}

/** The Word of the Day archive over the Language Pack and the user state. */
export function createWordOfTheDayArchive({
  content,
  edition,
  userState,
  clock,
}: {
  content: ContentReadPort;
  edition: Pick<Edition, 'locale' | 'isFeatureEnabled'>;
  userState: Pick<UserState, 'list'>;
  /** Tells the current year, whose dates go without it. */
  clock: Clock;
}): WordOfTheDayArchive {
  const rows = createEntryRows(createEntries({ content, edition }));
  // The date as a calendar day, the same in every time zone.
  const thisYearFormat = new Intl.DateTimeFormat(edition.locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const pastYearFormat = new Intl.DateTimeFormat(edition.locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return {
    async list() {
      const kept = [...(await userState.list(archiveRecords))].sort(([one], [other]) =>
        other.localeCompare(one),
      );
      const rowOf = await rows.rows(kept.map(([, wordId]) => wordId));
      const thisYear = todayDate(clock).year;
      return kept.flatMap(([dateKey, wordId]) => {
        const row = rowOf.get(wordId);
        if (row?.kind !== 'word') return [];
        const date = parseLocalDate(dateKey);
        const instant = Date.UTC(date.year, date.month - 1, date.day);
        const dateLabel =
          date.year < thisYear
            ? withoutYearSuffix(pastYearFormat, instant)
            : thisYearFormat.format(instant);
        return [{ date, dateLabel, row }];
      });
    },
  };
}
