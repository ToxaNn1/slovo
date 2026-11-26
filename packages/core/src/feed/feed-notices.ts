import type { FeatureSwitch, Word } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { buildWordCard, type WordCardModel } from '../entries/word-card';
import type { EntryRowModel } from '../entries/entry-row';
import type { WeeklyRecap, WeeklyRecapModel } from './weekly-recap';
import { FEED_NOTICES, type FeedNotice } from '../feed-notice';
import { dateKeyOf, localDateAfter, localDayOf, type LocalDate } from '../local-date';
import type { HiddenEntries } from '../mix/hidden-entries';
import { meaningQuiz, type MeaningQuiz } from '../knowledge/meaning-quiz';
import type { ActiveDays } from '../progress/active-days';
import { LEVEL_MILESTONES, nameOf, totalFor, type LevelMilestone } from '../progress/levels';
import type { XpLog } from '../progress/xp-log';
import type { Clock, Random, UserStateChanges } from '../ports';
import type { History } from '../saved/history';
import type { TextComparison } from '../text/text-comparison';
import { seededRandomOf } from '../game/seeded-random';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** A day of the first week, the first Active Day after the onboarding day 1. */
export type FirstWeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The Yesterday quiz: three distinct meanings, the Word's own
 * primary Definition and two of other Words, in the order the card shows
 * them; `answered` is the meaning the reader picked, once they did.
 */
export interface YesterdayQuiz extends MeaningQuiz {
  readonly answered?: number;
}

/** Yesterday: the card of the day before's Word of the Day and its quiz. */
export interface YesterdayContent {
  readonly notice: 'yesterday';
  readonly word: WordCardModel;
  readonly quiz: YesterdayQuiz;
}

/**
 * The Weekly Recap's page: the numbers of its week, `folded` once the reader
 * tapped «Готово», and the day's Yesterday under it when both are due.
 */
export interface WeeklyRecapContent {
  readonly notice: 'weeklyRecap';
  /** The numbers its rule read, as the Feed asked for the card. */
  readonly recap: WeeklyRecapModel;
  readonly folded: boolean;
  readonly yesterday: YesterdayContent | undefined;
}

/**
 * What a Feed Notice shows: the Weekly Recap, its page; the first-week card,
 * also its day of the first week; Yesterday, the card of the day before's
 * Word of the Day and its quiz; the Community Word, the row of its Entry and
 * how many readers added it; a level milestone, its Level and the Edition's
 * name for it; «Ціль дня виконано!», the Daily Goal met and the Lemmas of the
 * first Words Seen today.
 */
export type FeedNoticeContent =
  | {
      readonly notice: Exclude<
        FeedNotice,
        | 'weeklyRecap'
        | 'firstWeek'
        | 'yesterday'
        | 'communityWord'
        | 'levelMilestone'
        | 'goalReached'
      >;
    }
  | WeeklyRecapContent
  | { readonly notice: 'firstWeek'; readonly firstWeekDay: FirstWeekDay }
  | YesterdayContent
  | { readonly notice: 'communityWord'; readonly row: EntryRowModel; readonly adds: number }
  | { readonly notice: 'levelMilestone'; readonly level: LevelMilestone; readonly name: string }
  | {
      readonly notice: 'goalReached';
      /** The Words Seen the day's Daily Goal asked for. */
      readonly goal: number;
      /** The Lemmas of the first Words Seen today, in the order Seen, at most `GOAL_REACHED_WORDS`. */
      readonly words: readonly string[];
    };

/** The Feed Notices a page shows: its own, and the Yesterday under a Weekly Recap. */
export function noticesOf(content: FeedNoticeContent): readonly FeedNotice[] {
  return content.notice === 'weeklyRecap' && content.yesterday !== undefined
    ? ['weeklyRecap', 'yesterday']
    : [content.notice];
}

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
 * `FEED_NOTICES`, each closed for its local day once swiped past.
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
   * (`YYYY-MM-DD`), the Yesterday under a Weekly Recap too; a level milestone
   * it closes for good, so it comes once.
   */
  close(content: FeedNoticeContent, date: string): Promise<UserStateChanges>;
  /**
   * The change that folds the Weekly Recap of the local day `date` away
   * («Готово»): it is closed for that Monday, the only day it comes.
   */
  fold(date: string): Promise<UserStateChanges>;
  /** The change that brings the Weekly Recap folded on the local day `date` back («Повернути»). */
  restore(date: string): Promise<UserStateChanges>;
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
export const ENOUGH_FOR_TODAY_SEEN = 50;

const FIRST_WEEK_DAYS = 7;

const isFirstWeekDay = (day: number): day is FirstWeekDay => day >= 1 && day <= FIRST_WEEK_DAYS;

/** The most Words «Ціль дня виконано!» names. */
const GOAL_REACHED_WORDS = 3;

/** The most days the save-progress Feed Notice comes on. */
const SAVE_PROGRESS_MOST_DAYS = 2;

/** A Feed Notice the Core makes: what it shows on the local day `day` for the card after the Entry `after`, if it comes. */
type NoticeRule = (
  day: LocalDate,
  after: string | undefined,
) => Promise<FeedNoticeContent | undefined>;

/** The change that keeps the Feed Notices closed on the local day `date` as `update` leaves them. */
async function closedChange(
  userState: Pick<UserState, 'read'>,
  date: string,
  update: (notices: Set<FeedNotice>) => void,
): Promise<UserStateChanges> {
  const closed = await userState.read(feedNoticesClosed);
  const notices = new Set(closed?.date === date ? closed.notices : []);
  update(notices);
  return feedNoticesClosed.change({ date, notices: [...notices] });
}

/** The change that closes the Feed Notice for the local day `date` (`YYYY-MM-DD`), as `FeedNoticeQueue.close`. */
export async function closeNotice(
  userState: Pick<UserState, 'read'>,
  content: FeedNoticeContent,
  date: string,
): Promise<UserStateChanges> {
  const change = await closedChange(userState, date, (notices) => {
    for (const notice of noticesOf(content)) notices.add(notice);
  });
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
  comparison,
  seeded = seededRandomOf,
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
  /** The Edition's text comparison, which tells the meanings of a Yesterday quiz apart. */
  comparison: Pick<TextComparison, 'key'>;
  /** The random port of a seed, which orders a Yesterday quiz the same all its day. */
  seeded?: (seed: string) => Random;
}): FeedNoticeQueue {
  const on = (feature: FeatureSwitch) => edition.isFeatureEnabled(feature);

  /** «Твій тиждень» on the first open of a local Monday, when the week before has one. */
  const weeklyRecapRule: NoticeRule = async (day) => {
    const recap = await weeklyRecap().of(day);
    return recap === undefined
      ? undefined
      : { notice: 'weeklyRecap', recap, folded: false, yesterday: undefined };
  };

  /**
   * The first week: on each of the first 7 Active Days from the day the reader
   * finished the onboarding, the first-week card of that day, so a missed
   * calendar day eats no card. A reader who finished the onboarding before
   * 0.8.13 has no first week. No later day has the number of a closed card,
   * so it never comes back.
   */
  const firstWeek: NoticeRule = async (day) => {
    const from = await userState.read(firstWeekFrom);
    if (from === undefined || !on('firstWeek')) return undefined;
    const date = dateKeyOf(day);
    const before = [...activeDays.days].filter((active) => active >= from && active < date);
    const firstWeekDay = before.length + 1;
    return isFirstWeekDay(firstWeekDay) ? { notice: 'firstWeek', firstWeekDay } : undefined;
  };

  /** The last Yesterday quiz made, by its day and Word: one order all the day, made once. */
  const noQuiz = { key: '', quiz: Promise.resolve(undefined) };
  let lastQuiz: { readonly key: string; readonly quiz: Promise<YesterdayQuiz | undefined> } =
    noQuiz;

  /**
   * The Yesterday quiz of `word`, the Word of the Day of `dayBefore`, over
   * the Words within the Rarity Range not Hidden. A read that fails is
   * tried again on the next call.
   */
  function quizOf(word: Word, dayBefore: string): Promise<YesterdayQuiz | undefined> {
    const key = `${dayBefore}:${word.id}`;
    if (lastQuiz.key !== key) {
      const quiz = entries.wordsInRarityRange().then((words) =>
        meaningQuiz(
          word,
          words.filter((other) => other.id !== word.id && !hiddenEntries.has(other.id)),
          seeded(`yesterday:${key}`),
          comparison,
        ),
      );
      const made = { key, quiz };
      lastQuiz = made;
      quiz.catch(() => {
        if (lastQuiz === made) lastQuiz = noQuiz;
      });
    }
    return lastQuiz.quiz;
  }

  /**
   * Yesterday («Пам’ятаєш учорашнє слово?»): the card of the Word of the Day
   * the archive keeps for the day before, while that Word is neither Hidden
   * nor Retired, and its quiz, while the other Words give two more meanings.
   * The archive keeps a Word only once its card was Seen. It reads the
   * archive, so it needs the Feature Switches `yesterday` and
   * `wordOfTheDayArchive` both on.
   */
  const yesterday: NoticeRule = async (day) => {
    if (!on('yesterday') || !on('wordOfTheDayArchive')) return undefined;
    const dayBefore = dateKeyOf(localDateAfter(day, -1));
    const wordId = await userState.read(wordOfTheDayArchive.record(dayBefore));
    if (wordId === undefined || hiddenEntries.has(wordId)) return undefined;
    const word = await entries.get(wordId);
    if (word?.kind !== 'word' || word.retired) return undefined;
    const quiz = await quizOf(word, dayBefore);
    if (quiz === undefined) return undefined;
    return { notice: 'yesterday', word: await buildWordCard({ word, entries }), quiz };
  };

  /**
   * A level milestone (ADR 0066): once the reader reaches Level 5, 10 or 20,
   * from the day the XP log reached it on, highest Level first, until closed,
   * which is for good on this device. None while the Level is off or the
   * reader hides the counters («Без лічильників»).
   */
  const levelMilestone: NoticeRule = async (day) => {
    if (xpLog.state.level === undefined) return undefined;
    if ((await userState.read(noCounters)) === true) return undefined;
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

  /**
   * «Ціль дня виконано!»: once today's Daily Goal is met, or is
   * met by the Word the card follows, which the reader leaves to reach it;
   * closed, it is gone for the day, and the goal is met once a day. None
   * while the reader hides the counters («Без лічильників», ADR 0066).
   */
  const goalReached: NoticeRule = async (day, after) => {
    const goal = xpLog.state.dailyGoal;
    if (!on('goalReachedCard') || goal === null) return undefined;
    if ((await userState.read(noCounters)) === true) return undefined;
    const date = dateKeyOf(day);
    const today = history.list
      .filter(({ seenAt }) => dateKeyOf(localDayOf(seenAt, clock).date) === date)
      .sort((one, other) => one.seenAt.getTime() - other.seenAt.getTime())
      .map(({ entryId }) => entryId);
    const next = after === undefined || today.includes(after) ? undefined : after;
    const metNext =
      next !== undefined &&
      goal.seen + 1 >= goal.goal &&
      (await entries.get(next))?.kind === 'word';
    if (!goal.met && !metNext) return undefined;
    const words: string[] = [];
    for (const id of next === undefined ? today : [...today, next]) {
      if (words.length === GOAL_REACHED_WORDS) break;
      const entry = await entries.get(id);
      if (entry?.kind === 'word') words.push(entry.lemma);
    }
    return { notice: 'goalReached', goal: goal.goal, words };
  };

  const rules = [
    weeklyRecapRule,
    firstWeek,
    yesterday,
    levelMilestone,
    saveProgress,
    goalReached,
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
      const due = FEED_NOTICES.flatMap((notice) =>
        closedToday.has(notice) || inSession.has(notice)
          ? []
          : contents.filter((each) => each.notice === notice),
      );
      const first = due[0];
      if (first?.notice !== 'weeklyRecap') return first;
      // The Weekly Recap and Yesterday share one page, the week first.
      const yesterday = due.find((each): each is YesterdayContent => each.notice === 'yesterday');
      return { ...first, yesterday };
    },
    async shown(content, day) {
      if (content.notice !== 'saveProgress') return;
      const date = dateKeyOf(day);
      const offered = (await userState.read(saveProgressOffered)) ?? [];
      if (!offered.includes(date))
        await userState.write(saveProgressOffered.change([...offered, date]));
    },
    close: (content, date) => closeNotice(userState, content, date),
    fold: (date) => closedChange(userState, date, (notices) => notices.add('weeklyRecap')),
    restore: (date) => closedChange(userState, date, (notices) => notices.delete('weeklyRecap')),
  };
}
