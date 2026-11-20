import type { EditionStrings } from '@slovo/contracts';
import type { NotificationsState } from '@slovo/core';

/**
 * The value of the «Сповіщення» row of Settings (board 11, screen 83): the
 * Word's and the Reminder's times in the order of the day, «09:00, 19:00»,
 * the Word's alone with no Reminder, and «Вимкнено» while off or while iOS
 * doesn't allow notifications, denied or not asked yet, as nothing comes then.
 */
export function notificationsSummary({
  notifications: { times, permission },
  strings,
}: {
  notifications: NotificationsState;
  strings: EditionStrings['notifications'];
}): string {
  if (permission !== 'allowed' || times.kind === 'off') return strings.off;
  return times.reminder === undefined ? times.word : `${times.word}, ${times.reminder}`;
}
