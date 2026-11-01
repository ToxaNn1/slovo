import type { Edition } from '../edition/edition';
import { dateKeyOf } from '../local-date';
import { LEVEL_MILESTONES, nameOf, totalFor } from '../progress/levels';
import type { XpLog } from '../progress/xp-log';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type { FeedNotices } from './feed-notices';

/**
 * The level-milestone Feed Notices (ADR 0066): on the local day the reader
 * reaches Level 5, 10 or 20, a Feed Notice that suggests a wider rarity or a
 * new Category and forces neither. The day comes from the XP log, so each
 * milestone has one day and comes on no other; swiping past it closes it for
 * that day. None while the Level is off or the reader hides the counters.
 */
export function createLevelMilestones({
  edition,
  xpLog,
  userState,
}: {
  edition: Pick<Edition, 'levels'>;
  xpLog: Pick<XpLog, 'state' | 'reachedOn'>;
  userState: Pick<UserState, 'read'>;
}): FeedNotices {
  return {
    async forDay(day) {
      if (xpLog.state.level === undefined) return [];
      if ((await userState.read(userStateRecords.hideStreak)) === true) return [];
      const date = dateKeyOf(day);
      const level = LEVEL_MILESTONES.find(
        (milestone) => xpLog.reachedOn(totalFor(edition.levels, milestone)) === date,
      );
      return level === undefined
        ? []
        : [{ notice: 'levelMilestone', level, name: nameOf(edition.levels, level) }];
    },
  };
}
