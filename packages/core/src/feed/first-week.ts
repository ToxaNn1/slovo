import type { Edition } from '../edition/edition';
import { dateKeyOf } from '../local-date';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type { FeedNotices, FirstWeekDay } from './feed-notices';

const { activeDays, firstWeekFrom } = userStateRecords;

const FIRST_WEEK_DAYS = 7;

const isFirstWeekDay = (day: number): day is FirstWeekDay => day >= 1 && day <= FIRST_WEEK_DAYS;

/**
 * The first week: on each of the first 7 Active Days from the day the reader
 * finished the onboarding, the first-week card of that day, so a missed
 * calendar day eats no card. A reader who finished the onboarding before
 * 0.8.13 has no first week. Swiping past a card closes it for its day, and no
 * later day has its number, so it never comes back (ADR 0054).
 */
export function createFirstWeek({
  edition,
  userState,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
}): FeedNotices {
  return {
    async forDay(day) {
      const from = await userState.read(firstWeekFrom);
      if (from === undefined || !edition.isFeatureEnabled('firstWeek')) return [];
      const date = dateKeyOf(day);
      const before = [...(await userState.list(activeDays)).keys()].filter(
        (active) => active >= from && active < date,
      );
      const firstWeekDay = before.length + 1;
      return isFirstWeekDay(firstWeekDay) ? [{ notice: 'firstWeek', firstWeekDay }] : [];
    },
  };
}
