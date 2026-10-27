import type { Edition } from '../edition/edition';
import { dateKeyOf, type LocalDate } from '../local-date';
import type { UserStateChanges } from '../ports';
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
