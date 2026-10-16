import type { Cycle } from '../feed/cycle';
import type { Entries } from '../entries/entries';
import {
  dateKeyOf,
  dayNumber,
  compareTimesOfDay,
  formatTimeOfDay,
  localDateAfter,
  localTimeOf,
  todayDate,
  type TimeOfDay,
} from '../local-date';
import type {
  Clock,
  NotificationPermission,
  NotificationSchedulerPort,
  PlannedNotification,
  PlannedSound,
} from '../ports';
import {
  createReservedWords,
  type PlannedWord,
  type Slot,
  type StoredPlan,
} from '../feed/reserved-words';
import { renderStress } from '../entries/stress';
import type { UserState } from '../user-state/user-state';
import type { WordOfTheDay } from '../feed/word-of-the-day';

/** The most notifications the plan holds: the most iOS keeps pending for one app. */
const MAX_PLANNED_NOTIFICATIONS = 64;

/** How many local days of Notification times the plan reaches, from the next time ahead. */
const PLAN_DAYS = 14;

/** The most characters a notification body holds, its ellipsis included. */
export const NOTIFICATION_BODY_LENGTH = 80;

/**
 * What the plan needs from the shell: the device's notification scheduler,
 * and the mark that ends a cut body, from the Edition's UI strings.
 */
export interface NotificationScheduling {
  readonly scheduler: NotificationSchedulerPort;
  readonly ellipsis: string;
}

/** What the plan needs to know of the Edition: its notification sound, if it has one. */
export interface PlanEdition {
  /** The file name of the Edition's own sound; without one, notifications play the system sound. */
  readonly notificationSound?: string | undefined;
}

/**
 * The notification the plan holds for the next morning: its Word, the body
 * of the Word's notification, and its time.
 */
export interface MorningNotification {
  readonly wordId: string;
  /** The primary Definition, cut as the notification cuts it. */
  readonly body: string;
  /** The earliest Notification time; nothing when no time is left. */
  readonly time: TimeOfDay | undefined;
}

/** The Notification times, the sound and the permission the plan follows. */
interface PlanSettings {
  /** In time order. */
  readonly times: readonly TimeOfDay[];
  readonly sound: boolean;
  /** Whether the device lets the app notify, as the scheduler reported it. */
  readonly permission: NotificationPermission;
}

/**
 * When each notification the plan covers comes, in time order: every time
 * from the next one still ahead today (a time due this minute has passed),
 * for `PLAN_DAYS` days' worth of times, and never more than
 * `MAX_PLANNED_NOTIFICATIONS`.
 */
function slotsAhead(times: readonly TimeOfDay[], clock: Clock): Slot[] {
  const today = todayDate(clock);
  const now = localTimeOf(clock.now(), clock);
  const count = Math.min(times.length * PLAN_DAYS, MAX_PLANNED_NOTIFICATIONS);
  const slots: Slot[] = [];
  for (let day = 0; slots.length < count; day += 1) {
    const date = localDateAfter(today, day);
    for (const time of times) {
      if (slots.length < count && (day > 0 || compareTimesOfDay(time, now) > 0)) {
        slots.push({ date, time });
      }
    }
  }
  return slots;
}

/** Whether a slot is this morning's: today at the earliest Notification time. */
function isMorningOf(earliest: TimeOfDay, clock: Clock): (slot: Slot) => boolean {
  const today = dayNumber(todayDate(clock));
  return ({ date, time }) => dayNumber(date) === today && compareTimesOfDay(time, earliest) === 0;
}

/**
 * The spaces, dashes and punctuation at the end of a text that only end a
 * clause, by Unicode class so they count in every script: a comma, a full
 * stop, a colon, an Arabic comma, a danda. Marks that say something stay:
 * question and exclamation marks, quotation marks, brackets, apostrophes and
 * signs such as `%`.
 */
const CLAUSE_END = /(?:\s|\p{Pd}|(?![!?¡¿؟‽%'"*/\\&#@])\p{Po})+$/u;

/**
 * The body of a notification: the text, or when it is longer than
 * `NOTIFICATION_BODY_LENGTH`, its start cut at a word boundary, without the
 * punctuation that ends a clause before the cut, and the ellipsis.
 */
function notificationBody(text: string, ellipsis: string): string {
  const characters = Array.from(text);
  if (characters.length <= NOTIFICATION_BODY_LENGTH) return text;
  const room = NOTIFICATION_BODY_LENGTH - Array.from(ellipsis).length;
  // One character more than fits, so a space right after the cut counts as a boundary.
  const head = characters.slice(0, room + 1).join('');
  const boundary = head.search(/\s\S*$/u);
  const cut = boundary > 0 ? head.slice(0, boundary) : characters.slice(0, room).join('');
  return `${cut.replace(CLAUSE_END, '')}${ellipsis}`;
}

/** The plan of the Notification times on the device's scheduler, for the Notifications module. */
export interface NotificationPlanner {
  /** Whether the device lets the app notify. */
  permission(): Promise<NotificationPermission>;
  /** Asks the reader for permission to notify when they haven't been asked yet, and reports it. */
  askPermission(): Promise<NotificationPermission>;
  plan(settings: PlanSettings): Promise<void>;
  /** Whether a notification is planned with the Word. */
  isReserved(wordId: string): Promise<boolean>;
  /**
   * The next morning notification of a plan made now as if the device let
   * the app notify: the first at the earliest of `times`, this morning's
   * while its time is ahead, else the next day's. With no time left, today's
   * Word of the Day while it is unseen, with no time: the morning a time
   * added ahead today would bring. Nothing when the Cycle has no Word for it.
   */
  nextMorning(times: readonly TimeOfDay[]): Promise<MorningNotification | undefined>;
}

/**
 * The planner without a scheduler, as in tools and in tests of other
 * features: there is nobody to ask, so the permission stays not asked,
 * nothing is planned or Reserved, and there is no next morning.
 */
export const noNotificationPlanner: NotificationPlanner = {
  permission: () => Promise.resolve('not-asked'),
  askPermission: () => Promise.resolve('not-asked'),
  plan: () => Promise.resolve(),
  isReserved: () => Promise.resolve(false),
  nextMorning: () => Promise.resolve(undefined),
};

/**
 * Makes the plan of the Notification times, for the Notifications module,
 * and hands it to the device's scheduler (ADR 0021). The plan is a list of
 * floating local dates and times, each with one Word, and the user state
 * keeps it as the Reserved Words, one Word per notification.
 *
 * While the device doesn't let the app notify, the plan is empty and nothing
 * is Reserved. Otherwise each notification gets an eligible Word unseen in
 * the Cycle, never a Correction, and no Word twice. The earliest time of each
 * local day carries that day's Word of the Day: today's is the Word of the
 * Day module's while it is unseen, and no other notification carries it; a
 * later day's is the Word the plan Reserves for that morning, which the Word
 * of the Day module takes when the day comes, before a plan is made on it
 * (ADR 0022), so a new day keeps its morning Word even once its notification
 * has passed. Planning again keeps every
 * notification still ahead whose Word is still eligible, unseen and not
 * needed elsewhere, so the plan doesn't churn, and gives the others the next
 * unseen Words in the Cycle order after the furthest Word planned before, so
 * a notification that has passed unopened doesn't bring its Word straight
 * back. When the Cycle runs out of unseen Words, the latest notifications
 * stay empty; the plan never starts a new Cycle. Every plan replaces what
 * the device held before.
 *
 * `nextMorning` answers which morning notification a plan made now would
 * hold, also while the device doesn't let the app notify, and writes nothing.
 */
export function createNotificationPlanner({
  cycle,
  entries,
  userState,
  clock,
  edition,
  wordOfTheDay,
  scheduling: { scheduler, ellipsis },
}: {
  cycle: Pick<Cycle, 'order' | 'unseen'>;
  entries: Pick<Entries, 'get'>;
  userState: UserState;
  clock: Clock;
  edition: PlanEdition;
  wordOfTheDay: Pick<WordOfTheDay, 'chosen'>;
  scheduling: NotificationScheduling;
}): NotificationPlanner {
  const reservedWords = createReservedWords({ userState });

  /** The Words the notifications without one take, in the order they take them. */
  function freshWords(planned: Iterable<string>, taken: ReadonlySet<string>): string[] {
    const place = new Map(cycle.order().words.map((id, index) => [id, index]));
    const furthest = Math.max(-1, ...Array.from(planned, (id) => place.get(id) ?? -1));
    const unseen = cycle.unseen().words.filter((id) => !taken.has(id));
    const after = (id: string) => (place.get(id) ?? -1) > furthest;
    return [...unseen.filter(after), ...unseen.filter((id) => !after(id))];
  }

  /**
   * The Word of each notification that gets one, given the stored plan and
   * the earliest Notification time.
   */
  function chooseWords(
    slots: readonly Slot[],
    stored: StoredPlan,
    earliest: TimeOfDay | undefined,
  ): PlannedWord[] {
    const unseen = new Set(cycle.unseen().words);
    const kept = new Map<Slot, string>();
    // Today's Word of the Day goes to this morning's notification or to none.
    const today = wordOfTheDay.chosen()?.wordId;
    const keptWords = new Set<string>(today === undefined ? [] : [today]);
    const morning = earliest === undefined ? undefined : slots.find(isMorningOf(earliest, clock));
    if (morning !== undefined && today !== undefined && unseen.has(today)) kept.set(morning, today);
    for (const slot of slots) {
      if (kept.has(slot)) continue;
      const wordId = stored.wordAt(slot);
      if (wordId !== undefined && unseen.has(wordId) && !keptWords.has(wordId)) {
        kept.set(slot, wordId);
        keptWords.add(wordId);
      }
    }
    const fresh = freshWords(stored.words, keptWords);
    return slots.flatMap((slot) => {
      const wordId = kept.get(slot) ?? fresh.shift();
      return wordId === undefined ? [] : [{ slot, wordId }];
    });
  }

  function soundOf(on: boolean): PlannedSound {
    if (!on) return 'silent';
    return edition.notificationSound === undefined ? 'system' : { file: edition.notificationSound };
  }

  async function nextMorning(
    times: readonly TimeOfDay[],
  ): Promise<MorningNotification | undefined> {
    const [earliest] = times;
    const today = wordOfTheDay.chosen()?.wordId;
    const wordId =
      earliest === undefined
        ? today !== undefined && cycle.unseen().words.includes(today)
          ? today
          : undefined
        : chooseWords(slotsAhead(times, clock), await reservedWords.stored(), earliest).find(
            ({ slot }) => compareTimesOfDay(slot.time, earliest) === 0,
          )?.wordId;
    const word = wordId === undefined ? undefined : await entries.get(wordId);
    if (word?.kind !== 'word') return undefined;
    return {
      wordId: word.id,
      body: notificationBody(word.primaryDefinition, ellipsis),
      time: earliest,
    };
  }

  async function plan({ times, sound, permission }: PlanSettings): Promise<void> {
    const slots = permission === 'allowed' ? slotsAhead(times, clock) : [];
    const stored = await reservedWords.stored();
    const planned: PlannedWord[] = [];
    const notifications: PlannedNotification[] = [];
    for (const reserved of chooseWords(slots, stored, times[0])) {
      const word = await entries.get(reserved.wordId);
      if (word?.kind !== 'word') continue;
      planned.push(reserved);
      notifications.push({
        date: dateKeyOf(reserved.slot.date),
        time: formatTimeOfDay(reserved.slot.time),
        title: renderStress(word),
        body: notificationBody(word.primaryDefinition, ellipsis),
        wordId: word.id,
        sound: soundOf(sound),
      });
    }
    await stored.replace(planned);
    await scheduler.replacePlan(notifications);
  }

  return {
    permission: () => scheduler.permission(),
    askPermission: () => scheduler.askPermission(),
    plan,
    isReserved: (wordId) => reservedWords.isReserved(wordId),
    nextMorning,
  };
}
