import type { EditionStrings, Plural } from '@slovo/contracts';
import type { NotificationsState } from '@slovo/core';

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
