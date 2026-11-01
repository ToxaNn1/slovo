import { fill } from '@slovo/contracts';

import type { Cycle } from '../feed/cycle';
import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import {
  dateKeyOf,
  dayNumber,
  compareTimesOfDay,
  formatTimeOfDay,
  localDateAfter,
  localTimeOf,
  parseLocalDate,
  todayDate,
  type TimeOfDay,
} from '../local-date';
import type {
  Clock,
  EveningMessage,
  NotificationPermission,
  NotificationSchedulerPort,
  PlannedNotification,
  PlannedSound,
  Random,
} from '../ports';
import {
  createReservedWords,
  slotId,
  type PlannedWord,
  type Slot,
  type StoredPlan,
} from '../feed/reserved-words';
import { renderStress } from '../entries/stress';
import { notificationBody } from './notification-text';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type { WordOfTheDay } from '../feed/word-of-the-day';
import type { ActiveDays } from '../progress/active-days';
import { ACTIVE_DAY_XP, deriveStreak } from '../progress/streak';
import type { XpLog } from '../progress/xp-log';

/** The most notifications the plan holds: the most iOS keeps pending for one app. */
const MAX_PLANNED_NOTIFICATIONS = 64;

/** How many local days of Notification times the plan reaches, from the next time ahead. */
const PLAN_DAYS = 14;

/**
 * What the plan needs from the shell: the device's notification scheduler,
 * and from the Edition's UI strings the mark that ends a cut body, the title
 * templates, each with `{word}`, and the farewell of the polite pause.
 */
export interface NotificationScheduling {
  readonly scheduler: NotificationSchedulerPort;
  readonly ellipsis: string;
  readonly titles: readonly string[];
  readonly farewell: string;
  /** The evening texts of the 1.0 plan. */
  readonly streakWarning: string;
  readonly goalNotMet: string;
}

/** The Streak below which the evening notification never warns of it. */
const STREAK_WARNING_AT = 7;

const { notificationTitles: titlesRecord } = userStateRecords;

/**
 * What the plan needs to know of the Edition: its id, which every
 * notification carries, its notification sound, if it has one, and the
 * effective values of the Feature Switches it follows,
 * notifications and the Word of the Day, which it reads each time it plans.
 */
export interface PlanEdition extends Pick<Edition, 'id' | 'isFeatureEnabled'> {
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

/**
 * The slots of the polite pause (ADR 0054): every time from the next one
 * still ahead today to the last of the `PLAN_DAYS`th local day after today,
 * the last of which is the farewell. Every plan is made with the app open,
 * so today is the day of the last open. When the times hold more than
 * `MAX_PLANNED_NOTIFICATIONS`, the farewell stays the last and the slots
 * with a Word end earlier.
 */
function slotsUntilPause(
  times: readonly TimeOfDay[],
  clock: Clock,
): { slots: Slot[]; farewell: Slot | undefined } {
  const today = todayDate(clock);
  const now = localTimeOf(clock.now(), clock);
  const slots: Slot[] = [];
  for (let day = 0; day <= PLAN_DAYS; day += 1) {
    const date = localDateAfter(today, day);
    for (const time of times) {
      if (day > 0 || compareTimesOfDay(time, now) > 0) slots.push({ date, time });
    }
  }
  const farewell = slots.pop();
  return { slots: slots.slice(0, MAX_PLANNED_NOTIFICATIONS - 1), farewell };
}

/**
 * A template drawn with `random` from `count`, never `previous`: the draw
 * lands among the others. With one template, that one.
 */
function drawTemplate(count: number, previous: number | undefined, random: Random): number {
  const others = previous === undefined || previous >= count || count < 2 ? count : count - 1;
  const drawn = Math.min(Math.floor(random.next() * others), others - 1);
  return others < count && drawn >= (previous ?? 0) ? drawn + 1 : drawn;
}

/** Whether a slot is this morning's: today at the earliest Notification time. */
function isMorningOf(earliest: TimeOfDay, clock: Clock): (slot: Slot) => boolean {
  const today = dayNumber(todayDate(clock));
  return ({ date, time }) => dayNumber(date) === today && compareTimesOfDay(time, earliest) === 0;
}

/** The plan of the Notification times on the device's scheduler, for the Notifications module. */
export interface NotificationPlanner {
  /** Whether the device lets the app notify. */
  permission(): Promise<NotificationPermission>;
  /** Asks the reader for permission to notify when they haven't been asked yet, and reports it. */
  askPermission(): Promise<NotificationPermission>;
  plan(settings: PlanSettings): Promise<void>;
  /** What the evening notifications of a plan made now would say: a change of it calls for a new plan. */
  eveningKey(times: readonly TimeOfDay[]): Promise<string>;
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
  eveningKey: () => Promise.resolve(''),
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
 * With the Feature Switch of notifications off the plan is empty and nothing
 * is Reserved, like while the device doesn't allow notifications, and there
 * is no next morning. With the Word of the Day's off no notification carries
 * it: the earliest time of a day is a notification like the others.
 *
 * With the `politePause` Feature Switch on, the plan reaches no further than
 * the 14th local day after the last open, and the last time of that day is
 * the Edition's farewell, with no title and no Word, so it Reserves none;
 * nothing comes after it until the next open plans again (ADR 0054). Off,
 * the plan holds 14 days of times from the next one ahead.
 *
 * The plan is the active Edition's alone (ADR 0065): the composition opens
 * for that one Edition, so no other Edition plans, and every plan replaces
 * all the device held. Each notification carries the Edition's id.
 *
 * Each notification is titled by one of the Edition's title templates with
 * its Word, the Lemma with its Stress; the body is the primary Definition.
 * A notification still ahead keeps its template unless the one before it now
 * has the same; any other is drawn with `random`, never the template of the
 * notification just before, the last that came included (ADR 0054).
 *
 * `nextMorning` answers which morning notification a plan made now would
 * hold, also while the device doesn't let the app notify, and writes nothing.
 */
export function createNotificationPlanner({
  cycle,
  entries,
  userState,
  clock,
  random,
  edition,
  wordOfTheDay,
  xpLog,
  activeDays,
  scheduling: { scheduler, ellipsis, titles, farewell, ...evening },
}: {
  cycle: Pick<Cycle, 'order' | 'unseen'>;
  entries: Pick<Entries, 'get' | 'getMany'>;
  userState: UserState;
  clock: Clock;
  random: Random;
  edition: PlanEdition;
  wordOfTheDay: Pick<WordOfTheDay, 'chosen'>;
  xpLog: Pick<XpLog, 'dayOf' | 'days'>;
  activeDays: Pick<ActiveDays, 'days'>;
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
    const today = todaysWordOfTheDay();
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

  /** Today's Word of the Day, unless its Feature Switch is off and no notification carries it. */
  function todaysWordOfTheDay(): string | undefined {
    return edition.isFeatureEnabled('wordOfTheDay') ? wordOfTheDay.chosen()?.wordId : undefined;
  }

  /**
   * The title template of each planned notification, in time order, and
   * keeps them with the template of the last notification that came.
   */
  async function chooseTemplates(planned: readonly PlannedWord[]): Promise<number[]> {
    const stored = (await userState.read(titlesRecord)) ?? { planned: {} };
    const now = slotId({ date: todayDate(clock), time: localTimeOf(clock.now(), clock) });
    const [cameLast] = Object.keys(stored.planned)
      .filter((id) => id <= now)
      .sort()
      .reverse();
    const last = cameLast === undefined ? stored.last : stored.planned[cameLast];
    let previous = last;
    const templates = new Map<string, number>();
    for (const { slot } of planned) {
      const id = slotId(slot);
      const kept = stored.planned[id];
      previous =
        kept !== undefined && kept < titles.length && kept !== previous
          ? kept
          : drawTemplate(titles.length, previous, random);
      templates.set(id, previous);
    }
    const next = {
      ...(last === undefined ? {} : { last }),
      planned: Object.fromEntries(templates),
    };
    if (JSON.stringify(next) !== JSON.stringify(stored)) {
      await userState.write(titlesRecord.change(next));
    }
    return planned.map(({ slot }) => templates.get(slotId(slot)) ?? 0);
  }

  const notificationsOn = () => edition.isFeatureEnabled('notifications');

  /**
   * The slots with a Word, the evening slots and the farewell's while the
   * polite pause and the farewell are on. On the 1.0 plan only the earliest
   * time of a day takes a Word and its latest the evening slot, so a day
   * brings at most 2; off, every time takes a Word.
   */
  function slotsOf(times: readonly TimeOfDay[]): {
    slots: Slot[];
    evenings: Slot[];
    farewell: Slot | undefined;
  } {
    const { slots, farewell } = edition.isFeatureEnabled('politePause')
      ? slotsUntilPause(times, clock)
      : { slots: slotsAhead(times, clock), farewell: undefined };
    const shown = edition.isFeatureEnabled('notificationFarewell') ? farewell : undefined;
    const [earliest] = times;
    const latest = times.at(-1);
    if (!edition.isFeatureEnabled('eveningNotification') || earliest === undefined) {
      return { slots, evenings: [], farewell: shown };
    }
    const at = (time: TimeOfDay) => (slot: Slot) => compareTimesOfDay(slot.time, time) === 0;
    return {
      slots: slots.filter(at(earliest)),
      evenings: latest === undefined || times.length < 2 ? [] : slots.filter(at(latest)),
      farewell: shown,
    };
  }

  /**
   * Whether the evening slots stay silent: with the evening notification
   * off, or while the reader hides the counters («Без лічильників»), since
   * every evening message is a nudge by a counter.
   */
  async function eveningSilent(): Promise<boolean> {
    if (!edition.isFeatureEnabled('eveningNotification')) return true;
    return (
      edition.isFeatureEnabled('noCounters') &&
      (await userState.read(userStateRecords.noCounters)) === true
    );
  }

  /**
   * The evening message of a local date, projected with no XP earned from now
   * on: the Streak warning while the Streak is 7 or more, the day is below an
   * Active Day's XP and no freeze is held; else the goal reminder while the
   * Daily Goal is not met; else none. None on the days of a Break.
   */
  function eveningMessageOf(date: string): EveningMessage | undefined {
    const { breaks, frozen } = xpLog.days;
    const onBreak = [...breaks].some(([start, days]) => {
      const from = dayNumber(parseLocalDate(start));
      const day = dayNumber(parseLocalDate(date));
      return day >= from && day < from + days;
    });
    if (onBreak) return undefined;
    const { xp, dailyGoal } = xpLog.dayOf(date);
    const xpOn = edition.isFeatureEnabled('xpLog');
    const { streak, freezesHeld } = deriveStreak({
      activeDays: activeDays.days,
      frozen,
      breaks,
      today: date,
      freezes: xpOn && edition.isFeatureEnabled('streakFreezes'),
    });
    if (xpOn && streak >= STREAK_WARNING_AT && xp < ACTIVE_DAY_XP && freezesHeld === 0) {
      return 'streakWarning';
    }
    return dailyGoal !== null && !dailyGoal.met ? 'goalNotMet' : undefined;
  }

  function soundOf(on: boolean): PlannedSound {
    if (!on) return 'silent';
    return edition.notificationSound === undefined ? 'system' : { file: edition.notificationSound };
  }

  async function nextMorning(
    times: readonly TimeOfDay[],
  ): Promise<MorningNotification | undefined> {
    const [earliest] = times;
    if (!notificationsOn()) return undefined;
    const today = todaysWordOfTheDay();
    const wordId =
      earliest === undefined
        ? today !== undefined && cycle.unseen().words.includes(today)
          ? today
          : undefined
        : chooseWords(slotsOf(times).slots, await reservedWords.stored(), earliest).find(
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
    const {
      slots,
      evenings,
      farewell: farewellSlot,
    } = permission === 'allowed' && notificationsOn()
      ? slotsOf(times)
      : { slots: [], evenings: [], farewell: undefined };
    const stored = await reservedWords.stored();
    const chosen = chooseWords(slots, stored, times[0]);
    const words = await entries.getMany(chosen.map(({ wordId }) => wordId));
    const planned = chosen.flatMap((reserved) => {
      const word = words.get(reserved.wordId);
      return word?.kind === 'word' ? [{ reserved, word }] : [];
    });
    const templates = await chooseTemplates(planned.map(({ reserved }) => reserved));
    const notifications = planned.map(
      ({ reserved: { slot }, word }, index): PlannedNotification => ({
        kind: 'word',
        editionId: edition.id,
        date: dateKeyOf(slot.date),
        time: formatTimeOfDay(slot.time),
        // Every Edition lists its templates, so a template is always drawn.
        title: fill(titles[templates[index] ?? 0] ?? '{word}', { word: renderStress(word) }),
        body: notificationBody(word.primaryDefinition, ellipsis),
        wordId: word.id,
        sound: soundOf(sound),
      }),
    );
    const silent = await eveningSilent();
    for (const slot of silent ? [] : evenings) {
      const message = eveningMessageOf(dateKeyOf(slot.date));
      if (message === undefined) continue;
      notifications.push({
        kind: 'evening',
        editionId: edition.id,
        date: dateKeyOf(slot.date),
        time: formatTimeOfDay(slot.time),
        message,
        body: evening[message],
        sound: soundOf(sound),
      });
    }
    notifications.sort((one, other) =>
      `${one.date}T${one.time}`.localeCompare(`${other.date}T${other.time}`),
    );
    if (farewellSlot !== undefined) {
      notifications.push({
        kind: 'farewell',
        editionId: edition.id,
        date: dateKeyOf(farewellSlot.date),
        time: formatTimeOfDay(farewellSlot.time),
        body: farewell,
        sound: soundOf(sound),
      });
    }
    await stored.replace(planned.map(({ reserved }) => reserved));
    await scheduler.replacePlan(notifications);
  }

  return {
    permission: () => scheduler.permission(),
    askPermission: () => scheduler.askPermission(),
    plan,
    eveningKey: async (times) =>
      (await eveningSilent())
        ? ''
        : slotsOf(times)
            .evenings.map((slot) => eveningMessageOf(dateKeyOf(slot.date)) ?? '')
            .join(),
    isReserved: (wordId) => reservedWords.isReserved(wordId),
    nextMorning,
  };
}
