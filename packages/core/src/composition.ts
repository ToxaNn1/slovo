import {
  createCollectionLinkCopy,
  type CollectionLinkCopy,
} from './collection-links/copy-collection';
import { openCollectionSharing, type CollectionSharing } from './collection-links/share-collection';
import { openCollections, type Collections } from './saved/collections';
import { anagramMode } from './game/anagram-mode';
import { anglicismMode } from './game/anglicism-mode';
import { buildIdiomMode } from './game/build-idiom-mode';
import { byLettersMode } from './game/by-letters-mode';
import { correctionMode } from './game/correction-mode';
import {
  openDailyCrossword,
  type CrosswordReadPort,
  type DailyCrossword,
} from './game/daily-crossword';
import { openCycle } from './feed/cycle';
import { createDayChange, type OpenedEntry } from './feed/day-change';
import type { Edition } from './edition/edition';
import { createEntries } from './entries/entries';
import { createEntryRows, type EntryRowModel } from './entries/entry-row';
import { openFavorites, type Favorites } from './saved/favorites';
import { buildEntryCard, buildFeedCard, openFeed, type Feed } from './feed/feed';
import { enoughForTodayNotices } from './feed/enough-for-today';
import { createCommunityWord } from './feed/community-word';
import { allFeedNotices, noFeedNotices, type FeedNotices } from './feed/feed-notices';
import { createFirstWeek } from './feed/first-week';
import { createYesterday } from './feed/yesterday';
import { createLevelMilestones } from './feed/level-milestone';
import { asReviewIfDue, type AnyEntryCard } from './feed/feed-card';
import { openGame, type Game } from './game/game';
import { createQuickQuestion } from './game/quick-question';
import type { GameMode } from './game/game-mode';
import { guessWord } from './game/guess-word';
import { idiomMeaningMode } from './game/idiom-meaning-mode';
import { originMode } from './game/origin-mode';
import { pairsMode } from './game/pairs-mode';
import { stressMode } from './game/stress-mode';
import { survivalMode } from './game/survival-mode';
import { timedMode } from './game/timed-mode';
import { typeWordMode } from './game/type-word-mode';
import { openHistory, type History } from './saved/history';
import {
  createWordOfTheDayArchive,
  createWordOfTheDayArchiveRecorder,
  type WordOfTheDayArchive,
} from './saved/word-of-the-day-archive';
import { openKnowledge, type Knowledge } from './knowledge/knowledge';
import { openBadges, type Badges } from './progress/badges';
import { openCommunityCounters, type CommunityCounters } from './community-counters/counter-deltas';
import { openHiddenEntries, type HiddenEntries } from './mix/hidden-entries';
import { createHiding, type Hiding } from './mix/hiding';
import { NORMAL_KIND_WEIGHTS, openMix, type Mix } from './entries/mix';
import type { NotificationScheduling } from './notifications/notification-plan';
import { openNotifications, type Notifications } from './notifications/notifications';
import { openOnboarding, type Onboarding } from './onboarding/onboarding';
import type { LocalDate } from './local-date';
import type { Backend, Clock, ContentReadPort, Random, Schedule } from './ports';
import { openActiveDays } from './progress/active-days';
import { openXpLog, type XpLog } from './progress/xp-log';
import { openStreakBreak, type StreakBreak } from './progress/streak-break';
import { openProgress, type Progress } from './progress/progress';
import { createWeeklyRecap, type WeeklyRecap } from './feed/weekly-recap';
import { createMoodDraw, type MoodDraw } from './mood/mood-draw';
import { createRarityTest, type RarityTest } from './mix/rarity-test';
import { createRecentQueries, type RecentQueries } from './search/recent-queries';
import { createSearch, type Search } from './search/search';
import type { UserState } from './user-state/user-state';
import { createSpotlight, type Spotlight } from './spotlight/spotlight';
import { createSubject, type Subject } from './subject';
import { createAnalytics, type AnalyticsPort } from './analytics/analytics';
import { openProgressShareCards, type ProgressShareCards } from './share/progress-share-cards';
import type { ShareCardKind } from './analytics/analytics';
import { createWidget, type Widget } from './widget/widget';
import { openWordOfTheDay } from './feed/word-of-the-day';

/**
 * The Core features that open once the Language Pack is open, linked to each
 * other inside the composition, so a shell subscribes to what it draws and
 * holds no rule between them (ADR 0018). The settings open before the
 * Language Pack and stay apart. Its `hide` and `unhide` hold the rules of
 * the card's hide action and of the Hidden screen, each with its undo, so the
 * shell only shows the action sheet and the toast.
 */
export interface Composition extends Hiding {
  /** The Feed of the app session. */
  readonly feed: Feed;
  /** Favorites, which a heart tapped anywhere changes. */
  readonly favorites: Favorites;
  /** Collections, which the sheet and the Collections screens change. */
  readonly collections: Collections;
  /** The recipient's side of a Collection Link: its preview and «Додати собі». */
  readonly collectionLinkCopy: CollectionLinkCopy;
  /** The sender's side of a Collection Link: «Поділитися посиланням» of a Collection's menu. */
  readonly collectionSharing: CollectionSharing;
  /** History, which the Feed records in the same write as Seen. */
  readonly history: History;
  /**
   * The Word of the Day archive «Слова дня», the days whose Word of the Day's
   * card was Seen, read afresh on each call (ADR 0054). Opening a Word from it
   * makes nothing Seen: open it with `entryCard`.
   */
  readonly wordOfTheDayArchive: WordOfTheDayArchive;
  /** The Hidden Entries, eligible nowhere until restored. */
  readonly hiddenEntries: HiddenEntries;
  /** The Mix, whose Categories out of it are the Hidden Categories (ADR 0019). */
  readonly mix: Mix;
  /** The Knowledge Marks, which an Entry card's «Знаю» and «Не знаю» change (ADR 0043). */
  readonly knowledge: Knowledge;
  /** The Community Counters, which the reader's own Knowledge Marks and Favorites change (ADR 0060). */
  readonly communityCounters: CommunityCounters;
  /**
   * Progress: the Streak and the Best Streak, derived from the Active Days,
   * the stats sheet's counts, which a heart, a Collection change and a Seen
   * Entry change at once, the Game's best result and the knowledge counts.
   */
  readonly progress: Progress;
  /**
   * The XP log: the XP the Game's learning actions earn and the Daily Goals
   * set, kept per Edition, and the total, today's XP and today's Daily Goal
   * derived from it, which the XP bar shows (ADR 0066).
   */
  readonly xpLog: XpLog;
  /** The Badges: kept milestones the Edition chooses from the Core's catalogue of conditions (ADR 0066). */
  readonly badges: Badges;
  /** The Break: a pause of the Streak the reader starts, up to 7 days, once every 30 days (ADR 0066). */
  readonly streakBreak: StreakBreak;
  /** The Weekly Recap, whose numbers its Feed Notice shows on a local Monday (ADR 0054). */
  readonly weeklyRecap: WeeklyRecap;
  /** The progress Share Cards on offer today: a Level reached, a Badge earned, a Streak milestone. */
  readonly progressShareCards: ProgressShareCards;
  /**
   * Tells the composition the app is in the foreground: it came back from the
   * background, or the shell's timer fired when the next local day started
   * while it was open (see `untilNextLocalDay`). The composition decides
   * whether a new local day started and turns to it in one fixed order: the
   * morning Word becomes the Word of the Day, today an Active Day, the
   * notification plan is made again and the Feed opens the day. On the same
   * day it only reads the permission again and plans by it. It runs in turn
   * with an Entry opened from a notification or the widget, so the two never
   * run side by side. Should every try to plan the Game's offers have failed,
   * the Game tries again.
   */
  resume(): Promise<void>;
  /** The Notification times, the notification sound and the plan, kept on this device. */
  readonly notifications: Notifications;
  /**
   * The Game: the Game Modes on offer, which a hide, a restore or a Mix change
   * may stop or let start, and the Game in play, kept in memory for the session.
   */
  readonly game: Game;
  /**
   * The onboarding, which opens on launch until the reader finishes it: its
   * steps, with SLOVO ID last when the Edition has the Account, the ask for
   * permission, and its sample notification, taken from the plan.
   */
  readonly onboarding: Onboarding;
  /**
   * Search, over every live Entry that is not Hidden, the Mix and the Rarity
   * Floor aside; nothing while the Edition turns it off (ADR 0054). Open what
   * it finds with `openedFromSearch`.
   */
  readonly search: Search;
  /** The last 10 queries a Search result was opened from, kept on this device. */
  readonly recentQueries: RecentQueries;
  /** The Rarity Test, which draws the Words it asks about and sets the Rarity Floor by the answers. */
  readonly rarityTest: RarityTest;
  /**
   * «Слово під настрій» (ADR 0054): the Edition's moods and a mood's roulette,
   * which lands on a Word the shell opens with `openedFromMood`.
   */
  readonly moodDraw: MoodDraw;
  /**
   * Opens today's Daily Crossword with the letters this device kept for it,
   * for its card and its screen; nothing when the Edition has it off, the pack
   * has no day for the local date or the composition was opened without
   * `crossword`. Open it again once the next local day starts.
   */
  openDailyCrossword(): Promise<DailyCrossword | undefined>;
  /**
   * The Entry card of any Entry, Retired or not, for a screen that opens a
   * kept Entry or the Synonym Row a Word card links back to; nothing for an id the Language Pack doesn't have. The card of
   * today's Word of the Day carries its day, and the card of an Entry due for
   * Review is a Review (`review`), as in the Feed. Opening it never
   * makes the Entry Seen: Seen comes from the Feed, a notification or the
   * widget, never from Search or the mood roulette.
   */
  entryCard(entryId: string): Promise<AnyEntryCard | undefined>;
  /**
   * Opens a Word from a notification: its Entry card, like `entryCard`, once
   * it is Seen, in History and today is an Active Day, in one write. It joins
   * History as the Word of the Day's card only if it is today's Word of the
   * Day, which on a new day is the Word of its morning notification. A
   * Hidden or Retired Word opens as a kept Entry and is Seen only if it is
   * still eligible, so a Hidden Entry never re-enters History. Nothing for
   * an id the Language Pack doesn't have: the Feed opens instead. Opening it
   * again writes nothing new. On a new local day it turns the composition to
   * the day, as `resume` does, with today's Active Day in the Word's write.
   */
  openedFromNotification(entryId: string): Promise<AnyEntryCard | undefined>;
  /**
   * Opens an Entry from a Search result: its Entry card, like `entryCard`.
   * It writes nothing, so the Entry is not Seen and History stays as it was
   * (ADR 0054).
   */
  openedFromSearch(entryId: string): Promise<AnyEntryCard | undefined>;
  /**
   * Opens the Word the mood roulette landed on: its Entry card, like
   * `entryCard`. It writes nothing, so the Word is not Seen and History stays
   * as it was (ADR 0054).
   */
  openedFromMood(entryId: string): Promise<AnyEntryCard | undefined>;
  /** The row model of any Entry, Retired or not, for a list; nothing for an id the Language Pack doesn't have. */
  entryRow(entryId: string): Promise<EntryRowModel | undefined>;
  /**
   * The home-screen widget: the Widget Snapshot the app writes for it, and an
   * Entry opened from it (ADR 0026).
   */
  readonly widget: Widget;
  /**
   * The Analytics events of what the shell draws and plays (ADR 0068): sent
   * only while sharing is allowed, and never failing.
   */
  readonly analytics: {
    pronunciationPlayed(entryId: string): Promise<void>;
    wordHistoryOpened(entryId: string): Promise<void>;
    screenViewed(screen: string): Promise<void>;
    /** The reader sent a Share Card from the system share sheet. */
    shareCardShared(card: ShareCardKind): Promise<void>;
  };
  /** The iPhone search: the Spotlight Snapshot the app hands its native module (ADR 0057). */
  readonly spotlight: Spotlight;
  /**
   * Closes the composition, once the shell opened another over the same user
   * state (ADR 0036): from then on it writes nothing to the user state, hands
   * the device no plan, and the Game tries no planning of its offers again.
   * What it reads stays as it was. Resolves once the writes and the plans it
   * had under way end; never rejects.
   */
  close(): Promise<void>;
}

/**
 * The ports the composition writes through, made to do nothing once it
 * closes: a write, a plan handed to the device or a planning of the Game's
 * offers tried again. `close` cancels the tries waiting and resolves once the
 * writes and the plans under way end.
 */
function closable({
  userState,
  scheduling,
  schedule,
}: {
  userState: UserState;
  scheduling?: NotificationScheduling;
  schedule?: Schedule;
}): {
  userState: UserState;
  scheduling: NotificationScheduling | undefined;
  schedule: Schedule | undefined;
  close: () => Promise<void>;
} {
  let closed = false;
  const underWay = new Set<Promise<void>>();
  const waiting = new Set<() => void>();
  /** Runs `change` unless the composition is closed, and keeps it under way until it ends. */
  function unlessClosed(change: () => Promise<void>): Promise<void> {
    if (closed) return Promise.resolve();
    const done = change();
    underWay.add(done);
    const end = () => underWay.delete(done);
    done.then(end, end);
    return done;
  }
  return {
    userState: { ...userState, write: (changes) => unlessClosed(() => userState.write(changes)) },
    scheduling: scheduling && {
      ...scheduling,
      scheduler: {
        ...scheduling.scheduler,
        replacePlan: (plan) => unlessClosed(() => scheduling.scheduler.replacePlan(plan)),
      },
    },
    schedule:
      schedule &&
      ((run, delay) => {
        if (closed) return () => undefined;
        const cancel = schedule(() => {
          waiting.delete(cancel);
          run();
        }, delay);
        waiting.add(cancel);
        return () => {
          waiting.delete(cancel);
          cancel();
        };
      }),
    async close() {
      closed = true;
      for (const cancel of waiting) cancel();
      waiting.clear();
      await Promise.allSettled(underWay);
    },
  };
}

/** The Core's own Game Modes, registered through the same Extension Point as an Edition's. */
const coreGameModes: readonly GameMode[] = [
  guessWord,
  correctionMode,
  stressMode,
  pairsMode,
  anagramMode,
  byLettersMode,
  typeWordMode,
  anglicismMode,
  buildIdiomMode,
  idiomMeaningMode,
  survivalMode,
  timedMode,
  originMode,
];

/**
 * Opens the composition for a new app session, once the Language Pack is
 * open: one Entries module, one Cycle and one Word of the Day over the stored
 * user state, shared by every feature it opens. The Cycle and the Word of the
 * Day keep their state in memory for the session (ADR 0013), so open one
 * composition per app session. Opening it makes today an Active Day and
 * makes the notification plan, which `scheduling` hands to the device;
 * without it, as in tools and in tests of other features, nothing is planned.
 * The Game offers the Core's Game Modes, then `gameModes`, the ones an Edition
 * adds through the Extension Point. It tries a failed planning of their
 * offers again by `schedule`, and on each `resume`; without `schedule`, as in
 * tests of other features, only on `resume`. Close it with `close` once
 * another opens over the same user state.
 */
export async function openComposition({
  content,
  edition,
  clock,
  random,
  gameModes = [],
  crossword,
  feedNotices = noFeedNotices,
  backend,
  analytics: analyticsPort,
  ...ports
}: {
  content: ContentReadPort;
  /** The Daily Crossword's days, which the pack reader gives next to `content`; without it, as in tests of other features, there is none. */
  crossword?: CrosswordReadPort;
  /** The Edition as the app runs it (`loadEdition`); each module reads of it what it names. */
  edition: Edition;
  userState: UserState;
  clock: Clock;
  random: Random;
  scheduling?: NotificationScheduling;
  schedule?: Schedule;
  gameModes?: readonly GameMode[];
  /** Feed Notices of each day beside those the Core makes, the Weekly Recap, the first-week card, Yesterday and «Може, на сьогодні досить?»; without it, none. */
  feedNotices?: FeedNotices;
  /**
   * The backend (ADR 0064), which the Community Word the Feed shows on a
   * Monday and the Collection Links, which a link opened from outside reads
   * and sharing a Collection makes, reach; without it, as in tests of other
   * features, there is no Community Word, no link is available and none is
   * shared.
   */
  backend?: Pick<Backend, 'collectionLinks' | 'counters'>;
  /** Where the Analytics events go (ADR 0068); without it, as in tools and tests of other features, nowhere. */
  analytics?: AnalyticsPort;
}): Promise<Composition> {
  const { userState, scheduling, schedule, close } = closable(ports);
  // The named subjects the modules link through (ADR 0018), made before any
  // module opens. A subject's listeners follow in the order the modules open.
  const eligibility: Subject<void> = createSubject();
  const seen: Subject<string> = createSubject();
  const dayStarted: Subject<LocalDate> = createSubject();
  const opened: Subject<OpenedEntry> = createSubject();
  const dayTurned: Subject<LocalDate> = createSubject();
  const returned: Subject<void> = createSubject();
  const entries = createEntries({ content, edition, userState });
  const rows = createEntryRows(entries);
  const cycle = await openCycle({ entries, userState, random });
  // The Cycle reads the eligible Entries first; the Feed, the plan and the Game follow it.
  eligibility.subscribe(() => cycle.readEligibleAgain());
  const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });
  const analytics = createAnalytics({ edition, userState, port: analyticsPort });
  const xpLog = await openXpLog({ edition, userState, clock, random, dayTurned, analytics });
  const activeDays = await openActiveDays({ edition, userState, clock, xpLog, analytics });
  const day = createDayChange({
    clock,
    wordOfTheDay,
    activeDays,
    dayStarted,
    opened,
    dayTurned,
    returned,
  });
  const { history, recorder } = await openHistory({ rows, userState });
  const hiddenEntries = await openHiddenEntries({ rows, userState, clock, eligibility });
  const communityCounters = openCommunityCounters({ edition, userState });
  /** Emits the event about the Entry with its kind, rarity and Category; a failure is lost, never thrown. */
  async function entryEvent(
    event:
      | 'seen'
      | 'known'
      | 'unknown'
      | 'favoriteAdded'
      | 'favoriteRemoved'
      | 'pronunciationPlayed'
      | 'wordHistoryOpened',
    entryId: string,
  ): Promise<void> {
    try {
      const entry = await entries.get(entryId);
      if (entry === undefined) return;
      await analytics.track(event, {
        entryKind: entry.kind,
        rarity: entry.kind === 'word' ? entry.rarity : null,
        categoryId: entry.kind === 'word' || entry.kind === 'correction' ? entry.categoryId : null,
      });
    } catch {
      // Analytics never stands in the way of what the reader does.
    }
  }
  seen.subscribe((entryId) => entryEvent('seen', entryId));
  // The Knowledge Marks leave a Hidden Entry out, and turn to a new day before anything of it is written.
  const knowledge = await openKnowledge({
    edition,
    rows,
    hiddenEntries,
    userState,
    clock,
    countMark: async (entryId, mark) => {
      if (mark !== undefined) void entryEvent(mark, entryId);
      return communityCounters.countMark(entryId, mark);
    },
    dayStarted,
    xp: xpLog,
    analytics,
  });
  // On a day turned to, the plan is made again before the Feed opens the day
  // and the Game plans its offers; on a change of eligibility, before the Feed
  // follows the Cycle, so the order the three open in is the order they follow in.
  const notifications = await openNotifications({
    edition,
    userState,
    cycle,
    entries,
    clock,
    random,
    wordOfTheDay,
    takeMorningWord: () => day.takeMorningWord(),
    scheduling,
    eligibility,
    seen,
    dayTurned,
    returned,
  });
  const enoughForToday = enoughForTodayNotices({ edition, history, clock });
  // The Mix opens before the Feed, whose turns follow its kind weights.
  const [word, correction] = await Promise.all([
    entries.categories(),
    entries.correctionCategories(),
  ]);
  const mix = await openMix({ edition, categories: { word, correction }, userState, eligibility });
  const feed = await openFeed({
    entries,
    userState,
    clock,
    cycle,
    knowledge,
    wordOfTheDay,
    history: recorder,
    archive: createWordOfTheDayArchiveRecorder({ edition }),
    // The Weekly Recap opens below, once Favorites and Progress it reads are
    // open; the Feed asks for a day's Feed Notices only for a card after the
    // first, which none asks for before the composition opens.
    notices: allFeedNotices(
      feedNotices,
      {
        forDay: async (day) =>
          (await weeklyRecap.of(day)) === undefined ? [] : [{ notice: 'weeklyRecap' }],
      },
      backend === undefined
        ? noFeedNotices
        : createCommunityWord({ edition, entries, hiddenEntries, userState, backend, clock }),
      createFirstWeek({ edition, userState, activeDays }),
      createYesterday({ edition, entries, hiddenEntries, userState }),
      createLevelMilestones({ edition, xpLog, userState }),
      enoughForToday,
    ),
    kindWeights: () =>
      edition.isFeatureEnabled('mixKindWeights') ? mix.state.kindWeights : NORMAL_KIND_WEIGHTS,
    eligibility,
    seen,
    dayTurned,
    opened,
    quickQuestion: {
      every: () => {
        const on = edition.isFeatureEnabled('game') && edition.isFeatureEnabled('quickQuestion');
        const every = mix.state.quickQuestionEvery;
        return on && every !== 'off' ? every : undefined;
      },
      questions: createQuickQuestion({
        edition,
        entries,
        knowledge,
        xp: xpLog,
        userState,
        random,
        modes: [...coreGameModes, ...gameModes],
        analytics,
      }),
    },
  });
  // The Game Modes are planned once the day is turned to, last of what follows
  // it: planning reads the whole pack, so the launch never waits for it. A
  // start or a change of eligibility waits its turn behind it, and a planning
  // that fails is tried again.
  const game = await openGame({
    edition,
    entries,
    history,
    knowledge,
    xp: xpLog,
    userState,
    clock,
    random,
    ...(schedule === undefined ? {} : { schedule }),
    modes: [...coreGameModes, ...gameModes],
    eligibility,
    dayTurned,
    returned,
  });
  const [favorites, collections] = await Promise.all([
    openFavorites({
      rows,
      userState,
      clock,
      communityCounters: {
        countSaved: async (entryId, saved) => {
          void entryEvent(saved ? 'favoriteAdded' : 'favoriteRemoved', entryId);
          return communityCounters.countSaved(entryId, saved);
        },
      },
    }),
    openCollections({ rows, userState, clock, random }),
  ]);
  const badges = await openBadges({
    edition,
    userState,
    clock,
    xpLog,
    knowledge,
    activeDays,
    analytics,
  });
  const progress = openProgress({
    edition,
    clock,
    activeDays,
    history,
    favorites,
    collections,
    game,
    knowledge,
  });
  const weeklyRecap = createWeeklyRecap({
    edition,
    userState,
    clock,
    history,
    favorites,
    progress,
    activeDays,
    xpLog,
  });
  await day.resume();
  // Once the day is turned to, so the welcome shows today's Word of the Day.
  const rarityTest = createRarityTest({ edition, entries, mix, random });
  const onboarding = await openOnboarding({
    edition,
    userState,
    clock,
    entries,
    wordOfTheDay,
    mix,
    xpLog,
    analytics,
    backend,
  });
  async function entryCard(entryId: string): Promise<AnyEntryCard | undefined> {
    const entry = await entries.get(entryId);
    // Today's Word of the Day carries its day, as on its Feed card.
    const today = wordOfTheDay.chosen();
    const card =
      entry?.kind === 'word' && today?.wordId === entry.id
        ? await buildEntryCard(entries, entry, today.date)
        : await buildFeedCard(entries, entryId);
    if (card === undefined) return undefined;
    // A Review wherever its card is shown, as on the Feed (ADR 0043).
    return asReviewIfDue(card, knowledge);
  }
  /** An Entry opened from outside the app, from a notification or the widget: one rule for both. */
  async function openedFromOutside(entryId: string): Promise<AnyEntryCard | undefined> {
    await day.opened(entryId);
    return entryCard(entryId);
  }
  const wordOfTheDayArchive = createWordOfTheDayArchive({ content, edition, userState, clock });
  return {
    feed,
    favorites,
    collections,
    collectionLinkCopy: createCollectionLinkCopy({
      backend,
      edition,
      rows,
      collections,
      schedule,
      random,
    }),
    collectionSharing: openCollectionSharing({
      backend,
      edition,
      collections,
      schedule,
      random,
    }),
    history,
    wordOfTheDayArchive,
    hiddenEntries,
    mix,
    knowledge,
    communityCounters,
    progress,
    xpLog,
    badges,
    streakBreak: openStreakBreak({ edition, userState, clock, xpLog, analytics }),
    weeklyRecap,
    progressShareCards: openProgressShareCards({ edition, clock, xpLog, badges, activeDays }),
    resume: () => day.resume(),
    notifications,
    game,
    onboarding,
    search: createSearch({ content, edition, userState }),
    recentQueries: createRecentQueries({ edition, userState }),
    rarityTest,
    moodDraw: createMoodDraw({ edition, entries, random }),
    async openDailyCrossword() {
      if (crossword === undefined) return undefined;
      return openDailyCrossword({
        content: crossword,
        userState,
        clock,
        edition,
        xp: xpLog,
        analytics,
      });
    },
    ...createHiding({ rows, hiddenEntries, mix }),
    entryCard,
    openedFromNotification: openedFromOutside,
    // Opened from inside the app: one rule for both, nothing Seen (ADR 0054).
    openedFromSearch: entryCard,
    openedFromMood: entryCard,
    entryRow: (entryId) => rows.row(entryId),
    widget: createWidget({
      edition,
      entries,
      favorites,
      collections,
      history,
      onboarding,
      xpLog,
      progress,
      userState,
      clock,
      opened: openedFromOutside,
    }),
    spotlight: createSpotlight({
      edition,
      entries,
      favorites,
      collections,
      history,
      wordOfTheDayArchive,
    }),
    analytics: {
      pronunciationPlayed: (entryId) => entryEvent('pronunciationPlayed', entryId),
      wordHistoryOpened: (entryId) => entryEvent('wordHistoryOpened', entryId),
      screenViewed: (screen) => analytics.track('screenViewed', { screen }).catch(() => undefined),
      shareCardShared: (card) =>
        analytics.track('shareCardShared', { card }).catch(() => undefined),
    },
    close,
  };
}
