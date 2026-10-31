import { createInTurn } from '../in-turn';
import { parseLocalDate, todayKey, type LocalDate } from '../local-date';
import type { Clock, UserStateChanges } from '../ports';
import type { ActiveDays } from '../progress/active-days';
import type { Subject } from '../subject';
import type { WordOfTheDay } from './word-of-the-day';

/**
 * The day change of the composition: the one module that decides a new
 * local day started, in the clock's time zone, and turns the composition to
 * it (ADR 0022). The shell only reports that the app is in the foreground, on
 * its return and on a timer set to the next local day; a notification or the
 * widget that opens an Entry reports it too. Internal: `index.ts` does not
 * export it.
 *
 * Each report runs in turn with the others, so a notification tapped from the
 * background and the app's return, which come at once, never run side by
 * side, and either order ends the same. The first report of a local day
 * turns to it, in this order:
 *
 * 1. the Word of the Day module takes the Word of the day's morning
 *    notification (ADR 0016), before anything else can
 *    read the day or drop a passed morning record;
 * 2. `dayStarted`: the Knowledge Marks turn to the day, so the Entries due
 *    today are due and the «Вчу» list counts the days from it;
 * 3. today becomes an Active Day, in the write of the Entry a notification
 *    or the widget opened (`opened`), if one did;
 * 4. `dayTurned`: the notification plan is made again, with the permission
 *    read again, then the Feed opens the day with its Word of the Day, then
 *    the Game plans its offers again if every try had failed.
 *
 * A step that fails leaves the day to turn again on the next report. A later
 * report the same day records the Active Day again, which writes nothing once
 * it is kept, and only the app's return publishes `returned`, so the plan is
 * made again, since the reader may have changed the permission in the
 * device's settings meanwhile.
 */
export interface DayChange {
  /** The app is in the foreground: it opened, came back or stayed open into the next local day. */
  resume(): Promise<void>;
  /**
   * A notification or the widget opened the Entry: `opened` is published with
   * it and `activeDay`, the changes that make today an Active Day, for the
   * Feed to keep in one write, after the morning Word is taken. Resolves once
   * it is kept: the rest of the turn goes on in turn without holding the Word
   * back, and a step of it that fails is left to the next report.
   */
  opened(entryId: string): Promise<void>;
  /**
   * Takes the morning Word of a local day the composition hasn't turned to
   * yet, for a plan made before the day's first report, such as across a
   * time-zone change with the app open, so the plan never drops a passed
   * morning record before its Word is taken. Nothing on a day turned to.
   */
  takeMorningWord(): Promise<void>;
}

/** An Entry opened from outside the app, with the changes that make today an Active Day, to keep in one write with it. */
export interface OpenedEntry {
  readonly entryId: string;
  readonly activeDay: UserStateChanges;
}

/** The subjects the day change publishes; it is their only publisher. */
export interface DaySubjects {
  /** A new local day started and its morning Word is taken; nothing of the day is written yet. */
  dayStarted: Pick<Subject<LocalDate>, 'publish'>;
  /** A notification or the widget opened an Entry; the write that keeps it is awaited. */
  opened: Pick<Subject<OpenedEntry>, 'publish'>;
  /** The composition turned to the new local day: today is an Active Day. */
  dayTurned: Pick<Subject<LocalDate>, 'publish'>;
  /** The app came back on a day the composition had turned to. */
  returned: Pick<Subject<void>, 'publish'>;
}

export function createDayChange({
  clock,
  wordOfTheDay,
  activeDays,
  dayStarted,
  opened,
  dayTurned,
  returned,
}: {
  clock: Clock;
  wordOfTheDay: Pick<WordOfTheDay, 'takeMorningWord'>;
  activeDays: Pick<ActiveDays, 'recordToday' | 'todayChange'>;
} & DaySubjects): DayChange {
  /** The local day `YYYY-MM-DD` the composition turned to last. */
  let turnedTo: string | undefined;
  const inTurn = createInTurn();

  /**
   * Turns to today when it is a new local day, with `recordActiveDay` as its
   * third step, which runs on every report; `isReturn` says the app came back,
   * which makes the plan again on a report of the same day too.
   */
  async function follow(recordActiveDay: () => Promise<void>, isReturn: boolean): Promise<void> {
    const today = todayKey(clock);
    const day = parseLocalDate(today);
    const newDay = today !== turnedTo;
    if (newDay) {
      await wordOfTheDay.takeMorningWord();
      await dayStarted.publish(day);
    }
    await recordActiveDay();
    if (newDay) {
      await dayTurned.publish(day);
      turnedTo = today;
    } else if (isReturn) await returned.publish();
  }

  return {
    resume: () => inTurn(() => follow(() => activeDays.recordToday(), true)),
    opened: (entryId) =>
      new Promise((resolve, reject) => {
        // Once the Word is kept, a later step that fails rejects nothing: it waits for the next report.
        inTurn(() =>
          follow(async () => {
            const activeDay = activeDays.todayChange();
            await opened.publish({ entryId, activeDay: activeDay.changes });
            activeDay.commit();
            resolve();
          }, false),
        ).catch(reject);
      }),
    async takeMorningWord() {
      if (todayKey(clock) !== turnedTo) await wordOfTheDay.takeMorningWord();
    },
  };
}
