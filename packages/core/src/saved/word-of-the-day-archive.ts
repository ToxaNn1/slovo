import { LocalDateKeySchema } from '../user-state/user-state-record';
import type { Edition } from '../edition/edition';
import { createEntries, EVERYTHING_IN } from '../entries/entries';
import { createEntryRows, type EntryRowModel } from '../entries/entry-row';
import { createInTurn, createSubscribers } from '../in-turn';
import { dateKeyOf, parseLocalDate, todayDate, type LocalDate } from '../local-date';
import type { Clock, ContentReadPort } from '../ports';
import { type StagedPiece } from '../user-state/staged-write';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const { wordOfTheDayArchive: archiveRecords } = userStateRecords;

/**
 * How the Feed records the Word of the Day archive («Слова дня»)
 * in its Seen write: one synced record per local date, holding the id of the
 * Word whose card the reader Seen on it. The shell never gets it.
 */
export interface WordOfTheDayArchiveRecorder {
  /**
   * The day to keep in the write that marks its Word of the Day card Seen;
   * nothing while the Feature Switch `wordOfTheDayArchive` is off, so an
   * absent feature keeps its records and writes none.
   */
  record(date: LocalDate, wordId: string): StagedPiece<Promise<void>> | undefined;
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

/**
 * The Word of the Day archive as «Слова дня» in «Збережене» lists it. It is read from the user state once, when it opens, like Favorites,
 * and again only when it changes: once the Feed keeps a day, and on the first
 * day of a year, which gives the dates of the year before their year.
 */
export interface WordOfTheDayArchive {
  /**
   * Every kept day, newest first; its length is the count. A Retired Word
   * stays; a Word the Language Pack no longer has is left out. A change never
   * edits this array: it makes a new one and tells the subscribers, so the
   * array stays the same until something changes.
   */
  readonly list: readonly WordOfTheDayArchiveDay[];
  /** The day kept under the local date `YYYY-MM-DD`, the same object as in the list; nothing for a date not kept. */
  day(dateKey: string): WordOfTheDayArchiveDay | undefined;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
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

/**
 * Opens the Word of the Day archive over the Language Pack and the user
 * state, for the Core composition, with the recorder the Feed keeps a day
 * through.
 */
export async function openWordOfTheDayArchive({
  content,
  edition,
  userState,
  clock,
  dayTurned,
}: {
  content: ContentReadPort;
  /** Its `locale` writes the dates. */
  edition: Pick<Edition, 'isFeatureEnabled' | 'locale'>;
  userState: Pick<UserState, 'list'>;
  /** Tells the current year, whose dates go without it. */
  clock: Clock;
  /** Each new day, the first of a year among them. */
  dayTurned: { subscribe(listener: (day: LocalDate) => unknown): unknown };
}): Promise<{ archive: WordOfTheDayArchive; recorder: WordOfTheDayArchiveRecorder }> {
  const rows = createEntryRows(createEntries({ content, edition, choices: EVERYTHING_IN }));
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
  const subscribers = createSubscribers();
  const inTurn = createInTurn();
  let list: readonly WordOfTheDayArchiveDay[] = [];
  let byDate: ReadonlyMap<string, WordOfTheDayArchiveDay> = new Map();
  /** The year the list's dates are written in: its own dates go without it. */
  let writtenIn = todayDate(clock).year;

  /** Reads the kept days from the user state and writes their dates as of this year. */
  async function read(): Promise<void> {
    const kept = [...(await userState.list(archiveRecords))].sort(([one], [other]) =>
      other.localeCompare(one),
    );
    const rowOf = await rows.rows(kept.map(([, wordId]) => wordId));
    const thisYear = todayDate(clock).year;
    const days = new Map(
      kept.flatMap(([dateKey, wordId]): [string, WordOfTheDayArchiveDay][] => {
        const row = rowOf.get(wordId);
        // A record's id comes from outside too (a Sync pull): one that is no date is left out.
        if (row?.kind !== 'word' || !LocalDateKeySchema.safeParse(dateKey).success) return [];
        const date = parseLocalDate(dateKey);
        const instant = Date.UTC(date.year, date.month - 1, date.day);
        const dateLabel =
          date.year < thisYear
            ? withoutYearSuffix(pastYearFormat, instant)
            : thisYearFormat.format(instant);
        return [[dateKey, { date, dateLabel, row }]];
      }),
    );
    byDate = days;
    list = [...days.values()];
    writtenIn = thisYear;
  }

  /** Reads the list again, in turn with the other reads, and tells the subscribers. */
  const readAgain = () =>
    inTurn(async () => {
      await read();
      subscribers.tell();
    });

  await read();
  dayTurned.subscribe(({ year }) => (year === writtenIn ? undefined : readAgain()));

  return {
    archive: {
      get list() {
        return list;
      },
      day: (dateKey) => byDate.get(dateKey),
      subscribe: subscribers.subscribe,
    },
    recorder: {
      record: (date, wordId) =>
        edition.isFeatureEnabled('wordOfTheDayArchive')
          ? { changes: archiveRecords.record(dateKeyOf(date)).change(wordId), commit: readAgain }
          : undefined,
    },
  };
}
