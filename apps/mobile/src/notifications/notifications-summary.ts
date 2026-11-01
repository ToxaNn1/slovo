import type { EditionStrings, Plural } from '@slovo/contracts';
import type { Edition, NotificationsState } from '@slovo/core';

/** The most a day brings with the evening notification on: the Word of the Day and the evening one. */
const MOST_A_DAY_WITH_EVENING = 2;

/**
 * The value of the «Сповіщення» row of Settings: how many notifications a day
 * are planned, or «Вимкнено» with no times or while iOS doesn't allow
 * notifications, denied or not asked yet, as nothing comes then. With the
 * evening notification on, only the earliest time takes the Word of the Day
 * and the latest the evening one (story 57), so a day brings at most 2; off,
 * every time takes a Word.
 */
export function notificationsSummary({
  notifications,
  edition,
  strings,
  count,
}: {
  notifications: NotificationsState;
  edition: Pick<Edition, 'isFeatureEnabled'>;
  strings: EditionStrings['notifications'];
  count: (forms: Plural, count: number) => string;
}): string {
  const { times, permission } = notifications;
  if (times.length === 0 || permission !== 'allowed') return strings.off;
  const aDay = edition.isFeatureEnabled('eveningNotification')
    ? Math.min(times.length, MOST_A_DAY_WITH_EVENING)
    : times.length;
  return count(strings.perDay, aDay);
}
