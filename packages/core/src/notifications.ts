import { MAX_NOTIFICATION_TIMES, TimeOfDaySchema } from '@slovo/contracts';

import type { UserSettingDefaults } from './edition';
import { createInTurn, createSubscribers } from './in-turn';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** What the Notifications module needs to know of the Edition: its default Notification times. */
export interface NotificationsEdition {
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
}

/** Why a Notification time is refused, for the UI to say in the Edition's words. */
export type NotificationTimeRefusal =
  /** The time is in the list already. */
  | 'duplicate'
  /** `MAX_NOTIFICATION_TIMES` are set already. */
  | 'limit';

export type NotificationTimeResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: NotificationTimeRefusal };

/**
 * Notifications: the reader's Notification times and whether notifications
 * play their sound. Both stay on this device. Read from the user state once,
 * when it opens, so open one per app session (the Core composition does). A
 * change is made in memory only once it is written. A time that is not a
 * local time `HH:MM` is a mistake of the caller and is thrown, not refused.
 */
export interface Notifications {
  /**
   * The times and the sound as they stand. A change never edits it: it makes
   * a new one and tells the subscribers, so it stays the same object until
   * something changes.
   */
  readonly state: NotificationsState;
  /** Adds the time; refused when it is in the list already or the list is full. */
  addTime(time: string): Promise<NotificationTimeResult>;
  /**
   * Changes the time `from` into `to`; refused when `to` is another time in
   * the list. Nothing for a `from` not in the list.
   */
  changeTime(from: string, to: string): Promise<NotificationTimeResult | undefined>;
  /** Removes the time. A time not in the list is skipped. */
  removeTime(time: string): Promise<void>;
  /** Switches the notification sound on or off. */
  setSound(on: boolean): Promise<void>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { notificationTimes: timesRecord, notificationSound: soundRecord } = userStateRecords;

function stateOf(times: readonly string[], sound: boolean): NotificationsState {
  const sorted = [...times].sort();
  return { times: sorted, sound, canAddTime: sorted.length < MAX_NOTIFICATION_TIMES };
}

/**
 * Opens Notifications over the user state: the stored times, or the
 * Edition's default ones while the reader has never changed them.
 */
export async function openNotifications({
  edition,
  userState,
}: {
  edition: NotificationsEdition;
  userState: UserState;
}): Promise<Notifications> {
  const [storedTimes, storedSound] = await Promise.all([
    userState.read(timesRecord),
    userState.read(soundRecord),
  ]);
  let state = stateOf(
    storedTimes ?? edition.userSettingDefaults.notificationTimes,
    storedSound ?? true,
  );
  const subscribers = createSubscribers();

  /** Writes the times, an empty list included, then makes the change in memory. */
  async function keepTimes(times: readonly string[]): Promise<NotificationTimeResult> {
    const next = stateOf(times, state.sound);
    await userState.write(timesRecord.change([...next.times]));
    state = next;
    subscribers.tell();
    return { ok: true };
  }

  async function addTime(time: string): Promise<NotificationTimeResult> {
    TimeOfDaySchema.parse(time);
    if (state.times.includes(time)) return { ok: false, reason: 'duplicate' };
    if (!state.canAddTime) return { ok: false, reason: 'limit' };
    return keepTimes([...state.times, time]);
  }

  async function changeTime(from: string, to: string): Promise<NotificationTimeResult | undefined> {
    TimeOfDaySchema.parse(to);
    if (!state.times.includes(from)) return undefined;
    if (from === to) return { ok: true };
    if (state.times.includes(to)) return { ok: false, reason: 'duplicate' };
    return keepTimes(state.times.map((time) => (time === from ? to : time)));
  }

  async function removeTime(time: string): Promise<void> {
    if (!state.times.includes(time)) return;
    await keepTimes(state.times.filter((kept) => kept !== time));
  }

  async function setSound(on: boolean): Promise<void> {
    if (state.sound === on) return;
    await userState.write(soundRecord.change(on));
    state = stateOf(state.times, on);
    subscribers.tell();
  }

  const inTurn = createInTurn();

  return {
    get state() {
      return state;
    },
    addTime: (time) => inTurn(() => addTime(time)),
    changeTime: (from, to) => inTurn(() => changeTime(from, to)),
    removeTime: (time) => inTurn(() => removeTime(time)),
    setSound: (on) => inTurn(() => setSound(on)),
    subscribe: subscribers.subscribe,
  };
}
