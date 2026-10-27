import type { Edition } from '../edition/edition';
import { createEntries } from '../entries/entries';
import { createEntryRows, type EntryRowModel } from '../entries/entry-row';
import { dateKeyOf, parseLocalDate, type LocalDate } from '../local-date';
import type { ContentReadPort, UserStateChanges } from '../ports';
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
  /** The date in the Edition's locale, the day and the month: «26 жовтня». */
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

/** The Word of the Day archive over the Language Pack and the user state. */
export function createWordOfTheDayArchive({
  content,
  edition,
  userState,
}: {
  content: ContentReadPort;
  edition: Pick<Edition, 'locale' | 'isFeatureEnabled'>;
  userState: Pick<UserState, 'list'>;
}): WordOfTheDayArchive {
  const rows = createEntryRows(createEntries({ content, edition }));
  // The date as a calendar day, the same in every time zone.
  const dateFormat = new Intl.DateTimeFormat(edition.locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return {
    async list() {
      const kept = [...(await userState.list(archiveRecords))].sort(([one], [other]) =>
        other.localeCompare(one),
      );
      const rowOf = await rows.rows(kept.map(([, wordId]) => wordId));
      return kept.flatMap(([dateKey, wordId]) => {
        const row = rowOf.get(wordId);
        if (row?.kind !== 'word') return [];
        const date = parseLocalDate(dateKey);
        const dateLabel = dateFormat.format(Date.UTC(date.year, date.month - 1, date.day));
        return [{ date, dateLabel, row }];
      });
    },
  };
}
