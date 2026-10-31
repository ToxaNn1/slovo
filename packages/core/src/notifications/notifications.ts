import { MAX_NOTIFICATION_TIMES, TimeOfDaySchema } from '@slovo/contracts';

import type { Cycle } from '../feed/cycle';
import type { UserSettingDefaults } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { createInTurn, createSubscribers } from '../in-turn';
import { compareTimesOfDay, parseTimeOfDay, type LocalDate } from '../local-date';
import {
  createNotificationPlanner,
  noNotificationPlanner,
  type MorningNotification,
  type NotificationScheduling,
  type PlanEdition,
} from './notification-plan';
import type { Clock, NotificationPermission, Random } from '../ports';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type { WordOfTheDay } from '../feed/word-of-the-day';

/**
 * What the Notifications module needs to know of the Edition: its default
 * Notification times, and its notification sound, if it has one.
 */
export interface NotificationsEdition extends PlanEdition {
  readonly userSettingDefaults: Pick<UserSettingDefaults, 'notificationTimes'>;
}

/** The Notification times and the sound as they stand. */
export interface NotificationsState {
  /**
   * The Notification times, local times `HH:MM`, in time order and no two
   * equal. An empty list means notifications are off.
   */
  readonly times: readonly string[];
  /** Whether notifications play their sound. */
  readonly sound: boolean;
  /** Whether another time can be added: fewer than `MAX_NOTIFICATION_TIMES` are set. */
  readonly canAddTime: boolean;
  /**
   * Whether the device lets the app notify, as it was when the plan was last
   * made. Without a scheduler it stays not asked.
   */
  readonly permission: NotificationPermission;
}

/** Why a Notification time is refused, for the UI to say in the Edition's words. */
export type NotificationTimeRefusal =
  /** The time is in the list already. */
  | 'duplicate'
  /** `MAX_NOTIFICATION_TIMES` are set already. */
  | 'limit';

/**
 * Notifications: the reader's Notification times, whether notifications play
 * their sound, and the plan of which Word comes at which time (ADR 0021). All
 * of it stays on this device. Read from the user state once, when it opens,
 * so open one per app session (the Core composition does). A change is made
 * in memory only once it is written, and the plan follows every change. A
 * time that is not a local time `HH:MM` is a mistake of the caller and is
 * thrown, not refused.
 */
export interface Notifications {
  /**
   * The times and the sound as they stand. A change never edits it: it makes
   * a new one and tells the subscribers, so it stays the same object until
   * something changes.
   */
  readonly state: NotificationsState;
  /**
   * Keeps the time the reader picked: it replaces the time `replacing`, or is
   * added when there is none to replace. Resolves to why it was refused (it
   * is another time in the list, or a time to add over the full list), or
   * nothing when it is kept. A `replacing` not in the list changes nothing.
   */
  keepTime(time: string, replacing?: string): Promise<NotificationTimeRefusal | undefined>;
  /** Removes the time. A time not in the list is skipped. */
  removeTime(time: string): Promise<void>;
  /** Switches the notification sound on or off. */
  setSound(on: boolean): Promise<void>;
  /**
   * Asks the reader for permission to notify, when they haven't been asked
   * yet, plans again and reports the permission: from the onboarding's
   * notifications step, or later from the notification settings. Once the
   * reader answered it asks nothing, so a refusal stays until they allow
   * notifications in the device's settings. Without a scheduler there is
   * nobody to ask: it stays not asked.
   */
  askPermission(): Promise<NotificationPermission>;
  /**
   * The morning notification a plan made now would hold were notifications
   * allowed, in turn after every change before it, for the onboarding's
   * sample; nothing without a scheduler.
   */
  nextMorning(): Promise<MorningNotification | undefined>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { notificationTimes: timesRecord, notificationSound: soundRecord } = userStateRecords;

function stateOf(
  times: readonly string[],
  sound: boolean,
  permission: NotificationPermission,
): NotificationsState {
  const sorted = [...times].sort((one, other) =>
    compareTimesOfDay(parseTimeOfDay(one), parseTimeOfDay(other)),
  );
  return { times: sorted, sound, canAddTime: sorted.length < MAX_NOTIFICATION_TIMES, permission };
}

/**
 * Opens Notifications over the user state, for the Core composition: the
 * stored times, or the Edition's default ones while the reader has never
 * changed them. It plans over the Cycle and the Word of the Day the
 * composition shares, and reads the permission and plans again on
 * `dayTurned`, `returned` and `eligibility`: when the app opens, a new local
 * day starts, the reader comes back or eligibility changes. Every plan first
 * calls `takeMorningWord`, the composition's day change, so a plan made on a
 * new day before the composition turned to it keeps the day's morning Word.
 * On `seen` it plans again when the Entry just Seen is a Reserved Word, so
 * its notification gets a new Word. Without `scheduling`, as in tools and in
 * tests of other features, nothing is planned and there is no next morning.
 */
export async function openNotifications({
  edition,
  userState,
  cycle,
  entries,
  clock,
  random,
  wordOfTheDay,
  takeMorningWord,
  scheduling,
  eligibility,
  seen,
  dayTurned,
  returned,
}: {
  edition: NotificationsEdition;
  userState: UserState;
  cycle: Pick<Cycle, 'order' | 'unseen'>;
  entries: Pick<Entries, 'get' | 'getMany'>;
  clock: Clock;
  random: Random;
  wordOfTheDay: Pick<WordOfTheDay, 'chosen'>;
  takeMorningWord: () => Promise<void>;
  scheduling: NotificationScheduling | undefined;
  eligibility: Pick<Subject<void>, 'subscribe'>;
  seen: Pick<Subject<string>, 'subscribe'>;
  dayTurned: Pick<Subject<LocalDate>, 'subscribe'>;
  returned: Pick<Subject<void>, 'subscribe'>;
}): Promise<Notifications> {
  const [storedTimes, storedSound] = await Promise.all([
    userState.read(timesRecord),
    userState.read(soundRecord),
  ]);
  let state = stateOf(
    storedTimes ?? edition.userSettingDefaults.notificationTimes,
    storedSound ?? true,
    'not-asked',
  );
  const subscribers = createSubscribers();
  const planner =
    scheduling === undefined
      ? noNotificationPlanner
      : createNotificationPlanner({
          cycle,
          entries,
          userState,
          clock,
          random,
          edition,
          wordOfTheDay,
          scheduling,
        });

  /** The Notification times as the plan takes them. */
  const planTimes = () => state.times.map(parseTimeOfDay);

  /** Reads the permission, telling the subscribers when it changed, and plans by it. */
  async function plan(): Promise<void> {
    const permission = await planner.permission();
    if (permission !== state.permission) {
      state = { ...state, permission };
      subscribers.tell();
    }
    await takeMorningWord();
    await planner.plan({ ...state, times: planTimes() });
  }

  /** Writes the times, an empty list included, then makes the change in memory and plans again. */
  async function writeTimes(times: readonly string[]): Promise<void> {
    const next = stateOf(times, state.sound, state.permission);
    await userState.write(timesRecord.change([...next.times]));
    state = next;
    subscribers.tell();
    await plan();
  }

  async function keepTime(
    time: string,
    replacing: string | undefined,
  ): Promise<NotificationTimeRefusal | undefined> {
    TimeOfDaySchema.parse(time);
    if (replacing !== undefined && !state.times.includes(replacing)) return undefined;
    if (replacing === time) return undefined;
    if (state.times.includes(time)) return 'duplicate';
    if (replacing === undefined && !state.canAddTime) return 'limit';
    await writeTimes(
      replacing === undefined
        ? [...state.times, time]
        : state.times.map((kept) => (kept === replacing ? time : kept)),
    );
    return undefined;
  }

  async function removeTime(time: string): Promise<void> {
    if (!state.times.includes(time)) return;
    await writeTimes(state.times.filter((kept) => kept !== time));
  }

  async function setSound(on: boolean): Promise<void> {
    if (state.sound === on) return;
    await userState.write(soundRecord.change(on));
    state = stateOf(state.times, on, state.permission);
    subscribers.tell();
    await plan();
  }

  async function askPermission(): Promise<NotificationPermission> {
    const reported = await planner.permission();
    const permission = reported === 'not-asked' ? await planner.askPermission() : reported;
    await plan();
    return permission;
  }

  const inTurn = createInTurn();
  const replan = () => inTurn(plan);
  eligibility.subscribe(replan);
  dayTurned.subscribe(replan);
  returned.subscribe(replan);
  seen.subscribe((entryId) =>
    inTurn(async () => {
      if (await planner.isReserved(entryId)) await plan();
    }),
  );

  return {
    get state() {
      return state;
    },
    keepTime: (time, replacing) => inTurn(() => keepTime(time, replacing)),
    removeTime: (time) => inTurn(() => removeTime(time)),
    setSound: (on) => inTurn(() => setSound(on)),
    askPermission: () => inTurn(askPermission),
    nextMorning: () =>
      inTurn(async () => {
        // As a plan does, so a new day the composition hasn't turned to keeps its morning Word.
        await takeMorningWord();
        return planner.nextMorning(planTimes());
      }),
    subscribe: subscribers.subscribe,
  };
}
