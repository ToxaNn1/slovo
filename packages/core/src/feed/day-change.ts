import { createInTurn } from '../in-turn';
import { parseLocalDate, todayKey, type LocalDate } from '../local-date';
import type { Clock, UserStateChanges } from '../ports';
import type { ActiveDayChange } from '../progress/progress';
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
 * 2. the Knowledge Marks turn to the day, so the Entries due today are due
 *    and the «Вчу» list counts the days from it;
 * 3. today becomes an Active Day, in the write of the Entry a notification
 *    or the widget opened, if one did;
 * 4. the notification plan is made again, with the permission read again;
 * 5. the Feed opens the day with its Word of the Day.
 *
 * A step that fails leaves the day to turn again on the next report. A later
 * report the same day records the Active Day again, which writes nothing once
 * it is kept, and only the app's return makes the plan again, since the
 * reader may have changed the permission in the device's settings meanwhile.
 */
export interface DayChange {
  /** The app is in the foreground: it opened, came back or stayed open into the next local day. */
  resume(): Promise<void>;
  /**
   * A notification or the widget opened an Entry: `open` keeps it with
   * `activeDay`, the changes that make today an Active Day, in one write,
   * after the morning Word is taken. Resolves with what `open` gives once it is kept: the rest
   * of the turn goes on in turn without holding the Word back, and a step of
   * it that fails is left to the next report.
   */
  opened<T>(open: (activeDay: UserStateChanges) => Promise<T>): Promise<T>;
  /**
   * Takes the morning Word of a local day the composition hasn't turned to
   * yet, for a plan made before the day's first report, such as across a
   * time-zone change with the app open, so the plan never drops a passed
   * morning record before its Word is taken. Nothing on a day turned to.
   */
  takeMorningWord(): Promise<void>;
}

export function createDayChange({
  clock,
  wordOfTheDay,
  followKnowledgeDay,
  recordToday,
  todayChange,
  replan,
  openFeedDay,
}: {
  clock: Clock;
  wordOfTheDay: Pick<WordOfTheDay, 'takeMorningWord'>;
  /** Makes the Knowledge Marks follow today. */
  followKnowledgeDay: () => void;
  /** Writes today as an Active Day. */
  recordToday: () => Promise<void>;
  /** The change that makes today an Active Day, for another write. */
  todayChange: () => ActiveDayChange;
  /** Reads the permission and makes the notification plan again. */
  replan: () => Promise<void>;
  /** Tells the Feed the local day it is. */
  openFeedDay: (day: LocalDate) => Promise<void>;
}): DayChange {
  /** The local day `YYYY-MM-DD` the composition turned to last. */
  let turnedTo: string | undefined;
  const inTurn = createInTurn();

  /**
   * Turns to today when it is a new local day, with `recordActiveDay` as its
   * second step, which runs on every report; `planAnyway` makes the plan again
   * on a report of the same day too.
   */
  async function follow(recordActiveDay: () => Promise<void>, planAnyway: boolean): Promise<void> {
    const today = todayKey(clock);
    const newDay = today !== turnedTo;
    if (newDay) {
      await wordOfTheDay.takeMorningWord();
      followKnowledgeDay();
    }
    await recordActiveDay();
    if (newDay || planAnyway) await replan();
    if (newDay) {
      await openFeedDay(parseLocalDate(today));
      turnedTo = today;
    }
  }

  return {
    resume: () => inTurn(() => follow(recordToday, true)),
    opened: (open) =>
      new Promise((resolve, reject) => {
        // Once the Word is kept, a later step that fails rejects nothing: it waits for the next report.
        inTurn(() =>
          follow(async () => {
            const activeDay = todayChange();
            const opened = await open(activeDay.changes);
            activeDay.commit();
            resolve(opened);
          }, false),
        ).catch(reject);
      }),
    async takeMorningWord() {
      if (todayKey(clock) !== turnedTo) await wordOfTheDay.takeMorningWord();
    },
  };
}
