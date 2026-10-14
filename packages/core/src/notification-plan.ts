import type { Cycle } from './cycle';
import type { Entries } from './entries';
import { dateKeyAfter, localTimeOf, todayKey } from './local-date';
import type {
  Clock,
  NotificationPermission,
  NotificationSchedulerPort,
  PlannedNotification,
  PlannedSound,
  UserStateChanges,
} from './ports';
import { renderStress } from './stress';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';
import type { WordOfTheDay } from './word-of-the-day';

/** The most notifications the plan holds: the most iOS keeps pending for one app. */
export const MAX_PLANNED_NOTIFICATIONS = 64;

/** How many local days of Notification times the plan reaches, from the next time ahead. */
export const PLAN_DAYS = 14;

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

/** What the plan needs to know of the Edition: whether it has a notification sound of its own. */
export interface PlanEdition {
  /** Without it, the Edition has none, and notifications play the system sound. */
  readonly hasNotificationSound?: boolean;
}

/** The Notification times, the sound and the permission the plan follows. */
interface PlanSettings {
  /** Local times `HH:MM`, in time order. */
  readonly times: readonly string[];
  readonly sound: boolean;
  /** Whether the device lets the app notify, as the scheduler reported it. */
  readonly permission: NotificationPermission;
}

const { notificationPlan: planRecords } = userStateRecords;

/** When a notification comes: a local date `YYYY-MM-DD` and a local time `HH:MM`. */
type Slot = Pick<PlannedNotification, 'date' | 'time'>;

/** The id of a notification's plan record: its local date and time joined with a `T`. */
const slotId = ({ date, time }: Slot) => `${date}T${time}`;

const twoDigits = (value: number) => String(value).padStart(2, '0');

/**
 * The Word the plan Reserved for the morning of the local day `date`
 * (`YYYY-MM-DD`): the Word of the earliest notification planned that day, if
 * any. The Word of the Day module takes it when the day comes (ADR 0016's
 * amendment for 0.4).
 */
export async function morningWordOf(
  userState: UserState,
  date: string,
): Promise<string | undefined> {
  const stored = await userState.list(planRecords);
  const [earliest] = [...stored.keys()].filter((id) => id.startsWith(`${date}T`)).sort();
  return earliest === undefined ? undefined : stored.get(earliest);
}

/**
 * When each notification the plan covers comes, in time order: every time
 * from the next one still ahead today (a time due this minute has passed),
 * for `PLAN_DAYS` days' worth of times, and never more than
 * `MAX_PLANNED_NOTIFICATIONS`.
 */
function slotsAhead(times: readonly string[], clock: Clock): Slot[] {
  const today = todayKey(clock);
  const { hour, minute } = localTimeOf(clock.now(), clock);
  const now = `${twoDigits(hour)}:${twoDigits(minute)}`;
  const count = Math.min(times.length * PLAN_DAYS, MAX_PLANNED_NOTIFICATIONS);
  const slots: Slot[] = [];
  for (let day = 0; slots.length < count; day += 1) {
    const date = dateKeyAfter(today, day);
    for (const time of times) {
      if (slots.length < count && (day > 0 || time > now)) slots.push({ date, time });
    }
  }
  return slots;
}

/**
 * The body of a notification: the text, or when it is longer than
 * `NOTIFICATION_BODY_LENGTH`, its start cut at a word boundary, without the
 * punctuation before the cut, and the ellipsis.
 */
export function notificationBody(text: string, ellipsis: string): string {
  const characters = Array.from(text);
  if (characters.length <= NOTIFICATION_BODY_LENGTH) return text;
  const room = NOTIFICATION_BODY_LENGTH - Array.from(ellipsis).length;
  // One character more than fits, so a space right after the cut counts as a boundary.
  const head = characters.slice(0, room + 1).join('');
  const boundary = head.search(/\s\S*$/u);
  const cut = boundary > 0 ? head.slice(0, boundary) : characters.slice(0, room).join('');
  return `${cut.replace(/[\s,.;:–—-]+$/u, '')}${ellipsis}`;
}

/**
 * Makes the plan of the Notification times, for the Notifications module,
 * and hands it to the device's scheduler (ADR 0021). The plan is a list of
 * floating local dates and times, each with one Word. It keeps it in the user
 * state as one record per notification, and a Word with a record is
 * Reserved.
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
 * `reserves` tells whether a Word is Reserved now, so the composition plans
 * again when the Feed makes one Seen.
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
}): {
  plan(settings: PlanSettings): Promise<void>;
  reserves(wordId: string): Promise<boolean>;
} {
  /** The Words the notifications without one take, in the order they take them. */
  function freshWords(planned: Iterable<string>, taken: ReadonlySet<string>): string[] {
    const place = new Map(cycle.order().words.map((id, index) => [id, index]));
    const furthest = Math.max(-1, ...Array.from(planned, (id) => place.get(id) ?? -1));
    const unseen = cycle.unseen().words.filter((id) => !taken.has(id));
    const after = (id: string) => (place.get(id) ?? -1) > furthest;
    return [...unseen.filter(after), ...unseen.filter((id) => !after(id))];
  }

  /**
   * The Word of each notification that gets one, given the Word of each
   * stored plan record by its id and the earliest Notification time.
   */
  function chooseWords(
    slots: readonly Slot[],
    stored: ReadonlyMap<string, string>,
    earliest: string | undefined,
  ): { readonly slot: Slot; readonly wordId: string }[] {
    const unseen = new Set(cycle.unseen().words);
    const kept = new Map<Slot, string>();
    // Today's Word of the Day goes to this morning's notification or to none.
    const today = wordOfTheDay.chosen()?.wordId;
    const keptWords = new Set<string>(today === undefined ? [] : [today]);
    const morning = slots.find(({ date, time }) => date === todayKey(clock) && time === earliest);
    if (morning !== undefined && today !== undefined && unseen.has(today)) kept.set(morning, today);
    for (const slot of slots) {
      if (kept.has(slot)) continue;
      const wordId = stored.get(slotId(slot));
      if (wordId !== undefined && unseen.has(wordId) && !keptWords.has(wordId)) {
        kept.set(slot, wordId);
        keptWords.add(wordId);
      }
    }
    const fresh = freshWords(stored.values(), keptWords);
    return slots.flatMap((slot) => {
      const wordId = kept.get(slot) ?? fresh.shift();
      return wordId === undefined ? [] : [{ slot, wordId }];
    });
  }

  function soundOf(on: boolean): PlannedSound {
    if (!on) return 'silent';
    return edition.hasNotificationSound === true ? 'edition' : 'system';
  }

  async function plan({ times, sound, permission }: PlanSettings): Promise<void> {
    const slots = permission === 'allowed' ? slotsAhead(times, clock) : [];
    const stored = await userState.list(planRecords);
    const notifications: PlannedNotification[] = [];
    for (const { slot, wordId } of chooseWords(slots, stored, times[0])) {
      const word = await entries.get(wordId);
      if (word?.kind !== 'word') continue;
      notifications.push({
        ...slot,
        title: renderStress(word),
        body: notificationBody(word.primaryDefinition, ellipsis),
        wordId,
        sound: soundOf(sound),
      });
    }
    const planned = new Map(
      notifications.map((notification) => [slotId(notification), notification.wordId]),
    );
    const changes: UserStateChanges = new Map([
      ...[...stored.keys()]
        .filter((id) => !planned.has(id))
        .flatMap((id) => [...planRecords.record(id).change(undefined)]),
      ...[...planned]
        .filter(([id, wordId]) => stored.get(id) !== wordId)
        .flatMap(([id, wordId]) => [...planRecords.record(id).change(wordId)]),
    ]);
    if (changes.size > 0) await userState.write(changes);
    await scheduler.replacePlan(notifications);
  }

  return {
    plan,
    async reserves(wordId) {
      return [...(await userState.list(planRecords)).values()].includes(wordId);
    },
  };
}
