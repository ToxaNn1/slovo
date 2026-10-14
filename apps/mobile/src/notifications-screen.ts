import type { EditionStrings, Plural } from '@slovo/contracts';
import type { Notifications, NotificationsState, NotificationTimeRefusal } from '@slovo/core';

/** The value of the «Сповіщення» row of Settings: how many times a day, or «Вимкнено» with none. */
export function notificationsSummary({
  notifications,
  strings,
  count,
}: {
  notifications: NotificationsState;
  strings: EditionStrings['notifications'];
  count: (forms: Plural, count: number) => string;
}): string {
  const { length } = notifications.times;
  return length === 0 ? strings.off : count(strings.perDay, length);
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** The local time of day a picked date stands for, as a Notification time `HH:MM`. */
export function timeOfDay(date: Date): string {
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** The Notification time `HH:MM` on the day of `day`, for the picker to start from. */
export function dateOfTime(time: string, day: Date): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Keeps the time the reader picked: it replaces the time `from`, or is added
 * when there is no `from`. Resolves to why it was refused, or nothing when it
 * is kept; rejects when the change could not be written.
 */
export async function keepPickedTime({
  notifications,
  from,
  picked,
}: {
  notifications: Notifications;
  from?: string;
  picked: Date;
}): Promise<NotificationTimeRefusal | undefined> {
  const to = timeOfDay(picked);
  const result =
    from === undefined ? await notifications.addTime(to) : await notifications.changeTime(from, to);
  return result?.ok === false ? result.reason : undefined;
}
