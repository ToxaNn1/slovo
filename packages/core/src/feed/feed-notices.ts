import type { LocalDate } from '../local-date';
import type { UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/**
 * The Feed Notices, in the order the Feed shows those of one day: the Weekly
 * Recap, the first-week card, Yesterday, and the Daily Limit card once the
 * limit is reached (ADR 0054).
 */
export const FEED_NOTICES = ['weeklyRecap', 'firstWeek', 'yesterday', 'dailyLimit'] as const;

/** A Feed Notice: a Feed card that is not an Entry. */
export type FeedNotice = (typeof FEED_NOTICES)[number];

/** What gives the Feed the Feed Notices of a local day, in any order. */
export interface FeedNotices {
  forDay(day: LocalDate): Promise<readonly FeedNotice[]>;
}

/** No Feed Notice on any day, as long as no feature makes one. */
export const noFeedNotices: FeedNotices = { forDay: () => Promise.resolve([]) };

const { feedNoticesClosed } = userStateRecords;

/** The Feed Notices closed for the local day `date` (`YYYY-MM-DD`). */
export async function closedNotices(userState: UserState, date: string): Promise<Set<string>> {
  const closed = await userState.read(feedNoticesClosed);
  return new Set(closed?.date === date ? closed.notices : []);
}

/** The change that closes the Feed Notice for the local day `date` (`YYYY-MM-DD`). */
export async function closeNotice(
  userState: UserState,
  notice: FeedNotice,
  date: string,
): Promise<UserStateChanges> {
  const notices = await closedNotices(userState, date);
  return feedNoticesClosed.change({ date, notices: [...notices.add(notice)] });
}
