import type { WordCardModel } from '../entries/word-card';
import type { AnyEntryCard } from './entry-feed-card';
import type { FeedNotice } from '../feed-notice';
import type { LocalDate } from '../local-date';
import type { UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** A day of the first week, the first Active Day after the onboarding day 1 (ADR 0054). */
export type FirstWeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * What a Feed Notice shows: the first-week card, also its day of the first
 * week; Yesterday, the card of the day before's Word of the Day, which the
 * shell shows in Self-check style with the Knowledge Marks of its Word; the
 * Community Word, the card of its Entry and how many readers added it.
 */
export type FeedNoticeContent =
  | { readonly notice: Exclude<FeedNotice, 'firstWeek' | 'yesterday' | 'communityWord'> }
  | { readonly notice: 'firstWeek'; readonly firstWeekDay: FirstWeekDay }
  | { readonly notice: 'yesterday'; readonly word: WordCardModel }
  | { readonly notice: 'communityWord'; readonly card: AnyEntryCard; readonly adds: number };

/**
 * What gives the Feed the Feed Notices of a local day, in any order, for the
 * card after the Entry `after`, if one comes before it: the reader reaches
 * that card only by leaving the Entry, which so becomes Seen.
 */
export interface FeedNotices {
  forDay(day: LocalDate, after?: string): Promise<readonly FeedNoticeContent[]>;
}

/** The Feed Notices of each day that every one of `sources` gives. */
export function allFeedNotices(...sources: readonly FeedNotices[]): FeedNotices {
  return {
    forDay: async (day, after) =>
      (await Promise.all(sources.map((each) => each.forDay(day, after)))).flat(),
  };
}

/** No Feed Notice on any day, as long as no feature makes one. */
export const noFeedNotices: FeedNotices = { forDay: () => Promise.resolve([]) };

const { feedNoticesClosed } = userStateRecords;

/** The Feed Notices closed for the local day `date` (`YYYY-MM-DD`). */
export async function closedNotices(userState: UserState, date: string): Promise<Set<FeedNotice>> {
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
