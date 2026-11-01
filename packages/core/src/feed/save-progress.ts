import type { Edition } from '../edition/edition';
import { dateKeyOf } from '../local-date';
import type { ActiveDays } from '../progress/active-days';
import { totalFor } from '../progress/levels';
import type { XpLog } from '../progress/xp-log';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type { FeedNotices } from './feed-notices';

const { saveProgressOffered } = userStateRecords;

/** The most days the save-progress Feed Notice comes on. */
const MOST_DAYS = 2;

/**
 * The save-progress Feed Notice (spec #1358 story 70): to a reader with no
 * Account, on the day today's Active Day brings the Streak to 3 and on the
 * day the reader reaches Level 1, the first new Level. It comes on at most
 * two days in total, kept on this device; on such a day it comes again. None
 * while the Profile or the Account is off, or without `signedIn`.
 */
export function createSaveProgress({
  edition,
  xpLog,
  activeDays,
  userState,
  signedIn,
}: {
  edition: Pick<Edition, 'levels' | 'isFeatureEnabled'>;
  xpLog: Pick<XpLog, 'state' | 'reachedOn'>;
  activeDays: Pick<ActiveDays, 'days' | 'streak'>;
  userState: Pick<UserState, 'read' | 'write'>;
  signedIn: (() => boolean) | undefined;
}): FeedNotices {
  return {
    async forDay(day) {
      if (signedIn === undefined || signedIn()) return [];
      if (!edition.isFeatureEnabled('profile') || !edition.isFeatureEnabled('account')) return [];
      const date = dateKeyOf(day);
      const streakDay = activeDays.streak.streak === 3 && activeDays.days.has(date);
      const firstLevel =
        xpLog.state.level !== undefined && xpLog.reachedOn(totalFor(edition.levels, 1)) === date;
      if (!streakDay && !firstLevel) return [];
      const offered = (await userState.read(saveProgressOffered)) ?? [];
      if (offered.includes(date)) return [{ notice: 'saveProgress' }];
      if (offered.length >= MOST_DAYS) return [];
      await userState.write(saveProgressOffered.change([...offered, date]));
      return [{ notice: 'saveProgress' }];
    },
  };
}
