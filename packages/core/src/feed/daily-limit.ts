import type { FeatureSwitch } from '@slovo/contracts';

import type { UserSettingDefaults } from '../edition/edition';
import type { FeedNotices } from './feed-notices';
import { dateKeyOf, localDayOf } from '../local-date';
import type { Clock } from '../ports';
import type { History } from '../saved/history';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** What the Daily Limit needs of the Edition. */
export interface DailyLimitEdition {
  isFeatureEnabled(feature: FeatureSwitch): boolean;
  /** The Daily Limit a new user starts with, until the reader sets one. */
  readonly userSettingDefaults: Pick<UserSettingDefaults, 'dailyLimit'>;
}

/**
 * The Daily Limit card as a Feed Notice: on a local day once the distinct
 * Entries Seen on it, the Word of the Day included, reach the Daily Limit the
 * reader set, else the Edition's default. History keeps one entry per Entry,
 * its last Seen, so an Entry Seen again counts once. Never while the limit or
 * its Feature Switch is off (ADR 0054).
 */
export function dailyLimitNotices({
  edition,
  userState,
  history,
  clock,
}: {
  edition: DailyLimitEdition;
  userState: UserState;
  history: Pick<History, 'list'>;
  clock: Clock;
}): FeedNotices {
  return {
    async forDay(day) {
      if (!edition.isFeatureEnabled('dailyLimit')) return [];
      const limit =
        (await userState.read(userStateRecords.dailyLimit)) ??
        edition.userSettingDefaults.dailyLimit;
      if (limit === 'off') return [];
      const date = dateKeyOf(day);
      const seen = history.list.filter(
        ({ seenAt }) => dateKeyOf(localDayOf(seenAt, clock).date) === date,
      ).length;
      return seen >= limit ? [{ notice: 'dailyLimit' }] : [];
    },
  };
}
