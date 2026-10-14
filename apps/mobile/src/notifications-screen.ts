import type { EditionStrings, Plural } from '@slovo/contracts';
import type { NotificationsState } from '@slovo/core';

/**
 * The value of the «Сповіщення» row of Settings: how many times a day, or
 * «Вимкнено» with none or while iOS denies notifications.
 */
export function notificationsSummary({
  notifications,
  strings,
  count,
}: {
  notifications: NotificationsState;
  strings: EditionStrings['notifications'];
  count: (forms: Plural, count: number) => string;
}): string {
  const { times, permission } = notifications;
  return times.length === 0 || permission === 'denied'
    ? strings.off
    : count(strings.perDay, times.length);
}
