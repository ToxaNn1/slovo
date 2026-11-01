import type { FeatureSwitch } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { buildWordCard, type WordCardModel } from '../entries/word-card';
import type { AnyEntryCard } from './entry-feed-card';
import type { WeeklyRecap } from './weekly-recap';
import { FEED_NOTICES, type FeedNotice } from '../feed-notice';
import { dateKeyOf, localDateAfter, localDayOf, type LocalDate } from '../local-date';
import type { HiddenEntries } from '../mix/hidden-entries';
import type { ActiveDays } from '../progress/active-days';
import { LEVEL_MILESTONES, nameOf, totalFor, type LevelMilestone } from '../progress/levels';
import type { XpLog } from '../progress/xp-log';
import type { Clock, UserStateChanges } from '../ports';
import type { History } from '../saved/history';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** A day of the first week, the first Active Day after the onboarding day 1 (ADR 0054). */
export type FirstWeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * What a Feed Notice shows: the first-week card, also its day of the first
 * week; Yesterday, the card of the day before's Word of the Day, which the
 * shell shows in Self-check style with the Knowledge Marks of its Word; the
 * Community Word, the card of its Entry and how many readers added it; a
 * level milestone, its Level and the Edition's name for it.
 */
export type FeedNoticeContent =
  | {
      readonly notice: Exclude<
        FeedNotice,
        'firstWeek' | 'yesterday' | 'communityWord' | 'levelMilestone'
      >;
    }
  | { readonly notice: 'firstWeek'; readonly firstWeekDay: FirstWeekDay }
  | { readonly notice: 'yesterday'; readonly word: WordCardModel }
  | { readonly notice: 'communityWord'; readonly card: AnyEntryCard; readonly adds: number }
  | { readonly notice: 'levelMilestone'; readonly level: LevelMilestone; readonly name: string };

/**
 * What gives the Feed Notices another feature makes for a local day, in any
 * order, for the card after the Entry `after`, if one comes before it: the
 * reader reaches that card only by leaving the Entry, which so becomes Seen.
 * It only reads.
 */
export interface FeedNotices {
  forDay(day: LocalDate, after?: string): Promise<readonly FeedNoticeContent[]>;
}

/** No Feed Notice on any day, as long as no feature makes one. */
export const noFeedNotices: FeedNotices = { forDay: () => Promise.resolve([]) };

/**
 * The Feed Notices as the Feed asks for them: one at a time, in the order of
 * `FEED_NOTICES`, each closed for its local day once swiped past (ADR 0054).
 */
export interface FeedNoticeQueue {
  /**
   * The first Feed Notice of the local day `day`, for the card after the
   * Entry `after`, that is neither closed for the day nor among `inSession`,
   * the Feed Notices of the day the Feed shows already. It only reads.
   */
  nextFor(
    day: LocalDate,
    after: string | undefined,
    inSession: ReadonlySet<FeedNotice>,
  ): Promise<FeedNoticeContent | undefined>;
  /** Keeps that the Feed shows `content` on the local day `day`: the offer to save progress counts its day. */
  shown(content: FeedNoticeContent, day: LocalDate): Promise<void>;
  /**
   * The change that closes `content` for the local day `date`
   * (`YYYY-MM-DD`); a level milestone it closes for good, so it comes once.
   */
  close(content: FeedNoticeContent, date: string): Promise<UserStateChanges>;
}

const {
  feedNoticesClosed,
  levelMilestonesClosed,
  firstWeekFrom,
  wordOfTheDayArchive,
  noCounters,
  saveProgressOffered,
} = userStateRecords;

/** The distinct Entries Seen on a local day after which the Feed asks «Може, на сьогодні досить?». */
const ENOUGH_FOR_TODAY_SEEN = 50;

const FIRST_WEEK_DAYS = 7;

const isFirstWeekDay = (day: number): day is FirstWeekDay => day >= 1 && day <= FIRST_WEEK_DAYS;

/** The most days the save-progress Feed Notice comes on. */
const SAVE_PROGRESS_MOST_DAYS = 2;

/** A Feed Notice the Core makes: what it shows on the local day `day` for the card after the Entry `after`, if it comes. */
type NoticeRule = (
  day: LocalDate,
  after: string | undefined,
) => Promise<FeedNoticeContent | undefined>;

/** The change that closes the Feed Notice for the local day `date` (`YYYY-MM-DD`), as `FeedNoticeQueue.close`. */
export async function closeNotice(
  userState: Pick<UserState, 'read'>,
  content: FeedNoticeContent,
  date: string,
): Promise<UserStateChanges> {
  const closed = await userState.read(feedNoticesClosed);
  const notices = new Set(closed?.date === date ? closed.notices : []);
  const change = feedNoticesClosed.change({ date, notices: [...notices.add(content.notice)] });
  if (content.notice !== 'levelMilestone') return change;
  const levels = new Set((await userState.read(levelMilestonesClosed)) ?? []);
  return new Map([...change, ...levelMilestonesClosed.change([...levels.add(content.level)])]);
}

/**
 * Opens the Feed Notices: those the Core makes, the Weekly Recap, the
 * first-week card, Yesterday, a level milestone, the offer to save progress
 * and «Може, на сьогодні досить?», beside those of `sources`, each Feed
 * Notice under its Feature Switch.
 */
export function openFeedNotices({
  edition,
  userState,
  clock,
  entries,
  hiddenEntries,
  history,
  xpLog,
  activeDays,
  weeklyRecap,
  signedIn,
  sources,
}: {
  edition: Pick<Edition, 'levels' | 'isFeatureEnabled'>;
  userState: UserState;
  clock: Clock;
  entries: Entries;
  hiddenEntries: Pick<HiddenEntries, 'has'>;
  history: Pick<History, 'list'>;
  xpLog: Pick<XpLog, 'state' | 'reachedOn'>;
  activeDays: Pick<ActiveDays, 'days' | 'streak'>;
  /** The Weekly Recap, read only when asked: it opens after the Feed. */
  weeklyRecap: () => Pick<WeeklyRecap, 'of'>;
  signedIn: (() => boolean) | undefined;
  /** The Feed Notices other features make. */
  sources: readonly FeedNotices[];
}): FeedNoticeQueue {
  const on = (feature: FeatureSwitch) => edition.isFeatureEnabled(feature);

  /** «Ваш тиждень» on the first open of a local Monday, when the week before has one (ADR 0054). */
  const weeklyRecapRule: NoticeRule = async (day) =>
    (await weeklyRecap().of(day)) === undefined ? undefined : { notice: 'weeklyRecap' };

  /**
   * The first week: on each of the first 7 Active Days from the day the reader
   * finished the onboarding, the first-week card of that day, so a missed
   * calendar day eats no card. A reader who finished the onboarding before
   * 0.8.13 has no first week. No later day has the number of a closed card,
   * so it never comes back (ADR 0054).
   */
  const firstWeek: NoticeRule = async (day) => {
    const from = await userState.read(firstWeekFrom);
    if (from === undefined || !on('firstWeek')) return undefined;
    const date = dateKeyOf(day);
    const before = [...activeDays.days].filter((active) => active >= from && active < date);
    const firstWeekDay = before.length + 1;
    return isFirstWeekDay(firstWeekDay) ? { notice: 'firstWeek', firstWeekDay } : undefined;
  };

  /**
   * Yesterday («Пам'ятаєте вчорашнє слово?»): the card of the Word of the Day
   * the archive keeps for the day before, while that Word is neither Hidden
   * nor Retired. The archive keeps a Word only once its card was Seen. It
   * reads the archive, so it needs the Feature Switches `yesterday` and
   * `wordOfTheDayArchive` both on (ADR 0054).
   */
  const yesterday: NoticeRule = async (day) => {
    if (!on('yesterday') || !on('wordOfTheDayArchive')) return undefined;
    const dayBefore = dateKeyOf(localDateAfter(day, -1));
    const wordId = await userState.read(wordOfTheDayArchive.record(dayBefore));
    if (wordId === undefined || hiddenEntries.has(wordId)) return undefined;
    const word = await entries.get(wordId);
    if (word?.kind !== 'word' || word.retired) return undefined;
    return { notice: 'yesterday', word: await buildWordCard({ word, entries }) };
  };

  /**
   * A level milestone (ADR 0066): once the reader reaches Level 5, 10 or 20,
   * from the day the XP log reached it on, highest Level first, until closed,
   * which is for good on this device. None while the Level is off or the
   * reader hides the counters («Без лічильників»).
   */
  const levelMilestone: NoticeRule = async (day) => {
    if (xpLog.state.level === undefined) return undefined;
    if (on('noCounters') && (await userState.read(noCounters)) === true) return undefined;
    const date = dateKeyOf(day);
    const closed = (await userState.read(levelMilestonesClosed)) ?? [];
    const level = LEVEL_MILESTONES.find((milestone) => {
      if (closed.includes(milestone)) return false;
      const reached = xpLog.reachedOn(totalFor(edition.levels, milestone));
      return reached !== undefined && reached <= date;
    });
    return level === undefined
      ? undefined
      : { notice: 'levelMilestone', level, name: nameOf(edition.levels, level) };
  };

  /**
   * The offer to save progress (spec #1358 story 70): to a reader with no
   * Account, on the day today's Active Day brings the Streak to 3 and on the
   * day the reader reaches Level 1. It comes on at most two days in total,
   * those it was shown on, kept on this device; on such a day it comes again.
   * None while the Profile or the Account is off, or without `signedIn`.
   */
  const saveProgress: NoticeRule = async (day) => {
    if (signedIn === undefined || signedIn()) return undefined;
    if (!on('profile') || !on('account')) return undefined;
    const date = dateKeyOf(day);
    const streakDay = activeDays.streak.streak === 3 && activeDays.days.has(date);
    const firstLevel =
      xpLog.state.level !== undefined && xpLog.reachedOn(totalFor(edition.levels, 1)) === date;
    if (!streakDay && !firstLevel) return undefined;
    const offered = (await userState.read(saveProgressOffered)) ?? [];
    return offered.includes(date) || offered.length < SAVE_PROGRESS_MOST_DAYS
      ? { notice: 'saveProgress' }
      : undefined;
  };

  /**
   * «Може, на сьогодні досить?» (ADR 0066): once the distinct Entries Seen on
   * the local day, the Word of the Day and the Entry the card follows
   * included, reach 50. It has no setting and never locks the Feed.
   */
  const enoughForToday: NoticeRule = (day, after) => {
    if (!on('enoughForToday')) return Promise.resolve(undefined);
    const date = dateKeyOf(day);
    const seen = new Set(
      history.list.flatMap(({ entryId, seenAt }) =>
        dateKeyOf(localDayOf(seenAt, clock).date) === date ? [entryId] : [],
      ),
    );
    if (after !== undefined) seen.add(after);
    return Promise.resolve(
      seen.size >= ENOUGH_FOR_TODAY_SEEN ? { notice: 'enoughForToday' } : undefined,
    );
  };

  const rules = [
    weeklyRecapRule,
    firstWeek,
    yesterday,
    levelMilestone,
    saveProgress,
    enoughForToday,
  ];

  return {
    async nextFor(day, after, inSession) {
      const [made, given, closed] = await Promise.all([
        Promise.all(rules.map((rule) => rule(day, after))),
        Promise.all(sources.map((source) => source.forDay(day, after))),
        userState.read(feedNoticesClosed),
      ]);
      const date = dateKeyOf(day);
      const closedToday = new Set(closed?.date === date ? closed.notices : []);
      const contents = [
        ...made.flatMap((each) => (each === undefined ? [] : [each])),
        ...given.flat(),
      ];
      return FEED_NOTICES.flatMap((notice) =>
        closedToday.has(notice) || inSession.has(notice)
          ? []
          : contents.filter((each) => each.notice === notice),
      )[0];
    },
    async shown(content, day) {
      if (content.notice !== 'saveProgress') return;
      const date = dateKeyOf(day);
      const offered = (await userState.read(saveProgressOffered)) ?? [];
      if (!offered.includes(date))
        await userState.write(saveProgressOffered.change([...offered, date]));
    },
    close: (content, date) => closeNotice(userState, content, date),
  };
}
