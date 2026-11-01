import type { Edition } from '../edition/edition';
import type { FeedNotices } from '../feed/feed-notices';
import { dateKeyOf, dayNumber, localDayOf, parseLocalDate } from '../local-date';
import type { Clock, NotificationPermission } from '../ports';
import type { XpLog } from '../progress/xp-log';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** The day after the onboarding's on which the explainer comes at the latest: day 3. */
const EXPLAINER_LATEST_DAY = 2;

/** The days after the explainer was first offered on which its one re-ask comes. */
const REASK_AFTER_DAYS = 7;

const { notificationAsk, onboardingFinished } = userStateRecords;

/**
 * The pre-permission explainer as a Feed Notice (ADR 0067): once the
 * onboarding is finished and while the reader has not been asked for
 * permission to notify, the explainer comes on the first local day the Daily
 * Goal is met, and no later than the onboarding day + 2 (day 3). Its «Так»
 * asks the device; the iOS prompt never comes before it. The day it is first
 * offered is kept: offered on a later day with the permission still not
 * asked, it was refused, and the re-ask comes once, 7 days after the first
 * offer or on the first day the Feed opens after. Its day passed, it never
 * comes again. A reader the device asked already (the onboarding's step,
 * Settings) sees neither. Never while the `notificationExplainer` Feature
 * Switch or notifications are off.
 */
export function createNotificationExplainer({
  edition,
  userState,
  clock,
  xpLog,
  permission,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
  clock: Clock;
  xpLog: Pick<XpLog, 'dayOf'>;
  permission: () => NotificationPermission;
}): FeedNotices {
  return {
    async forDay(day) {
      if (
        !edition.isFeatureEnabled('notificationExplainer') ||
        !edition.isFeatureEnabled('notifications') ||
        permission() !== 'not-asked'
      )
        return [];
      const finished = await userState.read(onboardingFinished);
      if (finished === undefined) return [];
      const date = dateKeyOf(day);
      const today = dayNumber(day);
      const asked = await userState.read(notificationAsk);
      if (asked === undefined) {
        const onboardingDay = dayNumber(localDayOf(new Date(finished), clock).date);
        const due =
          today >= onboardingDay + EXPLAINER_LATEST_DAY ||
          xpLog.dayOf(date).dailyGoal?.met === true;
        if (!due) return [];
        await userState.write(notificationAsk.change({ step: 'explainer', date }));
        return [{ notice: 'notificationExplainer' }];
      }
      if (asked.date === date) {
        return [
          { notice: asked.step === 'explainer' ? 'notificationExplainer' : 'notificationReask' },
        ];
      }
      if (asked.step === 'reask') return [];
      if (today < dayNumber(parseLocalDate(asked.date)) + REASK_AFTER_DAYS) return [];
      await userState.write(notificationAsk.change({ step: 'reask', date }));
      return [{ notice: 'notificationReask' }];
    },
  };
}
