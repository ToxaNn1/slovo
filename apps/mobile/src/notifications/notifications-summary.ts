import type { EditionStrings } from '@slovo/contracts';
import type { NotificationsState } from '@slovo/core';

/** The most Notification times the «Сповіщення» row names one by one; past it, it counts them. */
const NAMED_TIMES = 3;

/**
 * The value of the «Сповіщення» row of Settings (board 11, screen 83): the
 * Notification times in the order of the day, «09:00, 13:00, 19:00», or their
 * count past three, «4 рази на день», and «Вимкнено» with no times or while
 * iOS doesn't allow notifications, denied or not asked yet, as nothing comes
 * then.
 */
export function notificationsSummary({
  notifications,
  strings,
  count,
}: {
  notifications: NotificationsState;
  strings: EditionStrings['notifications'];
  /** Fills a count into its plural form in the Edition's language. */
  count: (forms: EditionStrings['notifications']['timesCount'], count: number) => string;
}): string {
  const { times, permission } = notifications;
  if (permission !== 'allowed' || times.length === 0) return strings.off;
  if (times.length > NAMED_TIMES) return count(strings.timesCount, times.length);
  // A time is «HH:MM», so the text order is the order of the day.
  return [...times].sort().join(', ');
}
