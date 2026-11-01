import type { Edition } from '../edition/edition';
import { dateKeyOf } from '../local-date';
import { LEVEL_MILESTONES, nameOf, totalFor } from '../progress/levels';
import type { XpLog } from '../progress/xp-log';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type { FeedNotices } from './feed-notices';

const { levelMilestonesClosed, noCounters } = userStateRecords;

/**
 * The level-milestone Feed Notices (ADR 0066): once the reader reaches Level
 * 5, 10 or 20, a Feed Notice that suggests a wider rarity or a new Category
 * and forces neither. The day comes from the XP log; the Notice comes from
 * that day on, highest Level first, until the reader swipes past it, which
 * closes it for good on this device, so each milestone comes once. None while
 * the Level is off or the reader hides the counters («Без лічильників»).
 */
export function createLevelMilestones({
  edition,
  xpLog,
  userState,
}: {
  edition: Pick<Edition, 'levels' | 'isFeatureEnabled'>;
  xpLog: Pick<XpLog, 'state' | 'reachedOn'>;
  userState: Pick<UserState, 'read'>;
}): FeedNotices {
  return {
    async forDay(day) {
      if (xpLog.state.level === undefined) return [];
      if (edition.isFeatureEnabled('noCounters') && (await userState.read(noCounters)) === true)
        return [];
      const date = dateKeyOf(day);
      const closed = (await userState.read(levelMilestonesClosed)) ?? [];
      const level = LEVEL_MILESTONES.find((milestone) => {
        if (closed.includes(milestone)) return false;
        const reached = xpLog.reachedOn(totalFor(edition.levels, milestone));
        return reached !== undefined && reached <= date;
      });
      return level === undefined
        ? []
        : [{ notice: 'levelMilestone', level, name: nameOf(edition.levels, level) }];
    },
  };
}
