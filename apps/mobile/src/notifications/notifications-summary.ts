import type { EditionStrings } from '@slovo/contracts';
import type { NotificationsState } from '@slovo/core';

/**
 * The value of the «Сповіщення» row of Settings (board 11, screen 83): the
 * first Notification time of the day, or «Вимкнено» with no times or while
 * iOS doesn't allow notifications, denied or not asked yet, as nothing comes
 * then.
 */
export function notificationsSummary({
  notifications,
  strings,
}: {
  notifications: NotificationsState;
  strings: EditionStrings['notifications'];
}): string {
  const { times, permission } = notifications;
  if (permission !== 'allowed') return strings.off;
  // A time is «HH:MM», so the first in the text order is the first of the day.
  const [first] = [...times].sort();
  return first ?? strings.off;
}
